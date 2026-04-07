import { FastifyReply, FastifyRequest } from "fastify";
import { createUserSchema } from "./users.schemas";
import { usersService } from "../../lib/container";
import { handleError } from "../../lib/errors";

export class UsersController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const user = await usersService.createUser(parsed.data);
      return reply.status(201).send(user);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async list(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const users = await usersService.listUsers();
      return reply.send(users);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }
}
