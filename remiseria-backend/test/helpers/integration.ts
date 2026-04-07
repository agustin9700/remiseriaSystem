import type { FastifyInstance } from "fastify";
import type { Server } from "socket.io";
import { buildApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { getIOOrNull, setIO } from "../../src/lib/socket";
import bcrypt from "bcrypt";
import { RolUsuario, EstadoChofer } from "@prisma/client";

export function extractRefreshTokenFromSetCookie(setCookie: string | string[] | undefined): string | null {
  const parts = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const line of parts) {
    const m = line.match(/^refreshToken=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

export function authBearer(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}

let appInstance: FastifyInstance | null = null;

/** Sin esto, los servicios que llaman a getIO() fallan (en `server.ts` se inyecta el Server real). */
function ensureSocketIoStubForIntegration() {
  if (getIOOrNull()) return;
  const stub = {
    to: (_room: string) => ({
      emit: (_event: string, _payload?: unknown) => undefined,
    }),
  };
  setIO(stub as unknown as Server);
}

export async function getTestApp(): Promise<FastifyInstance> {
  ensureSocketIoStubForIntegration();
  if (!appInstance) {
    appInstance = await buildApp();
    await appInstance.ready();
  }
  return appInstance;
}

export async function closeTestApp(): Promise<void> {
  if (appInstance) {
    await appInstance.close();
    appInstance = null;
  }
}

export type SeedResult = {
  /** Sufijo único del run (teléfonos de pedidos, trazas). */
  runTag: string;
  password: string;
  adminToken: string;
  operatorToken: string;
  driver1Token: string;
  driver2Token: string;
  adminId: string;
  operatorId: string;
  driver1UserId: string;
  driver2UserId: string;
  driver1Id: string;
  driver2Id: string;
  orderIds: string[];
  /** Usuarios creados en tests (p. ej. POST /users); cleanup los borra al final. */
  extraUserIds: string[];
  phones: { admin: string; operator: string; driver1: string; driver2: string };
};

/** Teléfonos de cliente únicos por ejecución de suite (evita colisiones en Order.telefonoCliente). */
export function createOrderPhoneFactory(seed: SeedResult) {
  let n = 0;
  const base = seed.runTag.replace(/\D/g, "").padEnd(4, "0").slice(0, 4);
  return () => {
    n += 1;
    return `+5499980${base}${String(n).padStart(3, "0")}`;
  };
}

const phone = (suffix: string) => `+549997TST${suffix}`;

export async function seedRolesAndTokens(app: FastifyInstance): Promise<SeedResult> {
  const tag = Date.now().toString(36);
  const password = "TestIntegration1!";
  const hash = await bcrypt.hash(password, 8);

  const admin = await prisma.user.create({
    data: {
      nombre: "IT",
      apellido: "Admin",
      telefono: phone(`A${tag}`),
      email: `it-adm-${tag}@test.local`,
      passwordHash: hash,
      rol: RolUsuario.ADMIN,
      activo: true,
    },
  });

  const operator = await prisma.user.create({
    data: {
      nombre: "IT",
      apellido: "Op",
      telefono: phone(`O${tag}`),
      email: `it-op-${tag}@test.local`,
      passwordHash: hash,
      rol: RolUsuario.OPERATOR,
      activo: true,
    },
  });

  const driver1User = await prisma.user.create({
    data: {
      nombre: "IT",
      apellido: "Drv1",
      telefono: phone(`1${tag}`),
      email: `it-d1-${tag}@test.local`,
      passwordHash: hash,
      rol: RolUsuario.DRIVER,
      activo: true,
    },
  });

  const driver2User = await prisma.user.create({
    data: {
      nombre: "IT",
      apellido: "Drv2",
      telefono: phone(`2${tag}`),
      email: `it-d2-${tag}@test.local`,
      passwordHash: hash,
      rol: RolUsuario.DRIVER,
      activo: true,
    },
  });

  const driver1 = await prisma.driver.create({
    data: {
      userId: driver1User.id,
      estado: EstadoChofer.DISPONIBLE,
      patente: `IT1-${tag}`,
    },
  });

  const driver2 = await prisma.driver.create({
    data: {
      userId: driver2User.id,
      estado: EstadoChofer.DISPONIBLE,
      patente: `IT2-${tag}`,
    },
  });

  async function loginToken(telefono: string): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { telefono, password },
    });
    if (res.statusCode !== 200) {
      throw new Error(`Login failed ${telefono}: ${res.statusCode} ${res.body}`);
    }
    const body = res.json() as { accessToken: string };
    return body.accessToken;
  }

  const adminToken = await loginToken(admin.telefono);
  const operatorToken = await loginToken(operator.telefono);
  const driver1Token = await loginToken(driver1User.telefono);
  const driver2Token = await loginToken(driver2User.telefono);

  return {
    runTag: tag,
    password,
    adminToken,
    operatorToken,
    driver1Token,
    driver2Token,
    adminId: admin.id,
    operatorId: operator.id,
    driver1UserId: driver1User.id,
    driver2UserId: driver2User.id,
    driver1Id: driver1.id,
    driver2Id: driver2.id,
    orderIds: [],
    extraUserIds: [],
    phones: {
      admin: admin.telefono,
      operator: operator.telefono,
      driver1: driver1User.telefono,
      driver2: driver2User.telefono,
    },
  };
}

export async function cleanupSeed(seed: SeedResult | undefined): Promise<void> {
  if (!seed) return;
  const orderIds = seed.orderIds.filter((id): id is string => Boolean(id));
  if (orderIds.length) {
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }
  const userIds = [
    seed.adminId,
    seed.operatorId,
    seed.driver1UserId,
    seed.driver2UserId,
    ...seed.extraUserIds,
  ];
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.driver.deleteMany({
    where: { id: { in: [seed.driver1Id, seed.driver2Id] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
