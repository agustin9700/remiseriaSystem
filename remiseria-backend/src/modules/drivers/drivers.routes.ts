import { FastifyInstance } from "fastify";
import { DriversController } from "./drivers.controller";
import { authenticate, authorize } from "../../shared/auth";

const driversController = new DriversController();

export async function driversRoutes(app: FastifyInstance) {
  app.post(
    "/drivers",
    {
      preHandler: [authenticate, authorize(["ADMIN" ])],
    },
    driversController.create.bind(driversController)
  );

  app.get(
    "/drivers",
    {
      preHandler: [authenticate],
    },
    driversController.list.bind(driversController)
  );


  app.get(
    "/drivers/me",
    {
      preHandler: [authenticate, authorize(["DRIVER"])],
    },
    driversController.getMe.bind(driversController)
  );

  app.patch(
    "/drivers/me/location",
    {
      preHandler: [authenticate, authorize(["DRIVER"])],
      // Conductores envían ubicación cada ~10s → 60 req/min es el máximo razonable
      // El global es 300/min, este límite específico evita abuso accidental
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    driversController.updateMyLocation.bind(driversController)
  );

app.patch(
  "/drivers/me/status",
  {
    preHandler: [authenticate, authorize(["DRIVER"])],
  },
  driversController.updateMyStatus.bind(driversController)
);
app.get(
  "/drivers/me/history",
  {
    preHandler: [authenticate, authorize(["DRIVER"])],
  },
  driversController.myHistory.bind(driversController)
);
}