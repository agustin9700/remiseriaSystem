import { FastifyReply, FastifyRequest } from "fastify";
import { createFareSchema, calcularEstimadoSchema } from "./fares.schemas";
import { faresService } from "../../lib/container";
import { handleError } from "../../lib/errors";

export class FaresController {
  async list(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const fares = await faresService.list();
      return reply.send(fares);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async getActive(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const fare = await faresService.getActive();
      return reply.send(fare);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createFareSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const fare = await faresService.create(parsed.data);
      return reply.status(201).send(fare);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async setActive(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const fare = await faresService.setActive(id);
      return reply.send(fare);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async calcularEstimado(request: FastifyRequest, reply: FastifyReply) {
    const parsed = calcularEstimadoSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const monto = await faresService.calcularEstimado(
        parsed.data.distanciaMetros,
        parsed.data.duracionMinutos,
        parsed.data.esNocturno
      );
      return reply.send({ montoEstimado: monto });
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }
}
