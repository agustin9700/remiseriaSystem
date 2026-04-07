import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  getTestApp,
  closeTestApp,
  seedRolesAndTokens,
  cleanupSeed,
  extractRefreshTokenFromSetCookie,
  authBearer,
  createOrderPhoneFactory,
  type SeedResult,
} from "../helpers/integration";

describe("integration — health", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it("GET /health", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });

  it("GET /health/live", async () => {
    const res = await app.inject({ method: "GET", url: "/health/live" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });

  it("GET /health/ready", async () => {
    const res = await app.inject({ method: "GET", url: "/health/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ready" });
  });
});

describe("integration — auth + security + orders", () => {
  let app: FastifyInstance;
  let seed: SeedResult | undefined;
  /** Teléfonos de cliente únicos por pedido (misma suite). */
  let orderPhone: () => string;

  beforeAll(async () => {
    app = await getTestApp();
    seed = await seedRolesAndTokens(app);
    orderPhone = createOrderPhoneFactory(seed);
  });

  afterAll(async () => {
    await cleanupSeed(seed);
    await closeTestApp();
  });

  it("login exitoso devuelve accessToken y usuario sin password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { telefono: seed.phones.admin, password: seed.password },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { accessToken?: string; user?: Record<string, unknown> };
    expect(body.accessToken).toBeTruthy();
    expect(body.user).toBeTruthy();
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  it("login inválido → 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { telefono: seed.phones.admin, password: "wrong-password-xyz" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("refresh exitoso con cookie refreshToken", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { telefono: seed.phones.operator, password: seed.password },
    });
    expect(loginRes.statusCode).toBe(200);
    const refresh = extractRefreshTokenFromSetCookie(loginRes.headers["set-cookie"]);
    expect(refresh).toBeTruthy();

    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { cookie: `refreshToken=${encodeURIComponent(refresh!)}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { accessToken?: string };
    expect(body.accessToken).toBeTruthy();
  });

  it("logout cierra sesión (cookie limpiada) y acepta refresh", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { telefono: seed.phones.driver1, password: seed.password },
    });
    const refresh = extractRefreshTokenFromSetCookie(loginRes.headers["set-cookie"]);
    expect(refresh).toBeTruthy();

    const out = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { cookie: `refreshToken=${encodeURIComponent(refresh!)}` },
      payload: {},
    });
    expect(out.statusCode).toBe(200);
  });

  it("GET /users no expone passwordHash", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/users",
      headers: authBearer(seed.adminToken),
    });
    expect(res.statusCode).toBe(200);
    const users = res.json() as unknown[];
    expect(Array.isArray(users)).toBe(true);
    for (const u of users) {
      expect(u).not.toHaveProperty("passwordHash");
    }
  });

  it("POST /users como ADMIN no expone passwordHash", async () => {
    const tag = seed.runTag;
    const res = await app.inject({
      method: "POST",
      url: "/users",
      headers: authBearer(seed.adminToken),
      payload: {
        nombre: "IT",
        apellido: "Created",
        telefono: `+549997USR${tag}`,
        email: `it-created-${tag}@test.local`,
        password: "TestPass123!",
        rol: "OPERATOR",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty("passwordHash");
    expect(body.id).toBeTruthy();
    seed.extraUserIds.push(body.id as string);
  });

  it("DRIVER no puede listar GET /drivers", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/drivers",
      headers: authBearer(seed.driver1Token),
    });
    expect(res.statusCode).toBe(403);
  });

  it("DRIVER solo ve sus pedidos en GET /orders", async () => {
    const pub = await app.inject({
      method: "POST",
      url: "/orders/public",
      payload: {
        nombreCliente: "IT Pub",
        telefonoCliente: orderPhone(),
        origenTexto: "Origen público IT",
        origenLat: -26.81,
        origenLng: -65.21,
        destinoTexto: "Destino público IT",
        destinoLat: -26.82,
        destinoLng: -65.22,
      },
    });
    expect(pub.statusCode).toBe(201);
    const pubOrder = pub.json() as { id: string };
    seed.orderIds.push(pubOrder.id);

    const listD1a = await app.inject({
      method: "GET",
      url: "/orders?limit=100",
      headers: authBearer(seed.driver1Token),
    });
    expect(listD1a.statusCode).toBe(200);
    const body1a = listD1a.json() as { orders: { id: string }[] };
    expect(body1a.orders.some((o) => o.id === pubOrder.id)).toBe(false);

    const assign = await app.inject({
      method: "POST",
      url: `/orders/${pubOrder.id}/assign-driver`,
      headers: authBearer(seed.operatorToken),
      payload: { driverId: seed.driver1Id },
    });
    expect(assign.statusCode).toBe(200);

    const listD1b = await app.inject({
      method: "GET",
      url: "/orders?limit=100",
      headers: authBearer(seed.driver1Token),
    });
    const body1b = listD1b.json() as { orders: { id: string }[] };
    expect(body1b.orders.some((o) => o.id === pubOrder.id)).toBe(true);

    const listD2 = await app.inject({
      method: "GET",
      url: "/orders?limit=100",
      headers: authBearer(seed.driver2Token),
    });
    const body2 = listD2.json() as { orders: { id: string }[] };
    expect(body2.orders.some((o) => o.id === pubOrder.id)).toBe(false);

    const un = await app.inject({
      method: "POST",
      url: `/orders/${pubOrder.id}/unassign`,
      headers: authBearer(seed.operatorToken),
      payload: {},
    });
    expect(un.statusCode).toBe(200);
  });

  it("GET /orders/:id otro DRIVER no puede ver pedido asignado a otro chofer → 403", async () => {
    const pub = await app.inject({
      method: "POST",
      url: "/orders/public",
      payload: {
        nombreCliente: "IT Own",
        telefonoCliente: orderPhone(),
        origenTexto: "Origen own",
        origenLat: -26.81,
        origenLng: -65.21,
        destinoTexto: "Destino own",
        destinoLat: -26.82,
        destinoLng: -65.22,
      },
    });
    expect(pub.statusCode).toBe(201);
    const order = pub.json() as { id: string };
    seed.orderIds.push(order.id);

    const asg = await app.inject({
      method: "POST",
      url: `/orders/${order.id}/assign-driver`,
      headers: authBearer(seed.operatorToken),
      payload: { driverId: seed.driver1Id },
    });
    expect(asg.statusCode).toBe(200);

    const getOther = await app.inject({
      method: "GET",
      url: `/orders/${order.id}`,
      headers: authBearer(seed.driver2Token),
    });
    expect(getOther.statusCode).toBe(403);

    const un = await app.inject({
      method: "POST",
      url: `/orders/${order.id}/unassign`,
      headers: authBearer(seed.operatorToken),
      payload: {},
    });
    expect(un.statusCode).toBe(200);
  });

  it("GET /metrics sin auth → 401", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /metrics con METRICS_TOKEN o JWT ADMIN → 200", async () => {
    const metricsToken = process.env.METRICS_TOKEN;
    expect(metricsToken).toBeTruthy();

    const resToken = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: authBearer(metricsToken!),
    });
    expect(resToken.statusCode).toBe(200);

    const resAdmin = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: authBearer(seed.adminToken),
    });
    expect(resAdmin.statusCode).toBe(200);
  });

  it("GET /admin/metrics sin auth → 401", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/metrics" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /admin/metrics con METRICS_TOKEN o JWT ADMIN → 200", async () => {
    const metricsToken = process.env.METRICS_TOKEN;
    expect(metricsToken).toBeTruthy();

    const resToken = await app.inject({
      method: "GET",
      url: "/admin/metrics",
      headers: authBearer(metricsToken!),
    });
    expect(resToken.statusCode).toBe(200);

    const resAdmin = await app.inject({
      method: "GET",
      url: "/admin/metrics",
      headers: authBearer(seed.adminToken),
    });
    expect(resAdmin.statusCode).toBe(200);
  });

  it("GET /admin/metrics con JWT DRIVER → 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/metrics",
      headers: authBearer(seed.driver1Token),
    });
    expect(res.statusCode).toBe(401);
  });

  it("flujo pedido: público, interno, asignar, aceptar, en camino, iniciar, finalizar", async () => {
    const pub = await app.inject({
      method: "POST",
      url: "/orders/public",
      payload: {
        nombreCliente: "IT Flow",
        telefonoCliente: orderPhone(),
        origenTexto: "Origen flow",
        origenLat: -26.83,
        origenLng: -65.23,
        destinoTexto: "Destino flow",
        destinoLat: -26.84,
        destinoLng: -65.24,
      },
    });
    expect(pub.statusCode).toBe(201);
    const pubOrder = pub.json() as { id: string };
    seed.orderIds.push(pubOrder.id);

    const internal = await app.inject({
      method: "POST",
      url: "/orders",
      headers: authBearer(seed.operatorToken),
      payload: {
        nombreCliente: "Cliente interno IT",
        telefonoCliente: orderPhone(),
        origenTexto: "Origen interno IT",
        destinoTexto: "Destino interno IT",
      },
    });
    expect(internal.statusCode).toBe(201);
    const intOrder = internal.json() as { id: string };
    seed.orderIds.push(intOrder.id);

    // driver1 puede seguir OCUPADO por el test anterior; usamos driver2 para el ciclo completo
    const asg = await app.inject({
      method: "POST",
      url: `/orders/${intOrder.id}/assign-driver`,
      headers: authBearer(seed.operatorToken),
      payload: { driverId: seed.driver2Id },
    });
    expect(asg.statusCode).toBe(200);

    const acc = await app.inject({
      method: "POST",
      url: `/orders/${intOrder.id}/accept`,
      headers: authBearer(seed.driver2Token),
    });
    expect(acc.statusCode).toBe(200);

    const otw = await app.inject({
      method: "POST",
      url: `/orders/${intOrder.id}/on-the-way`,
      headers: authBearer(seed.driver2Token),
    });
    expect(otw.statusCode).toBe(200);

    const st = await app.inject({
      method: "POST",
      url: `/orders/${intOrder.id}/start`,
      headers: authBearer(seed.driver2Token),
    });
    expect(st.statusCode).toBe(200);

    const fin = await app.inject({
      method: "POST",
      url: `/orders/${intOrder.id}/finish`,
      headers: authBearer(seed.driver2Token),
      payload: { montoFinal: 1500, metodoPago: "EFECTIVO" },
    });
    expect(fin.statusCode).toBe(200);
  });

  it("rechazar pedido asignado (chofer)", async () => {
    const pub = await app.inject({
      method: "POST",
      url: "/orders/public",
      payload: {
        nombreCliente: "IT Rej",
        telefonoCliente: orderPhone(),
        origenTexto: "Origen rej",
        origenLat: -26.85,
        origenLng: -65.25,
        destinoTexto: "Destino rej",
        destinoLat: -26.86,
        destinoLng: -65.26,
      },
    });
    expect(pub.statusCode).toBe(201);
    const order = pub.json() as { id: string };
    seed.orderIds.push(order.id);

    const asgRej = await app.inject({
      method: "POST",
      url: `/orders/${order.id}/assign-driver`,
      headers: authBearer(seed.operatorToken),
      payload: { driverId: seed.driver1Id },
    });
    expect(asgRej.statusCode).toBe(200);

    const rej = await app.inject({
      method: "POST",
      url: `/orders/${order.id}/reject`,
      headers: authBearer(seed.driver1Token),
      payload: { motivoRechazo: "Motivo test integración" },
    });
    expect(rej.statusCode).toBe(200);
  });

  it("desasignar pedido", async () => {
    const pub = await app.inject({
      method: "POST",
      url: "/orders/public",
      payload: {
        nombreCliente: "IT Un",
        telefonoCliente: orderPhone(),
        origenTexto: "Origen un",
        origenLat: -26.87,
        origenLng: -65.27,
        destinoTexto: "Destino un",
        destinoLat: -26.88,
        destinoLng: -65.28,
      },
    });
    expect(pub.statusCode).toBe(201);
    const order = pub.json() as { id: string };
    seed.orderIds.push(order.id);

    const asgUn = await app.inject({
      method: "POST",
      url: `/orders/${order.id}/assign-driver`,
      headers: authBearer(seed.operatorToken),
      payload: { driverId: seed.driver1Id },
    });
    expect(asgUn.statusCode).toBe(200);

    const un = await app.inject({
      method: "POST",
      url: `/orders/${order.id}/unassign`,
      headers: authBearer(seed.operatorToken),
      payload: {},
    });
    expect(un.statusCode).toBe(200);
  });

  it("cancelar pedido (operador)", async () => {
    const pub = await app.inject({
      method: "POST",
      url: "/orders/public",
      payload: {
        nombreCliente: "IT Can",
        telefonoCliente: orderPhone(),
        origenTexto: "Origen can",
        origenLat: -26.89,
        origenLng: -65.29,
        destinoTexto: "Destino can",
        destinoLat: -26.9,
        destinoLng: -65.3,
      },
    });
    expect(pub.statusCode).toBe(201);
    const order = pub.json() as { id: string };
    seed.orderIds.push(order.id);

    const asgCan = await app.inject({
      method: "POST",
      url: `/orders/${order.id}/assign-driver`,
      headers: authBearer(seed.operatorToken),
      payload: { driverId: seed.driver1Id },
    });
    expect(asgCan.statusCode).toBe(200);

    const can = await app.inject({
      method: "POST",
      url: `/orders/${order.id}/cancel`,
      headers: authBearer(seed.operatorToken),
      payload: { motivoCancelacion: "Cancelación test integración" },
    });
    expect(can.statusCode).toBe(200);
  });
});
