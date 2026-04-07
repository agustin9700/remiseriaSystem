import "./lib/env";
import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import crypto from "crypto";
import { z } from "zod";
import { env } from "./lib/env";
import { usersRoutes } from "./modules/users/users.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { ordersRoutes } from "./modules/orders/orders.routes";
import { driversRoutes } from "./modules/drivers/drivers.routes";
import { faresRoutes } from "./modules/fares/fares.routes";
import { AppError } from "./lib/errors";

async function metricsAccess(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    
    if (env.METRICS_TOKEN && token === env.METRICS_TOKEN) {
      return;
    }
    
    try {
      const decoded = request.server.jwt.verify(token) as { rol?: string };
      if (decoded.rol === "ADMIN") {
        return;
      }
    } catch {}
  }
  
  return reply.status(401).send({ message: "Unauthorized" });
}

export const buildApp = async () => {
  const app = Fastify({ logger: true });

  // Request ID middleware - genera ID único por request
  app.addHook("onRequest", async (request) => {
    const requestId = request.headers["x-request-id"] as string | undefined;
    if (!requestId) {
      (request as any).id = crypto.randomBytes(8).toString("hex");
    }
  });

  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

  // Rate limiting global (generoso) + límite estricto en rutas públicas
  await app.register(rateLimit, {
    global: true,
    max: 2000,
    timeWindow: "1 minute",
  });

  await app.register(jwt, { secret: env.JWT_SECRET });

  // Handler global de errores
  app.setErrorHandler((error, _request, reply) => {
    // Errores de dominio tipados
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ message: error.message });
    }

    // Errores de validación Zod — formatear con detalle por campo
    if (error instanceof z.ZodError) {
      const fields = error.issues.map((e: any) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return reply.status(400).send({
        message: "Error de validación",
        fields,
      });
    }

    // Rate limit
    if ((error as any).statusCode === 429) {
      return reply.status(429).send({ message: "Demasiadas solicitudes, intentá más tarde" });
    }

    // Errores 400 genéricos de Fastify (ej: JSON malformado)
    if ((error as any).statusCode === 400) {
      return reply.status(400).send({ message: (error as any).message || "Solicitud inválida" });
    }

    app.log.error(error);
    return reply.status(500).send({ message: "Error interno del servidor" });
  });

  app.get("/health", async () => ({ status: "ok" }));

  // Métricas del sistema
  const { getMetrics, getPrometheusMetrics } = require("./lib/metrics");
  app.get("/metrics", { preHandler: metricsAccess }, async (_request, reply) => {
    reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    return getPrometheusMetrics();
  });
  app.get("/admin/metrics", { preHandler: metricsAccess }, async () => getMetrics());

  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(ordersRoutes);
  await app.register(driversRoutes);
  await app.register(faresRoutes);

  return app;
};
