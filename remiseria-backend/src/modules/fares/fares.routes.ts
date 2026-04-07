import { FastifyInstance } from "fastify";
import { FaresController } from "./fares.controller";
import { authenticate, authorize } from "../../shared/auth";

const faresController = new FaresController();

export async function faresRoutes(app: FastifyInstance) {
  // Tarifa activa — pública para que ViajeForm pueda calcular estimado sin auth
  app.get("/fares/active", faresController.getActive.bind(faresController));

  // Cálculo de estimado — público (lo usa el pasajero en ViajeForm)
  app.post(
    "/fares/calcular",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    faresController.calcularEstimado.bind(faresController)
  );

  // Gestión de tarifas — solo ADMIN
  app.get(
    "/fares",
    { preHandler: [authenticate, authorize(["ADMIN"])] },
    faresController.list.bind(faresController)
  );

  app.post(
    "/fares",
    { preHandler: [authenticate, authorize(["ADMIN"])] },
    faresController.create.bind(faresController)
  );

  app.patch(
    "/fares/:id/activate",
    { preHandler: [authenticate, authorize(["ADMIN"])] },
    faresController.setActive.bind(faresController)
  );
}
