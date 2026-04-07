import { Server } from "socket.io";

let io: Server | null = null;

export function setIO(server: Server) {
  io = server;
}

export function getIO() {
  if (!io) {
    throw new Error("Socket.io no inicializado");
  }

  return io;
}

export function getIOOrNull() {
  return io;
}
