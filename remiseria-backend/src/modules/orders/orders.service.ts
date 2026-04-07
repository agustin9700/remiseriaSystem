import { randomBytes } from "crypto";
import { EstadoChofer, EstadoPedido, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { OrdersRepository } from "./orders.repository";
import { toOrderDto, toOrderDetailDto } from "./orders.mappers";
import { getIO } from "../../lib/socket";
import { NotFoundError, AppError, ForbiddenError } from "../../lib/errors";
import { logOrderAction } from "../../lib/logger";
import {
  incrementPedidoCreado,
  incrementPedidoAsignado,
  incrementPedidoAceptado,
  incrementPedidoRechazado,
  incrementPedidoCompletado,
  incrementPedidoCancelado,
  recordDuracion,
} from "../../lib/metrics";
import {
  AcceptOrderInput, AssignDriverInput, CreateOrderInput,
  CreatePublicOrderInput, RejectOrderInput, OnTheWayOrderInput,
  StartOrderInput, FinishOrderInput, CancelOrderInput, RejectByOperatorInput,
} from "./orders.schemas";

/**
 * FIX Bug 4: genera un sufijo de 8 caracteres usando crypto.randomBytes
 * (CSPRNG nativo de Node, sin dependencias extra).
 *
 * Espacio anterior: Math.random() base-36 de 4 chars → ~1.7 M combinaciones.
 * Espacio nuevo:    4 bytes aleatorios como hex en mayúsculas → 4.294.967.296 combinaciones,
 *                   2.560 veces más grande, prácticamente libre de colisiones.
 *
 * El fallback con timestamp se elimina: si tras 5 intentos (probabilidad astronomicamente
 * baja) siguen colisionando, se lanza un error claro en lugar de devolver un código
 * potencialmente duplicado.
 */
function generarSufijo(): string {
  return randomBytes(4).toString("hex").toUpperCase(); // ej. "3F7A2C1B"
}


function isUniqueConstraintError(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002";
}

async function generarCodigoUnico(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const codigo = `RM-${generarSufijo()}`;
    const exists = await prisma.order.findUnique({ where: { codigo }, select: { id: true } });
    if (!exists) return codigo;
  }
  // 5 colisiones consecutivas con 4 bytes de entropía es estadísticamente imposible
  // en producción normal; lanzar error explícito es más seguro que un fallback silencioso.
  throw new AppError("No se pudo generar un código único para el pedido. Reintente.");
}

export class OrdersService {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  private async createOrderWithRetry(data: Omit<Prisma.OrderCreateInput, "codigo">) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const codigo = await generarCodigoUnico();

      try {
        return await this.ordersRepository.create({
          ...data,
          codigo,
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new AppError("No se pudo generar un código único para el pedido. Reintente.");
  }

  async createOrder(input: CreateOrderInput, creadoPorUserId: string) {
    const order = await this.createOrderWithRetry({
      nombreCliente: input.nombreCliente,
      telefonoCliente: input.telefonoCliente,
      origenTexto: input.origenTexto,
      origenLat: input.origenLat ?? null,
      origenLng: input.origenLng ?? null,
      destinoTexto: input.destinoTexto,
      destinoLat: input.destinoLat ?? null,
      destinoLng: input.destinoLng ?? null,
      observaciones: input.observaciones,
      estado: EstadoPedido.PENDIENTE,
      creadoPor: { connect: { id: creadoPorUserId } },
    });

    getIO().to("operators").emit("nuevo_pedido", toOrderDetailDto(order));
    incrementPedidoCreado();
    return order;
  }

  async createPublic(input: CreatePublicOrderInput) {
    const order = await this.createOrderWithRetry({
      nombreCliente: input.nombreCliente,
      telefonoCliente: input.telefonoCliente ?? "Sin teléfono",
      origenTexto: input.origenTexto,
      origenLat: input.origenLat ?? null,
      origenLng: input.origenLng ?? null,
      destinoTexto: input.destinoTexto,
      destinoLat: input.destinoLat ?? null,
      destinoLng: input.destinoLng ?? null,
      observaciones: input.observaciones ?? null,
      estado: EstadoPedido.PENDIENTE,
    });

    const orderDto = toOrderDetailDto(order);
    getIO().to("operators").emit("nuevo_pedido", orderDto);
    return orderDto;
  }

  async listOrders(params?: { page?: number; limit?: number; estado?: string }) {
    const result = await this.ordersRepository.list(params);
    return {
      ...result,
      orders: result.orders.map(toOrderDto),
    };
  }

  async getOrderByCode(codigo: string) {
    const order = await this.ordersRepository.findByCode(codigo);
    if (!order) throw new NotFoundError("Pedido no encontrado");
    return toOrderDetailDto(order);
  }

  async getOrderById(orderId: string, authUser?: { userId: string; rol: string }) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) throw new NotFoundError("Pedido no encontrado");

    if (authUser?.rol === "DRIVER" && order.chofer?.user?.id !== authUser.userId) {
      throw new ForbiddenError("No podés acceder a un pedido que no te pertenece");
    }

    return toOrderDetailDto(order);
  }

