import { FastifyReply, FastifyRequest } from "fastify";
import { createDriverSchema, updateMyLocationSchema, updateMyStatusSchema } from "./drivers.schemas";
import { driversService, ordersService } from "../../lib/container";
import { handleError } from "../../lib/errors";

export class DriversController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createDriverSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const driver = await driversService.createDriver(parsed.data);
      return reply.status(201).send(driver);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async list(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const drivers = await driversService.listDrivers();
      return reply.send(drivers);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { userId: string };
      const result = await driversService.getMe(authUser.userId);
      return reply.send(result);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async updateMyLocation(request: FastifyRequest, reply: FastifyReply) {
    const parsed = updateMyLocationSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const authUser = request.user as { userId: string };
      const result = await driversService.updateMyLocation(authUser.userId, parsed.data);
      return reply.send(result);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async updateMyStatus(request: FastifyRequest, reply: FastifyReply) {
    const parsed = updateMyStatusSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const authUser = request.user as { userId: string };
      const result = await driversService.updateMyStatus(authUser.userId, parsed.data);
      return reply.send(result);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async myHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { userId: string };
      const { limit } = request.query as { limit?: string };
      // FIX: usar ordersService singleton desde container
      const result = await ordersService.getMyHistory(authUser.userId, limit ? Number(limit) : 10);
      return reply.send(result);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }
}
