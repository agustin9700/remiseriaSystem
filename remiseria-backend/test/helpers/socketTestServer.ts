import type { FastifyInstance } from "fastify";
import type { Server } from "socket.io";
import { Server as IOServer } from "socket.io";
import { buildApp } from "../../src/app";
import { setIO } from "../../src/lib/socket";
import { setupSockets } from "../../src/sockets";

/** Mismo shape que el stub de integración HTTP (emit no-op). */
function createStubIo(): Server {
  return {
    to: () => ({
      emit: () => undefined,
    }),
  } as unknown as Server;
}

/**
 * Servidor Fastify escuchando en un puerto local + Socket.IO real (sin tocar `server.ts`).
 * CORS permisivo solo en esta instancia de test para clientes en cualquier puerto.
 */
export async function startSocketTestServer(): Promise<{
  app: FastifyInstance;
  port: number;
  io: IOServer;
  close: () => Promise<void>;
}> {
  const app = await buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  const port = typeof addr === "object" && addr !== null ? addr.port : 0;
  if (!port) throw new Error("No se pudo obtener puerto del servidor de test");

  const io = new IOServer(app.server, {
    cors: { origin: true, credentials: true },
  });
  setIO(io);
  setupSockets(io);

  return {
    app,
    port,
    io,
    close: async () => {
      await app.close();
      setIO(createStubIo());
    },
  };
}
