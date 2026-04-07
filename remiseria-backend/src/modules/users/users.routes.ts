import { FastifyInstance } from "fastify";
import { UsersController } from "./users.controller";
import { authenticate, authorize } from "../../shared/auth";

const usersController = new UsersController();

export async function usersRoutes(app: FastifyInstance) {
  app.post(
    "/users",
    {
      preHandler: [authenticate, authorize(["ADMIN"])],
    },
    usersController.create.bind(usersController),
  );

  app.get(
    "/users",
    { preHandler: [authenticate, authorize(["ADMIN"])] },
    usersController.list.bind(usersController),
  );
}
