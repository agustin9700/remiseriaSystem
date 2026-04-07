import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../../src/lib/env";
import { startSocketTestServer } from "../helpers/socketTestServer";
import { connectSocket, waitForEvent } from "../helpers/socketIoClient";
import {
  authBearer,
  cleanupSeed,
  createOrderPhoneFactory,
  seedRolesAndTokens,
  type SeedResult,
} from "../helpers/integration";

describe("integration — Socket.IO realtime", () => {
  let app: FastifyInstance;
  let port: number;
  let io: Server;
  let closeServer: () => Promise<void>;
  let seed: SeedResult;
  let orderPhone: () => string;

  beforeAll(async () => {
    const s = await startSocketTestServer();
    app = s.app;
    port = s.port;
    io = s.io;
    closeServer = s.close;
    seed = await seedRolesAndTokens(app);
    orderPhone = createOrderPhoneFactory(seed);
  });

  afterAll(async () => {
    await cleanupSeed(seed);
    await closeServer();
  });

  it("conecta con JWT válido", async () => {
    const socket = await connectSocket(port, seed.operatorToken);
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it("rechaza conexión con token inválido", async () => {
    await expect(connectSocket(port, "not-a-jwt")).rejects.toBeDefined();
  });

  it("rechaza conexión con JWT vencido", async () => {
    const expired = jwt.sign(
      { userId: seed.driver1UserId, rol: "DRIVER" },
      env.JWT_SECRET,
      { expiresIn: "-30s" }
    );
    try {
      await connectSocket(port, expired);
      expect.fail("debería rechazar token vencido");
    } catch (e) {
      expect(String((e as Error).message)).toMatch(/TOKEN_EXPIRED|Unauthorized|jwt|expired/i);
    }
  });

  it("OPERATOR entra en room operators", async () => {
    const socket = await connectSocket(port, seed.operatorToken);
    const inRoom = await io.in("operators").fetchSockets();
    expect(inRoom.some((s) => (s.data as { user?: { userId?: string } }).user?.userId === seed.operatorId)).toBe(
      true
    );
    socket.disconnect();
  });

  it("ADMIN entra en room operators", async () => {
    const socket = await connectSocket(port, seed.adminToken);
    const inRoom = await io.in("operators").fetchSockets();
    expect(inRoom.some((s) => (s.data as { user?: { userId?: string } }).user?.userId === seed.adminId)).toBe(true);
    socket.disconnect();
  });

  it("DRIVER entra en room driver:<userId>", async () => {
    const socket = await connectSocket(port, seed.driver1Token);
    const inRoom = await io.in(`driver:${seed.driver1UserId}`).fetchSockets();
    expect(inRoom.length).toBeGreaterThanOrEqual(1);
    socket.disconnect();
  });

  it("emite viaje:assigned, pedido:actualizado y cadena de eventos hasta viaje:completed", async () => {
    const op = await connectSocket(port, seed.operatorToken);
    const dr = await connectSocket(port, seed.driver1Token);

    const pub = await app.inject({
      method: "POST",
      url: "/orders/public",
      payload: {
        nombreCliente: "Socket IT",
        telefonoCliente: orderPhone(),
        origenTexto: "Origen IT 1",
        origenLat: -26.83,
        origenLng: -65.23,
        destinoTexto: "Destino IT 1",
        destinoLat: -26.84,
        destinoLng: -65.24,
      },
    });
    expect(pub.statusCode).toBe(201);
    const orderId = (pub.json() as { id: string }).id;
    seed.orderIds.push(orderId);

    const wAssigned = waitForEvent(dr, "viaje:assigned");
    const wPedido1 = waitForEvent(op, "pedido:actualizado");
    const asg = await app.inject({
      method: "POST",
      url: `/orders/${orderId}/assign-driver`,
      headers: authBearer(seed.operatorToken),
      payload: { driverId: seed.driver1Id },
    });
    expect(asg.statusCode).toBe(200);
    await Promise.all([wAssigned, wPedido1]);

    const wAccepted = waitForEvent(dr, "viaje:accepted");
    const wPedido2 = waitForEvent(op, "pedido:actualizado");
    const acc = await app.inject({
      method: "POST",
      url: `/orders/${orderId}/accept`,
      headers: authBearer(seed.driver1Token),
    });
    expect(acc.statusCode).toBe(200);
    await Promise.all([wAccepted, wPedido2]);

    const wOtw = waitForEvent(dr, "viaje:on-the-way");
    const wPedido3 = waitForEvent(op, "pedido:actualizado");
    const otw = await app.inject({
      method: "POST",
      url: `/orders/${orderId}/on-the-way`,
      headers: authBearer(seed.driver1Token),
    });
    expect(otw.statusCode).toBe(200);
    await Promise.all([wOtw, wPedido3]);

    const wStarted = waitForEvent(dr, "viaje:started");
    const wPedido4 = waitForEvent(op, "pedido:actualizado");
    const st = await app.inject({
      method: "POST",
      url: `/orders/${orderId}/start`,
      headers: authBearer(seed.driver1Token),
    });
    expect(st.statusCode).toBe(200);
    await Promise.all([wStarted, wPedido4]);

    const wDone = waitForEvent(dr, "viaje:completed");
    const wPedido5 = waitForEvent(op, "pedido:actualizado");
    const fin = await app.inject({
      method: "POST",
      url: `/orders/${orderId}/finish`,
      headers: authBearer(seed.driver1Token),
      payload: { montoFinal: 1500, metodoPago: "EFECTIVO" },
    });
    expect(fin.statusCode).toBe(200);
    await Promise.all([wDone, wPedido5]);

    op.disconnect();
    dr.disconnect();
  });

  it("emite viaje:rejected al rechazar", async () => {
    const op = await connectSocket(port, seed.operatorToken);
    const dr = await connectSocket(port, seed.driver1Token);

    const pub = await app.inject({
      method: "POST",
      url: "/orders/public",
      payload: {
        nombreCliente: "Socket Rej",
        telefonoCliente: orderPhone(),
        origenTexto: "Origen IT 2",
        origenLat: -26.85,
        origenLng: -65.25,
        destinoTexto: "Destino IT 2",
        destinoLat: -26.86,
        destinoLng: -65.26,
      },
    });
    expect(pub.statusCode).toBe(201);
    const orderId = (pub.json() as { id: string }).id;
    seed.orderIds.push(orderId);

    const w1 = waitForEvent(dr, "viaje:assigned");
    const w2 = waitForEvent(op, "pedido:actualizado");
    const asg = await app.inject({
      method: "POST",
      url: `/orders/${orderId}/assign-driver`,
      headers: authBearer(seed.operatorToken),
      payload: { driverId: seed.driver1Id },
    });
    expect(asg.statusCode).toBe(200);
    await Promise.all([w1, w2]);

    const wRej = waitForEvent(dr, "viaje:rejected");
    const wPed = waitForEvent(op, "pedido:actualizado");
    const rej = await app.inject({
      method: "POST",
      url: `/orders/${orderId}/reject`,
      headers: authBearer(seed.driver1Token),
      payload: { motivoRechazo: "test socket" },
    });
    expect(rej.statusCode).toBe(200);
    await Promise.all([wRej, wPed]);

    op.disconnect();
    dr.disconnect();
  });

  it("PATCH /drivers/me/location emite driver:location y viaje:positionUpdated en trip activo", async () => {
    const op = await connectSocket(port, seed.operatorToken);
    const dr = await connectSocket(port, seed.driver1Token);

    const pub = await app.inject({
      method: "POST",
      url: "/orders/public",
      payload: {
        nombreCliente: "Socket Loc",
        telefonoCliente: orderPhone(),
        origenTexto: "Origen IT 3",
        origenLat: -26.87,
        origenLng: -65.27,
        destinoTexto: "Destino IT 3",
        destinoLat: -26.88,
        destinoLng: -65.28,
      },
    });
    expect(pub.statusCode).toBe(201);
    const orderId = (pub.json() as { id: string }).id;
    seed.orderIds.push(orderId);

    await app.inject({
      method: "POST",
      url: `/orders/${orderId}/assign-driver`,
      headers: authBearer(seed.operatorToken),
      payload: { driverId: seed.driver1Id },
    });
    await app.inject({
      method: "POST",
      url: `/orders/${orderId}/accept`,
      headers: authBearer(seed.driver1Token),
    });
    await app.inject({
      method: "POST",
      url: `/orders/${orderId}/on-the-way`,
      headers: authBearer(seed.driver1Token),
    });
    await app.inject({
      method: "POST",
      url: `/orders/${orderId}/start`,
      headers: authBearer(seed.driver1Token),
    });

    op.emit("join-trip", { viajeId: orderId });

    const wLoc = waitForEvent(op, "driver:location");
    const wTrip = waitForEvent(op, "viaje:positionUpdated");
    const patch = await app.inject({
      method: "PATCH",
      url: "/drivers/me/location",
      headers: authBearer(seed.driver1Token),
      payload: { lat: -26.9, lng: -65.3 },
    });
    expect(patch.statusCode).toBe(200);
    const [locPayload, tripPayload] = await Promise.all([wLoc, wTrip]);
    expect(locPayload).toMatchObject({ lat: -26.9, lng: -65.3 });
    expect(tripPayload).toMatchObject({ lat: -26.9, lng: -65.3, viajeId: orderId });

    op.disconnect();
    dr.disconnect();
  });
});
