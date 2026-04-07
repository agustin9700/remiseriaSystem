import { FastifyReply, FastifyRequest } from "fastify";
import {
  acceptOrderSchema, assignDriverSchema, createOrderSchema, createPublicOrderSchema,
  rejectOrderSchema, finishOrderSchema, cancelOrderSchema,
  rejectByOperatorSchema, finishByOperatorSchema, unassignDriverSchema,
  listOrdersQuerySchema, statsDateRangeQuerySchema,
} from "./orders.schemas";
import { ordersService } from "../../lib/container";
import { handleError } from "../../lib/errors";

export class OrdersController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createOrderSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const authUser = request.user as { userId: string };
      const order = await ordersService.createOrder(parsed.data, authUser.userId);
      return reply.status(201).send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async createPublic(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createPublicOrderSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const order = await ordersService.createPublic(parsed.data);
      return reply.status(201).send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async trackByCode(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { codigo } = request.params as { codigo: string };
      const order = await ordersService.getOrderByCode(codigo);
      return reply.send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const parsed = listOrdersQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const authUser = request.user as { userId: string; rol: string };
      const result = await ordersService.listOrders(parsed.data, authUser);
      return reply.send(result);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async assignDriver(request: FastifyRequest, reply: FastifyReply) {
    const parsed = assignDriverSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const { id } = request.params as { id: string };
      const authUser = request.user as { userId: string; rol: "ADMIN" | "OPERATOR" };
      const order = await ordersService.assignDriver(id, parsed.data, authUser.userId, authUser.rol);
      return reply.send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  // FIX: los controllers ya no tocan prisma directamente ��� el service resuelve el driver
  async accept(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const authUser = request.user as { userId: string };
      const order = await ordersService.acceptOrder(id, authUser.userId);
      return reply.send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async reject(request: FastifyRequest, reply: FastifyReply) {
    const parsed = rejectOrderSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const { id } = request.params as { id: string };
      const authUser = request.user as { userId: string };
      const order = await ordersService.rejectOrder(id, authUser.userId, parsed.data.motivoRechazo);
      return reply.send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async onTheWay(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const authUser = request.user as { userId: string };
      const order = await ordersService.onTheWayOrder(id, authUser.userId);
      return reply.send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async start(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const authUser = request.user as { userId: string };
      const order = await ordersService.startOrder(id, authUser.userId);
      return reply.send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async finish(request: FastifyRequest, reply: FastifyReply) {
    const parsed = finishOrderSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const { id } = request.params as { id: string };
      const authUser = request.user as { userId: string };
      const order = await ordersService.finishOrder(id, authUser.userId, parsed.data.montoFinal, parsed.data.metodoPago);
      return reply.send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async cancel(request: FastifyRequest, reply: FastifyReply) {
    const parsed = cancelOrderSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const { id } = request.params as { id: string };
      const authUser = request.user as { userId: string; rol: "ADMIN" | "OPERATOR" };
      const order = await ordersService.cancelOrder(id, parsed.data, authUser.userId, authUser.rol);
      return reply.send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async rejectByOperator(request: FastifyRequest, reply: FastifyReply) {
    const parsed = rejectByOperatorSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const { id } = request.params as { id: string };
      const authUser = request.user as { userId: string; rol: "ADMIN" | "OPERATOR" };
      const order = await ordersService.rejectByOperator(id, parsed.data, authUser.userId, authUser.rol);
      return reply.send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const authUser = request.user as { userId: string; rol: string };
      const order = await ordersService.getOrderById(id, authUser);
      return reply.send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async topDrivers(request: FastifyRequest, reply: FastifyReply) {
    const parsed = statsDateRangeQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const result = await ordersService.getTopDrivers(parsed.data);
      return reply.send(result);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async activeTrips(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { userId: string; rol: string };
      const result = await ordersService.getActiveTrips(authUser);
      return reply.send(result);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async unassign(request: FastifyRequest, reply: FastifyReply) {
    // FIX: validar body con Zod en lugar de cast directo (evita 500 con body malformado)
    const parsed = unassignDriverSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const { id } = request.params as { id: string };
      const authUser = request.user as { userId: string; rol: "ADMIN" | "OPERATOR" };
      const order = await ordersService.unassignDriver(id, authUser.userId, authUser.rol, parsed.data.motivo);
      return reply.send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async finishByOperator(request: FastifyRequest, reply: FastifyReply) {
    const parsed = finishByOperatorSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const { id } = request.params as { id: string };
      const authUser = request.user as { userId: string; rol: "ADMIN" | "OPERATOR" };
      const order = await ordersService.finishOrderByOperator(
        id, authUser.userId, authUser.rol,
        parsed.data.montoFinal, parsed.data.metodoPago, parsed.data.nota
      );
      return reply.send(order);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async dashboard(request: FastifyRequest, reply: FastifyReply) {
    const parsed = statsDateRangeQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });

    try {
      const result = await ordersService.getDashboardStats(parsed.data);
      return reply.send(result);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async getStatusLogs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const logs = await ordersService.getOrderStatusLogs(id);
      return reply.send(logs);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async getTimeline(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const timeline = await ordersService.getOrderTimeline(id);
      return reply.send(timeline);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }
}
