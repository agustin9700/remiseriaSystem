import { EstadoPedido, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ConflictError } from "../../lib/errors";

export const orderWithDriverInclude = {
  chofer: {
    select: {
      id: true,
      estado: true,
      vehiculoMarca: true,
      vehiculoModelo: true,
      vehiculoColor: true,
      patente: true,
      licenciaNumero: true,
      latitud: true,
      longitud: true,
      user: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          telefono: true,
          email: true,
          activo: true,
        },
      },
    },
  },
} as const;

export type OrderWithDriver = Prisma.OrderGetPayload<{
  include: typeof orderWithDriverInclude;
}>;

export class OrdersRepository {
  async create(data: Prisma.OrderCreateInput) {
    return prisma.order.create({ data, include: orderWithDriverInclude });
  }

  async list(params?: { page?: number; limit?: number; estado?: string }) {
    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(Math.max(1, params?.limit ?? 50), 200);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (params?.estado) where.estado = params.estado;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          ...orderWithDriverInclude,
          creadoPor: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true,
              email: true,
              rol: true,
              activo: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total, page, limit };
  }

  async findById(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: orderWithDriverInclude,
    });
  }

  async findByCode(codigo: string) {
    return prisma.order.findUnique({
      where: { codigo },
      include: orderWithDriverInclude,
    });
  }

  async getActiveTrips() {
    return prisma.order.findMany({
      where: {
        estado: {
          in: [
            EstadoPedido.ASIGNADO,
            EstadoPedido.ACEPTADO,
            EstadoPedido.EN_CAMINO,
            EstadoPedido.EN_VIAJE,
          ],
        },
      },
      orderBy: { updatedAt: "desc" },
      include: orderWithDriverInclude,
    });
  }

  async getActiveTripsByDriverUserId(driverUserId: string) {
    return prisma.order.findMany({
      where: {
        estado: {
          in: [
            EstadoPedido.ASIGNADO,
            EstadoPedido.ACEPTADO,
            EstadoPedido.EN_CAMINO,
            EstadoPedido.EN_VIAJE,
          ],
        },
        chofer: {
          userId: driverUserId,
        },
      },
      orderBy: { updatedAt: "desc" },
      include: orderWithDriverInclude,
    });
  }

  async assignDriver(params: {
    orderId: string;
    driverId: string;
    assignedByUserId: string;
    assignedByRole: "ADMIN" | "OPERATOR";
  }) {
    const { orderId, driverId, assignedByUserId, assignedByRole } = params;

    return prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { estado: true, choferId: true },
      });

      if (!currentOrder) {
        throw new ConflictError("Pedido no encontrado");
      }

      // IDEMPOTENCIA: si ya está asignado a este chofer, retornar éxito sin cambios
      if (currentOrder.estado === "ASIGNADO" && currentOrder.choferId === driverId) {
        return tx.order.findUnique({
          where: { id: orderId },
          include: orderWithDriverInclude,
        });
      }

      // Condiciones atómicas para prevenir doble asignación en carrera
      const updatedOrder = await tx.order.updateMany({
        where: { id: orderId, estado: "PENDIENTE" },
        data: {
          choferId: driverId,
          estado: "ASIGNADO",
          asignadoAt: new Date(),
          motivoRechazo: null,
        },
      });

      if (updatedOrder.count !== 1) {
        throw new ConflictError("Pedido no está disponible para ser asignado");
      }

      const updatedDriver = await tx.driver.updateMany({
        where: { id: driverId, estado: "DISPONIBLE" },
        data: { estado: "OCUPADO" },
      });

      if (updatedDriver.count !== 1) {
        throw new ConflictError("Chofer no está disponible");
      }

      const orderAfter = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithDriverInclude,
      });

      if (!orderAfter) {
        throw new ConflictError("Pedido no encontrado luego de asignar");
      }

      await tx.orderStatusLog.create({
        data: {
          orderId,
          estadoAnterior: currentOrder.estado ?? "PENDIENTE",
          estadoNuevo: "ASIGNADO",
          userId: assignedByUserId,
          rolUsuario: assignedByRole,
          nota: "Chofer asignado al pedido",
        },
      });

      return orderAfter;
    });
  }

  async acceptOrder(params: { orderId: string; driverId: string; userId: string }) {
    const { orderId, userId } = params;
    const driverId = params.driverId;

    return prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { estado: true, choferId: true },
      });

      if (!currentOrder) {
        throw new ConflictError("Pedido no encontrado");
      }

      // IDEMPOTENCIA: si ya está aceptado por este chofer, retornar éxito sin cambios
      if (currentOrder.estado === "ACEPTADO" && currentOrder.choferId === driverId) {
        return tx.order.findUnique({
          where: { id: orderId },
          include: orderWithDriverInclude,
        });
      }

      const updatedOrder = await tx.order.updateMany({
        where: { id: orderId, estado: "ASIGNADO", choferId: driverId },
        data: { estado: "ACEPTADO", aceptadoAt: new Date() },
      });

      if (updatedOrder.count !== 1) {
        throw new ConflictError("Pedido no está en estado ASIGNADO para este chofer");
      }

      await tx.orderStatusLog.create({
        data: {
          orderId,
          estadoAnterior: "ASIGNADO",
          estadoNuevo: "ACEPTADO",
          userId,
          rolUsuario: "DRIVER",
          nota: "Chofer aceptó el viaje",
        },
      });

      const orderAfter = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithDriverInclude,
      });

      if (!orderAfter) {
        throw new ConflictError("Pedido no encontrado luego de aceptar");
      }

      return orderAfter;
    });
  }

  async rejectOrder(params: {
    orderId: string; driverId: string; userId: string; motivoRechazo: string;
  }) {
    const { orderId, driverId, userId, motivoRechazo } = params;

    return prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { estado: true, choferId: true },
      });

      if (!currentOrder) {
        throw new ConflictError("Pedido no encontrado");
      }

      // IDEMPOTENCIA: si ya está PENDIENTE (sin chofer), retornar éxito sin cambios
      if (currentOrder.estado === "PENDIENTE" && currentOrder.choferId === null) {
        return tx.order.findUnique({
          where: { id: orderId },
          include: orderWithDriverInclude,
        });
      }

      const updatedOrder = await tx.order.updateMany({
        where: { id: orderId, estado: "ASIGNADO", choferId: driverId },
        data: { estado: "PENDIENTE", motivoRechazo, choferId: null, asignadoAt: null },
      });

      if (updatedOrder.count !== 1) {
        // IDEMPOTENCIA: si el chofer ya no está asignado pero el pedido sigue ASIGNADO
        // (otro chofer fue asignado), retornar éxito sin hacer cambios
        const orderNow = await tx.order.findUnique({ where: { id: orderId } });
        if (orderNow && orderNow.estado === "ASIGNADO" && orderNow.choferId !== driverId && orderNow.choferId !== null) {
          return tx.order.findUnique({
            where: { id: orderId },
            include: orderWithDriverInclude,
          });
        }
        throw new ConflictError("Pedido no está disponible para ser rechazado por este chofer");
      }

      const updatedDriver = await tx.driver.updateMany({
        where: { id: driverId, estado: "OCUPADO" },
        data: { estado: "DISPONIBLE" },
      });

      if (updatedDriver.count !== 1) {
        throw new ConflictError("Chofer no está en estado OCUPADO para rechazar");
      }

      await tx.orderStatusLog.create({
        data: {
          orderId,
          estadoAnterior: "ASIGNADO",
          estadoNuevo: "PENDIENTE",
          userId,
          rolUsuario: "DRIVER",
          nota: motivoRechazo,
        },
      });

      const orderAfter = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithDriverInclude,
      });

      if (!orderAfter) {
        throw new ConflictError("Pedido no encontrado luego de rechazar");
      }

      return orderAfter;
    });
  }

  async onTheWayOrder(params: { orderId: string; userId: string }) {
    const { orderId, userId } = params;
    const driverId = params.userId;

    return prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { estado: true, choferId: true },
      });

      if (!currentOrder) {
        throw new ConflictError("Pedido no encontrado");
      }

      // IDEMPOTENCIA: si ya está en camino, retornar éxito sin cambios
      if (currentOrder.estado === "EN_CAMINO") {
        return tx.order.findUnique({
          where: { id: orderId },
          include: orderWithDriverInclude,
        });
      }

      const updatedOrder = await tx.order.updateMany({
        where: { id: orderId, estado: "ACEPTADO", chofer: { userId: userId } },
        data: { estado: "EN_CAMINO", enCaminoAt: new Date() },
      });

      if (updatedOrder.count !== 1) {
        throw new ConflictError("Pedido no está en ACEPTADO para continuar (o no pertenece a este chofer)");
      }

      await tx.orderStatusLog.create({
        data: {
          orderId,
          estadoAnterior: "ACEPTADO",
          estadoNuevo: "EN_CAMINO",
          userId,
          rolUsuario: "DRIVER",
          nota: "Chofer en camino al origen",
        },
      });

      const orderAfter = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithDriverInclude,
      });

      if (!orderAfter) {
        throw new ConflictError("Pedido no encontrado luego de pasar a EN_CAMINO");
      }

      return orderAfter;
    });
  }

  async startOrder(params: { orderId: string; userId: string }) {
    const { orderId, userId } = params;

    return prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { estado: true, choferId: true },
      });

      if (!currentOrder) {
        throw new ConflictError("Pedido no encontrado");
      }

      // IDEMPOTENCIA: si ya está en viaje, retornar éxito sin cambios
      if (currentOrder.estado === "EN_VIAJE") {
        return tx.order.findUnique({
          where: { id: orderId },
          include: orderWithDriverInclude,
        });
      }

      const updatedOrder = await tx.order.updateMany({
        where: { id: orderId, estado: "EN_CAMINO", chofer: { userId: userId } },
        data: { estado: "EN_VIAJE", iniciadoAt: new Date() },
      });

      if (updatedOrder.count !== 1) {
        throw new ConflictError("Pedido no está en EN_CAMINO para iniciar (o no pertenece a este chofer)");
      }

      await tx.orderStatusLog.create({
        data: {
          orderId,
          estadoAnterior: "EN_CAMINO",
          estadoNuevo: "EN_VIAJE",
          userId,
          rolUsuario: "DRIVER",
          nota: "Viaje iniciado",
        },
      });

      const orderAfter = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithDriverInclude,
      });

      if (!orderAfter) {
        throw new ConflictError("Pedido no encontrado luego de iniciar viaje");
      }

      return orderAfter;
    });
  }

  async finishOrder(params: {
    orderId: string; driverId: string; userId: string;
    montoFinal: number; metodoPago: "EFECTIVO" | "TRANSFERENCIA" | "TARJETA";
  }) {
    const { orderId, driverId, userId, montoFinal, metodoPago } = params;

    return prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { estado: true, choferId: true },
      });

      if (!currentOrder) {
        throw new ConflictError("Pedido no encontrado");
      }

      // IDEMPOTENCIA: si ya está completado, retornar éxito sin cambios
      if (currentOrder.estado === "COMPLETADO") {
        return tx.order.findUnique({
          where: { id: orderId },
          include: orderWithDriverInclude,
        });
      }

      const updatedOrder = await tx.order.updateMany({
        where: { id: orderId, estado: "EN_VIAJE", choferId: driverId },
        data: { estado: "COMPLETADO", montoFinal, metodoPago, completadoAt: new Date() },
      });

      if (updatedOrder.count !== 1) {
        throw new ConflictError("Pedido no está en EN_VIAJE para finalizar (o no pertenece a este chofer)");
      }

      const updatedDriver = await tx.driver.updateMany({
        where: { id: driverId, estado: "OCUPADO" },
        data: { estado: "DISPONIBLE" },
      });

      if (updatedDriver.count !== 1) {
        throw new ConflictError("Chofer no está en estado OCUPADO para finalizar");
      }

      await tx.orderStatusLog.create({
        data: {
          orderId,
          estadoAnterior: "EN_VIAJE",
          estadoNuevo: "COMPLETADO",
          userId,
          rolUsuario: "DRIVER",
          nota: `Viaje finalizado. Monto: ${montoFinal} - Pago: ${metodoPago}`,
        },
      });

      const orderAfter = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithDriverInclude,
      });

      if (!orderAfter) {
        throw new ConflictError("Pedido no encontrado luego de finalizar");
      }

      return orderAfter;
    });
  }

  async cancelOrder(params: {
    orderId: string; userId: string;
    rolUsuario: "ADMIN" | "OPERATOR"; motivoCancelacion: string;
  }) {
    const { orderId, userId, rolUsuario, motivoCancelacion } = params;

    return prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!currentOrder) throw new Error("Pedido no encontrado");

      // IDEMPOTENCIA: si ya está cancelado, retornar éxito sin cambios
      if (currentOrder.estado === "CANCELADO") {
        return tx.order.findUnique({
          where: { id: orderId },
          include: orderWithDriverInclude,
        });
      }

      // IDEMPOTENCIA: si ya está completado, no se puede cancelar
      if (currentOrder.estado === "COMPLETADO") {
        throw new ConflictError("No se puede cancelar un pedido completado");
      }

      // Atómico: no permitir cancelar COMPLETADO/CANCELADO
      const updatedOrder = await tx.order.updateMany({
        where: {
          id: orderId,
          estado: { notIn: ["COMPLETADO", "CANCELADO"] },
        },
        data: {
          estado: "CANCELADO",
          motivoCancelacion,
          canceladoAt: new Date(),
          canceladoPorUserId: userId,
        },
      });

      if (updatedOrder.count !== 1) {
        throw new ConflictError("Pedido no está disponible para cancelar");
      }

      const orderAfter = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithDriverInclude,
      });

      if (!orderAfter) {
        throw new ConflictError("Pedido no encontrado luego de cancelar");
      }

      if (currentOrder.choferId) {
        const updatedDriver = await tx.driver.updateMany({
          where: { id: currentOrder.choferId, estado: "OCUPADO" },
          data: { estado: "DISPONIBLE" },
        });
        if (updatedDriver.count !== 1) {
          // Si el chofer ya cambió de estado, igualmente es una carrera.
          // Mantenemos consistencia: cancel ya fue aplicada para el pedido.
        }
      }

      await tx.orderStatusLog.create({
        data: {
          orderId, estadoAnterior: currentOrder.estado, estadoNuevo: "CANCELADO",
          userId, rolUsuario, nota: motivoCancelacion,
        },
      });

      return orderAfter;
    });
  }

  async rejectByOperator(params: {
    orderId: string; userId: string;
    rolUsuario: "ADMIN" | "OPERATOR"; motivoRechazo: string;
  }) {
    const { orderId, userId, rolUsuario, motivoRechazo } = params;

    return prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!currentOrder) throw new Error("Pedido no encontrado");

      const updatedOrder = await tx.order.updateMany({
        where: { id: orderId, estado: "PENDIENTE" },
        data: { estado: "RECHAZADO", motivoRechazo },
      });

      if (updatedOrder.count !== 1) {
        throw new ConflictError("Solo se puede rechazar operativamente un pedido en PENDIENTE");
      }

      const orderAfter = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithDriverInclude,
      });

      if (!orderAfter) {
        throw new ConflictError("Pedido no encontrado luego de rechazar por operador");
      }

      await tx.orderStatusLog.create({
        data: {
          orderId, estadoAnterior: currentOrder.estado, estadoNuevo: "RECHAZADO",
          userId, rolUsuario, nota: motivoRechazo,
        },
      });

      return orderAfter;
    });
  }

  async unassignDriver(params: {
    orderId: string; driverId: string; userId: string;
    rolUsuario: "ADMIN" | "OPERATOR"; motivo?: string;
  }) {
    const { orderId, driverId, userId, rolUsuario, motivo } = params;

    return prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { estado: true, choferId: true },
      });

      if (!currentOrder) {
        throw new ConflictError("Pedido no encontrado");
      }

      // IDEMPOTENCIA: si ya está PENDIENTE (sin chofer), retornar éxito sin cambios
      if (currentOrder.estado === "PENDIENTE" && currentOrder.choferId === null) {
        return tx.order.findUnique({
          where: { id: orderId },
          include: orderWithDriverInclude,
        });
      }

      const updatedOrder = await tx.order.updateMany({
        where: { id: orderId, estado: "ASIGNADO", choferId: driverId },
        data: { estado: "PENDIENTE", choferId: null, asignadoAt: null },
      });

      if (updatedOrder.count !== 1) {
        throw new ConflictError("No se puede desasignar: pedido no está ASIGNADO para este chofer");
      }

      const updatedDriver = await tx.driver.updateMany({
        where: { id: driverId, estado: "OCUPADO" },
        data: { estado: "DISPONIBLE" },
      });

      if (updatedDriver.count !== 1) {
        throw new ConflictError("Chofer no está en estado OCUPADO para desasignar");
      }

      await tx.orderStatusLog.create({
        data: {
          orderId, estadoAnterior: "ASIGNADO", estadoNuevo: "PENDIENTE",
          userId, rolUsuario, nota: motivo ?? "Chofer desasignado por operador",
        },
      });

      const orderAfter = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithDriverInclude,
      });

      if (!orderAfter) {
        throw new ConflictError("Pedido no encontrado luego de desasignar");
      }

      return orderAfter;
    });
  }

  async finishOrderByOperator(params: {
    orderId: string; driverId: string; userId: string;
    rolUsuario: "ADMIN" | "OPERATOR"; montoFinal: number;
    metodoPago: "EFECTIVO" | "TRANSFERENCIA" | "TARJETA"; nota?: string;
  }) {
    const { orderId, driverId, userId, rolUsuario, montoFinal, metodoPago, nota } = params;

    return prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!currentOrder) throw new Error("Pedido no encontrado");

      // IDEMPOTENCIA: si ya está completado, retornar éxito sin cambios
      if (currentOrder.estado === "COMPLETADO") {
        return tx.order.findUnique({
          where: { id: orderId },
          include: orderWithDriverInclude,
        });
      }

      const updatedOrder = await tx.order.updateMany({
        where: {
          id: orderId,
          choferId: driverId,
          estado: { in: ["ACEPTADO", "EN_CAMINO", "EN_VIAJE"] },
        },
        data: {
          estado: "COMPLETADO",
          montoFinal,
          metodoPago,
          completadoAt: new Date(),
        },
      });

      if (updatedOrder.count !== 1) {
        throw new ConflictError("No se puede finalizar por operador: estado/transición inválida o chofer incorrecto");
      }

      const updatedDriver = await tx.driver.updateMany({
        where: { id: driverId, estado: "OCUPADO" },
        data: { estado: "DISPONIBLE" },
      });

      if (updatedDriver.count !== 1) {
        throw new ConflictError("Chofer no está OCUPADO para finalizar");
      }

      await tx.orderStatusLog.create({
        data: {
          orderId,
          estadoAnterior: currentOrder.estado,
          estadoNuevo: "COMPLETADO",
          userId,
          rolUsuario,
          nota: nota ?? `Viaje finalizado por operador. Monto: ${montoFinal} - Pago: ${metodoPago}`,
        },
      });

      const orderAfter = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithDriverInclude,
      });

      if (!orderAfter) {
        throw new ConflictError("Pedido no encontrado luego de finalizar por operador");
      }

      return orderAfter;
    });
  }

  async getTopDrivers(filters: { desde?: string; hasta?: string }) {
    const where: Prisma.OrderWhereInput = {
      estado: "COMPLETADO",
      completadoAt: {
        gte: filters.desde ? new Date(filters.desde) : undefined,
        lte: filters.hasta ? new Date(filters.hasta) : undefined,
      },
      choferId: { not: null },
    };

    const rows = await prisma.order.groupBy({
      by: ["choferId"],
      where,
      _count: { _all: true },
      _sum: { montoFinal: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    const choferIds = rows.map((r) => r.choferId).filter(Boolean) as string[];
    const drivers = choferIds.length
      ? await prisma.driver.findMany({
          where: { id: { in: choferIds } },
          include: { user: true },
        })
      : [];

    const driverMap = new Map(drivers.map((d) => [d.id, d]));

    return rows.map((row) => {
      const driver = row.choferId ? driverMap.get(row.choferId) : null;
      return {
        driverId: row.choferId,
        nombre: driver?.user ? `${driver.user.nombre} ${driver.user.apellido}`.trim() : "Chofer desconocido",
        viajes: row._count._all,
        totalFacturado: row._sum.montoFinal ?? 0,
      };
    });
  }

  async getDashboardStats(filters: { desde?: string; hasta?: string }) {
    const dateWhere = {
      gte: filters.desde ? new Date(filters.desde) : undefined,
      lte: filters.hasta ? new Date(filters.hasta) : undefined,
    };

    const [pedidosTotales, pedidosCompletados, pedidosCancelados, choferesDisponibles, ingresos] =
      await Promise.all([
        prisma.order.count({ where: { createdAt: dateWhere } }),
        prisma.order.count({ where: { estado: "COMPLETADO", completadoAt: dateWhere } }),
        prisma.order.count({ where: { estado: "CANCELADO", canceladoAt: dateWhere } }),
        prisma.driver.count({ where: { estado: "DISPONIBLE" } }),
        prisma.order.aggregate({
          where: { estado: "COMPLETADO", completadoAt: dateWhere },
          _sum: { montoFinal: true },
        }),
      ]);

    return {
      pedidosTotales,
      pedidosCompletados,
      pedidosCancelados,
      choferesDisponibles,
      ingresosTotales: ingresos._sum.montoFinal ?? 0,
    };
  }

  async getDriverHistory(driverId: string, userId: string, limit = 10) {
    return prisma.order.findMany({
      where: {
        OR: [
          { choferId: driverId, estado: { in: ["COMPLETADO", "CANCELADO", "RECHAZADO"] } },
          {
            estado: "PENDIENTE",
            statusLogs: {
              some: {
                userId,
                rolUsuario: "DRIVER",
                estadoNuevo: "PENDIENTE",
              },
            },
          },
        ],
      },
      include: {
        statusLogs: {
          where: {
            userId,
            rolUsuario: "DRIVER",
            estadoNuevo: "PENDIENTE",
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
  }
}
