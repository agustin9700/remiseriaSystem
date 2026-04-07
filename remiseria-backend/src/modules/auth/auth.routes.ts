import { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller";
import { env } from "../../lib/env";

const authController = new AuthController();

export async function authRoutes(app: FastifyInstance) {
  const strictRateLimit = {
    config: { rateLimit: { max: env.RATE_LIMIT_AUTH_MAX, timeWindow: "1 minute" } },
  };

  app.post("/auth/login", strictRateLimit, authController.login.bind(authController));
  app.post("/auth/refresh", strictRateLimit, authController.refresh.bind(authController));
  app.post("/auth/logout", strictRateLimit, authController.logout.bind(authController));
}
