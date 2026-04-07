import { FastifyInstance } from "fastify";
import { OrdersController } from "./orders.controller";
import { authenticate, authorize } from "../../shared/auth";

const ordersController = new OrdersController();

export async function ordersRoutes(app: FastifyInstance) {
  // ── Rutas públicas — con rate limit estricto ────────────────────────────────
  app.post("/orders/public", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, ordersController.createPublic.bind(ordersController));

  app.get("/orders/track/:codigo", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, ordersController.trackByCode.bind(ordersController));

  // ── Rutas protegidas ────────────────────────────────────────────────────────
  app.post("/orders", { preHandler: [authenticate, authorize(["ADMIN", "OPERATOR"])] }, ordersController.create.bind(ordersController));
  app.get("/orders", { preHandler: [authenticate] }, ordersController.list.bind(ordersController));

  // Stats
  app.get("/orders/stats/top-drivers",  { preHandler: [authenticate, authorize(["ADMIN", "OPERATOR"])] }, ordersController.topDrivers.bind(ordersController));
  app.get("/orders/stats/dashboard",    { preHandler: [authenticate, authorize(["ADMIN", "OPERATOR"])] }, ordersController.dashboard.bind(ordersController));

  // FIX: ruta duplicada para que el frontend (/orders/active-trips) y el backend (/orders/stats/active-trips) funcionen ambos
  app.get("/orders/stats/active-trips", { preHandler: [authenticate, authorize(["ADMIN", "OPERATOR", "DRIVER"])] }, ordersController.activeTrips.bind(ordersController));
  app.get("/orders/active-trips",       { preHandler: [authenticate, authorize(["ADMIN", "OPERATOR", "DRIVER"])] }, ordersController.activeTrips.bind(ordersController));

  app.get("/orders/:id", { preHandler: [authenticate] }, ordersController.getById.bind(ordersController));

  // Acciones de pedido
  app.post("/orders/:id/assign-driver",     { preHandler: [authenticate, authorize(["ADMIN", "OPERATOR"])] }, ordersController.assignDriver.bind(ordersController));
  app.post("/orders/:id/accept",            { preHandler: [authenticate, authorize(["DRIVER"])] }, ordersController.accept.bind(ordersController));
  app.post("/orders/:id/reject",            { preHandler: [authenticate, authorize(["DRIVER"])] }, ordersController.reject.bind(ordersController));
  app.post("/orders/:id/on-the-way",        { preHandler: [authenticate, authorize(["DRIVER"])] }, ordersController.onTheWay.bind(ordersController));
  app.post("/orders/:id/start",             { preHandler: [authenticate, authorize(["DRIVER"])] }, ordersController.start.bind(ordersController));
  app.post("/orders/:id/finish",            { preHandler: [authenticate, authorize(["DRIVER"])] }, ordersController.finish.bind(ordersController));
  app.post("/orders/:id/cancel",            { preHandler: [authenticate, authorize(["ADMIN", "OPERATOR"])] }, ordersController.cancel.bind(ordersController));
  app.post("/orders/:id/reject-by-operator",{ preHandler: [authenticate, authorize(["ADMIN", "OPERATOR"])] }, ordersController.rejectByOperator.bind(ordersController));
  app.post("/orders/:id/unassign",          { preHandler: [authenticate, authorize(["ADMIN", "OPERATOR"])] }, ordersController.unassign.bind(ordersController));
  app.post("/orders/:id/finish-by-operator",{ preHandler: [authenticate, authorize(["ADMIN", "OPERATOR"])] }, ordersController.finishByOperator.bind(ordersController));
  app.get("/orders/:id/logs", { preHandler: [authenticate] }, ordersController.getStatusLogs.bind(ordersController));
  app.get("/orders/:id/timeline", { preHandler: [authenticate] }, ordersController.getTimeline.bind(ordersController));
}