  // FIX: lookup del driver movido al service, fuera del controller
  private async getDriverByUserId(userId: string) {
    const driver = await prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundError("Chofer no encontrado");
    return driver;
  }

  async assignDriver(
    orderId: string,
    input: AssignDriverInput,
    assignedByUserId: string,
    assignedByRole: "ADMIN" | "OPERATOR"
  ) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) throw new NotFoundError("Pedido no encontrado");
    // Regla de negocio vigente: si el chofer rechaza, el pedido vuelve a PENDIENTE.
    // Por eso la asignación normal solo debe permitirse desde PENDIENTE.
    // La idempotencia se maneja en el repository (si ya está ASIGNADO a este chofer).
    if (order.estado !== EstadoPedido.PENDIENTE && !(order.estado === "ASIGNADO" && order.choferId === input.driverId)) {
      throw new AppError("El pedido debe estar en estado PENDIENTE para ser asignado");
    }

    const driver = await prisma.driver.findUnique({ where: { id: input.driverId } });
    if (!driver) throw new NotFoundError("Chofer no encontrado");
    if (driver.estado !== EstadoChofer.DISPONIBLE && !(order.estado === "ASIGNADO" && order.choferId === input.driverId)) {
      throw new AppError("El chofer no está disponible");
    }

    const updatedOrder = await this.ordersRepository.assignDriver({
      orderId, driverId: input.driverId, assignedByUserId, assignedByRole,
    });

    const orderDto = toOrderDetailDto(updatedOrder);
    const io = getIO();
    io.to("operators").emit("pedido:actualizado", orderDto);
    io.to(`driver:${driver.userId}`).emit("viaje:assigned", { viajeId: updatedOrder.id, pedido: orderDto });

    logOrderAction("assignDriver", {
      requestId: updatedOrder.id,
      userId: assignedByUserId,
      role: assignedByRole,
      orderId: updatedOrder.id,
      driverId: input.driverId,
      fromEstado: "PENDIENTE",
      toEstado: "ASIGNADO",
      success: true,
    });

    incrementPedidoAsignado();
    return updatedOrder;
  }

  async acceptOrder(orderId: string, driverUserId: string) {
    const driver = await this.getDriverByUserId(driverUserId);
    const order = await this.ordersRepository.findById(orderId);

    if (!order) throw new NotFoundError("Pedido no encontrado");
    // IDEMPOTENCIA: permitir si ya está aceptado por este chofer
    if (order.estado !== EstadoPedido.ASIGNADO && !(order.estado === EstadoPedido.ACEPTADO && order.choferId === driver.id)) {
      throw new AppError("El pedido no está en estado ASIGNADO");
    }
    if (order.choferId !== driver.id) throw new AppError("Este chofer no está asignado a este pedido");

    const updatedOrder = await this.ordersRepository.acceptOrder({
      orderId, driverId: driver.id, userId: driver.userId,
    });

    const orderDto = toOrderDetailDto(updatedOrder);
    const io = getIO();
    io.to("operators").emit("pedido:actualizado", orderDto);
    io.to(`driver:${driver.userId}`).emit("viaje:accepted", { viajeId: updatedOrder.id, pedido: orderDto });

    logOrderAction("acceptOrder", {
      requestId: updatedOrder.id,
      userId: driver.userId,
      role: "DRIVER",
      orderId: updatedOrder.id,
      driverId: driver.id,
      fromEstado: "ASIGNADO",
      toEstado: "ACEPTADO",
      success: true,
    });

    incrementPedidoAceptado();
    return updatedOrder;
  }

  async rejectOrder(orderId: string, driverUserId: string, motivoRechazo: string) {
    const driver = await this.getDriverByUserId(driverUserId);
    const order = await this.ordersRepository.findById(orderId);

    if (!order) throw new NotFoundError("Pedido no encontrado");
    // IDEMPOTENCIA: permitir si ya está PENDIENTE (sin chofer)
    if (order.estado !== EstadoPedido.ASIGNADO && !(order.estado === EstadoPedido.PENDIENTE && order.choferId === null)) {
      throw new AppError("El pedido no está en estado ASIGNADO");
    }
    // IDEMPOTENCIA: permitir si el chofer ya no está asignado
    if (order.choferId !== driver.id && order.choferId !== null) {
      throw new AppError("Este chofer no está asignado a este pedido");
    }

    const updatedOrder = await this.ordersRepository.rejectOrder({
      orderId, driverId: driver.id, userId: driver.userId, motivoRechazo,
    });

    const orderDto = toOrderDetailDto(updatedOrder);
    const io = getIO();
    io.to("operators").emit("pedido:actualizado", orderDto);
    io.to(`driver:${driver.userId}`).emit("viaje:rejected", { viajeId: updatedOrder.id, pedido: orderDto, motivo: motivoRechazo });

    logOrderAction("rejectOrder", {
      requestId: updatedOrder.id,
      userId: driver.userId,
      role: "DRIVER",
      orderId: updatedOrder.id,
      driverId: driver.id,
      fromEstado: "ASIGNADO",
      toEstado: "PENDIENTE",
      success: true,
    });

    incrementPedidoRechazado();
    return updatedOrder;
  }

  async onTheWayOrder(orderId: string, driverUserId: string) {
    const driver = await this.getDriverByUserId(driverUserId);
    const order = await this.ordersRepository.findById(orderId);

    if (!order) throw new NotFoundError("Pedido no encontrado");
    // IDEMPOTENCIA: permitir si ya está en camino
    if (order.estado !== EstadoPedido.ACEPTADO && order.estado !== EstadoPedido.EN_CAMINO) {
      throw new AppError("El pedido no está en estado ACEPTADO");
    }
    if (order.choferId !== driver.id) throw new AppError("Este chofer no está asignado a este pedido");

    const updatedOrder = await this.ordersRepository.onTheWayOrder({ orderId, userId: driver.userId });

    const orderDto = toOrderDetailDto(updatedOrder);
    const io = getIO();
    io.to("operators").emit("pedido:actualizado", orderDto);
    io.to(`driver:${driver.userId}`).emit("viaje:on-the-way", { viajeId: updatedOrder.id, pedido: orderDto });

    return updatedOrder;
  }

  async startOrder(orderId: string, driverUserId: string) {
    const driver = await this.getDriverByUserId(driverUserId);
    const order = await this.ordersRepository.findById(orderId);

    if (!order) throw new NotFoundError("Pedido no encontrado");
    // IDEMPOTENCIA: permitir si ya está en viaje
    if (order.estado !== EstadoPedido.EN_CAMINO && order.estado !== EstadoPedido.EN_VIAJE) {
      throw new AppError("El pedido no está en estado EN_CAMINO");
    }
    if (order.choferId !== driver.id) throw new AppError("Este chofer no está asignado a este pedido");

    const updatedOrder = await this.ordersRepository.startOrder({ orderId, userId: driver.userId });

    const orderDto = toOrderDetailDto(updatedOrder);
    const io = getIO();
    io.to("operators").emit("pedido:actualizado", orderDto);
    io.to(`driver:${driver.userId}`).emit("viaje:started", { viajeId: updatedOrder.id, pedido: orderDto });

    return updatedOrder;
  }

  async finishOrder(
    orderId: string, driverUserId: string,
    montoFinal: number, metodoPago: "EFECTIVO" | "TRANSFERENCIA" | "TARJETA"
  ) {
    const driver = await this.getDriverByUserId(driverUserId);
    const order = await this.ordersRepository.findById(orderId);

    if (!order) throw new NotFoundError("Pedido no encontrado");
    // IDEMPOTENCIA: permitir si ya está completado
    if (order.estado !== EstadoPedido.EN_VIAJE && order.estado !== EstadoPedido.COMPLETADO) {
      throw new AppError("El pedido no está en estado EN_VIAJE");
    }
    if (order.choferId !== driver.id) throw new AppError("Este chofer no está asignado a este pedido");

    const updatedOrder = await this.ordersRepository.finishOrder({
      orderId, driverId: driver.id, userId: driver.userId, montoFinal, metodoPago,
    });

    const orderDto = toOrderDetailDto(updatedOrder);
    const io = getIO();
    io.to("operators").emit("pedido:actualizado", orderDto);
    io.to(`driver:${driver.userId}`).emit("viaje:completed", { viajeId: updatedOrder.id, pedido: orderDto });

    logOrderAction("finishOrder", {
      requestId: updatedOrder.id,
      userId: driver.userId,
      role: "DRIVER",
      orderId: updatedOrder.id,
      driverId: driver.id,
      fromEstado: "EN_VIAJE",
      toEstado: "COMPLETADO",
      success: true,
    });

    incrementPedidoCompletado();
    return updatedOrder;
  }

  async cancelOrder(
    orderId: string, input: CancelOrderInput,
    userId: string, rolUsuario: "ADMIN" | "OPERATOR"
  ) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) throw new NotFoundError("Pedido no encontrado");
    // La idempotencia se maneja en repository (si ya está cancelado, retorna éxito)
    // Solo verificamos que no esté completado (eso no se puede revertir)
    if (order.estado === EstadoPedido.COMPLETADO) throw new AppError("No se puede cancelar un pedido completado");

    const driver = order.choferId
      ? await prisma.driver.findUnique({ where: { id: order.choferId } })
      : null;

    const updatedOrder = await this.ordersRepository.cancelOrder({
      orderId, userId, rolUsuario, motivoCancelacion: input.motivoCancelacion,
    });

    const orderDto = toOrderDetailDto(updatedOrder);
    const io = getIO();
    io.to("operators").emit("pedido:actualizado", orderDto);

    logOrderAction("cancelOrder", {
      requestId: updatedOrder.id,
      userId,
      role: rolUsuario,
      orderId: updatedOrder.id,
      fromEstado: order.estado,
      toEstado: "CANCELADO",
      success: true,
    });

    incrementPedidoCancelado();

    if (driver) {
      io.to(`driver:${driver.userId}`).emit("viaje:cancelled", {
        viajeId: updatedOrder.id, pedido: orderDto, motivo: input.motivoCancelacion,
      });
    }

    return updatedOrder;
  }

  async rejectByOperator(
    orderId: string, input: RejectByOperatorInput,
    userId: string, rolUsuario: "ADMIN" | "OPERATOR"
  ) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) throw new NotFoundError("Pedido no encontrado");
    if (order.estado !== EstadoPedido.PENDIENTE) throw new AppError("Solo se puede rechazar operativamente un pedido en estado PENDIENTE");

    const updatedOrder = await this.ordersRepository.rejectByOperator({
      orderId, userId, rolUsuario, motivoRechazo: input.motivoRechazo,
    });

    const orderDto = toOrderDetailDto(updatedOrder);
    getIO().to("operators").emit("pedido:actualizado", orderDto);

    return updatedOrder;
  }

  async getTopDrivers(filters: { desde?: string; hasta?: string }) {
    return this.ordersRepository.getTopDrivers(filters);
  }

  async getActiveTrips(authUser?: { userId: string; rol: string }) {
    const trips =
      authUser?.rol === "DRIVER"
        ? await this.ordersRepository.getActiveTripsByDriverUserId(authUser.userId)
        : await this.ordersRepository.getActiveTrips();

    return trips.map((trip) => ({
      id: trip.id,
      codigo: trip.codigo,
      estado: trip.estado,
      cliente: {
        nombre: trip.nombreCliente,
        telefono: trip.telefonoCliente,
      },
      viaje: {
        origen: trip.origenTexto,
        destino: trip.destinoTexto,
      },
      chofer: trip.chofer
        ? {
            id: trip.chofer.id,
            nombre: trip.chofer.user?.nombre ?? null,
            apellido: trip.chofer.user?.apellido ?? null,
            telefono: trip.chofer.user?.telefono ?? null,
            vehiculoMarca: trip.chofer.vehiculoMarca,
            vehiculoModelo: trip.chofer.vehiculoModelo,
            patente: trip.chofer.patente,
            latitud: trip.chofer.latitud,
            longitud: trip.chofer.longitud,
          }
        : null,
      timestamps: {
        asignadoAt: trip.asignadoAt,
        aceptadoAt: trip.aceptadoAt,
        enCaminoAt: trip.enCaminoAt,
        iniciadoAt: trip.iniciadoAt,
      },
    }));
  }

  async unassignDriver(
    orderId: string, userId: string,
    rolUsuario: "ADMIN" | "OPERATOR", motivo?: string
  ) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) throw new NotFoundError("Pedido no encontrado");
    // IDEMPOTENCIA: permitir si ya está PENDIENTE (sin chofer)
    if (order.estado !== EstadoPedido.ASIGNADO && !(order.estado === EstadoPedido.PENDIENTE && order.choferId === null)) {
      throw new AppError("El pedido no está en estado ASIGNADO");
    }
    // IDEMPOTENCIA: si ya está sin chofer, retornar éxito
    if (!order.choferId) {
      return order;
    }

    const driver = await prisma.driver.findUnique({ where: { id: order.choferId } });

    const updatedOrder = await this.ordersRepository.unassignDriver({
      orderId, driverId: order.choferId, userId, rolUsuario, motivo,
    });

    const orderDto = toOrderDetailDto(updatedOrder);
    const io = getIO();
    io.to("operators").emit("pedido:actualizado", orderDto);

    if (driver) {
      // FIX Bug 1: emitir viaje:unassigned (no viaje:cancelled) para que el frontend
      // pueda diferenciar entre desasignación y cancelación del pedido.
      io.to(`driver:${driver.userId}`).emit("viaje:unassigned", {
        viajeId: updatedOrder.id, pedido: orderDto, motivo: motivo || "Pedido desasignado",
      });
    }

    return updatedOrder;
  }

  async getMyHistory(userId: string, limit = 10) {
    // FIX: validar que limit sea un número válido
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 10;

    const driver = await prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundError("Driver no encontrado");

    const orders = await this.ordersRepository.getDriverHistory(driver.id, userId, safeLimit);

    return orders.map((order) => {
      const rejectionLog = order.statusLogs?.[0] ?? null;
      const estadoActual = order.estado;
      const eventoHistorial = rejectionLog ? "RECHAZADO_POR_CHOFER" : null;

      return {
        id: order.id,
        codigo: order.codigo,
        estado: estadoActual,
        estadoActual,
        eventoHistorial,
        rechazadoPorChofer: Boolean(rejectionLog),
        origen: order.origenTexto,
        destino: order.destinoTexto,
        observaciones: order.observaciones,
        motivoRechazo: rejectionLog?.nota || order.motivoRechazo || null,
        motivoCancelacion: order.motivoCancelacion,
        montoFinal: order.montoFinal,
        metodoPago: order.metodoPago,
        fecha: order.completadoAt || order.canceladoAt || rejectionLog?.createdAt || order.updatedAt || null,
      };
    });
  }

  async finishOrderByOperator(
    orderId: string, userId: string, rolUsuario: "ADMIN" | "OPERATOR",
    montoFinal: number, metodoPago: "EFECTIVO" | "TRANSFERENCIA" | "TARJETA", nota?: string
  ) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) throw new NotFoundError("Pedido no encontrado");

    const validStates = ["ACEPTADO", "EN_CAMINO", "EN_VIAJE"] as const;
    if (!validStates.includes(order.estado as any)) {
      throw new AppError("Solo se puede finalizar en ACEPTADO, EN_CAMINO o EN_VIAJE");
    }
    if (!order.choferId) throw new AppError("El pedido no tiene chofer");

    const driver = await prisma.driver.findUnique({ where: { id: order.choferId } });

    const updatedOrder = await this.ordersRepository.finishOrderByOperator({
      orderId, driverId: order.choferId, userId, rolUsuario, montoFinal, metodoPago, nota,
    });

    const orderDto = toOrderDetailDto(updatedOrder);
    const io = getIO();
    io.to("operators").emit("pedido:actualizado", orderDto);

    if (driver) {
      io.to(`driver:${driver.userId}`).emit("viaje:completed", { viajeId: updatedOrder.id, pedido: orderDto });
    }

    return updatedOrder;
  }

  async getDashboardStats(filters: { desde?: string; hasta?: string }) {
    return this.ordersRepository.getDashboardStats(filters);
  }

  async getOrderStatusLogs(orderId: string) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) throw new NotFoundError("Pedido no encontrado");

    return prisma.orderStatusLog.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        orderId: true,
        estadoAnterior: true,
        estadoNuevo: true,
        userId: true,
        rolUsuario: true,
        nota: true,
        createdAt: true,
      },
    });
  }

  async getOrderTimeline(orderId: string) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) throw new NotFoundError("Pedido no encontrado");

    const logs = await prisma.orderStatusLog.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        orderId: true,
        estadoAnterior: true,
        estadoNuevo: true,
        userId: true,
        rolUsuario: true,
        nota: true,
        createdAt: true,
      },
    });

    const usuario = await prisma.user.findUnique({
      where: { id: order.creadoPorUserId ?? undefined },
      select: { nombre: true, apellido: true },
    });

    const chofer = order.choferId
      ? await prisma.driver.findUnique({
          where: { id: order.choferId },
          include: { user: { select: { nombre: true, apellido: true } } },
        })
      : null;

    const timeline = {
      pedido: {
        id: order.id,
        codigo: order.codigo,
        estado: order.estado,
        nombreCliente: order.nombreCliente,
        telefonoCliente: order.telefonoCliente,
        origenTexto: order.origenTexto,
        destinoTexto: order.destinoTexto,
      },
      creadoPor: usuario ? `${usuario.nombre} ${usuario.apellido}` : null,
      chofer: chofer ? `${chofer.user.nombre} ${chofer.user.apellido}` : null,
      timestamps: {
        creado: order.createdAt,
        asignado: order.asignadoAt,
        aceptado: order.aceptadoAt,
        enCamino: order.enCaminoAt,
        iniciado: order.iniciadoAt,
        completado: order.completadoAt,
        cancelado: order.canceladoAt,
      },
      logs: logs.map((log) => ({
        action: `${log.estadoAnterior} → ${log.estadoNuevo}`,
        actor: log.rolUsuario,
        nota: log.nota,
        timestamp: log.createdAt,
      })),
    };

    return timeline;
  }
}
