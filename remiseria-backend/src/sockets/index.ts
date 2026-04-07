import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../lib/env";

export function setupSockets(io: Server) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token"));

      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.data.user = decoded;

      next();
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        const error = new Error("TOKEN_EXPIRED");
        return next(error);
      }
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as { userId: string; rol: string };

    if (user.rol === "ADMIN" || user.rol === "OPERATOR") {
      socket.join("operators");
    }

    if (user.rol === "DRIVER") {
      socket.join(`driver:${user.userId}`);
    }

    socket.on("join-driver-room", () => {
      socket.join(`driver:${user.userId}`);
    });

    socket.on("join-operator-room", () => {
      socket.join("operators");
    });

    socket.on("join-trip", (payload?: { viajeId?: string }) => {
      const viajeId = payload?.viajeId;
      if (viajeId) {
        socket.join(`trip:${viajeId}`);
      }
    });

    socket.on("leave-trip", (payload?: { viajeId?: string }) => {
      const viajeId = payload?.viajeId;
      if (viajeId) {
        socket.leave(`trip:${viajeId}`);
      }
    });
  });
}
