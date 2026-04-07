import { io as ioClient, type Socket } from "socket.io-client";

export function connectSocket(port: number, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
      timeout: 10_000,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("connect timeout"));
    }, 12_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export function waitForEvent<T = unknown>(socket: Socket, event: string, ms = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (data: T) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}
