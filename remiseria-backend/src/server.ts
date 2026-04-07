import "./lib/env";
import { buildApp } from "./app";
import { Server } from "socket.io";
import { setupSockets } from "./sockets";
import { setIO } from "./lib/socket";
import { env } from "./lib/env";
import { startJobs } from "./lib/jobs";

const start = async () => {
  const app = await buildApp();

  const io = new Server(app.server, {
    cors: {
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
  });

  setIO(io);
  setupSockets(io);

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    startJobs(app.log);
    app.log.info(`🚀 Server running on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
