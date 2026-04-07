import { EstadoChofer, RolUsuario } from "@prisma/client";
import { DriversRepository } from "./drivers.repository";
import { CreateDriverInput, UpdateMyLocationInput, UpdateMyStatusInput } from "./drivers.schemas";
import { getIO } from "../../lib/socket";
import { prisma } from "../../lib/prisma";
import { NotFoundError, AppError } from "../../lib/errors";

export class DriversService {
  constructor(private readonly driversRepository: DriversRepository) {}

  async createDriver(input: CreateDriverInput) {
    const user = await this.driversRepository.findUserById(input.userId);
    if (!user) throw new NotFoundError("Usuario no encontrado");
    if (user.rol !== RolUsuario.DRIVER) throw new AppError("El usuario no tiene rol DRIVER");

    const existingDriver = await this.driversRepository.findDriverByUserId(input.userId);
    if (existingDriver) throw new AppError("Ya existe un driver para este usuario");

    return this.driversRepository.create({
      estado: EstadoChofer.DISPONIBLE,
      vehiculoMarca: input.vehiculoMarca,
      vehiculoModelo: input.vehiculoModelo,
      vehiculoColor: input.vehiculoColor,
      patente: input.patente,
      licenciaNumero: input.licenciaNumero,
      licenciaVencimiento: input.licenciaVencimiento ? new Date(input.licenciaVencimiento) : undefined,
      user: { connect: { id: input.userId } },
    });
  }

  async listDrivers() {
    return this.driversRepository.list();
  }

  async getMe(userId: string) {
    const driver = await this.driversRepository.findDriverByUserId(userId);
    if (!driver) throw new NotFoundError("Driver no encontrado");
    return this.driversRepository.getMeByUserId(userId);
  }

  async updateMyLocation(userId: string, input: UpdateMyLocationInput) {
    const driver = await this.driversRepository.findDriverByUserId(userId);
    if (!driver) throw new NotFoundError("Driver no encontrado");

    const result = await this.driversRepository.updateMyLocation(driver.id, input);

    const timestamp = new Date().toISOString();
    const activeOrders = await prisma.order.findMany({
      where: {
        choferId: driver.id,
        estado: { in: ["ASIGNADO", "ACEPTADO", "EN_CAMINO", "EN_VIAJE"] },
      },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
      take: 2,
    });

    if (activeOrders.length > 1) {
      console.error(`[drivers] Chofer ${driver.id} con múltiples viajes activos al actualizar ubicación`);
    }

    const activeOrder = activeOrders[0] ?? null;

    const locationPayload = {
      driverId: driver.id,
      userId,
      viajeId: activeOrder?.id ?? null,
      lat: input.lat,
      lng: input.lng,
      speedKmh: input.speedKmh,
      heading: input.heading,
      timestamp,
    };

    const io = getIO();
    io.to("operators").emit("driver:location", locationPayload);

    if (activeOrder?.id) {
      io.to(`trip:${activeOrder.id}`).emit("viaje:positionUpdated", locationPayload);
    }

    return result;
  }

  async getMyLocation(userId: string) {
    const driver = await this.driversRepository.findDriverByUserId(userId);
    if (!driver) throw new NotFoundError("Driver no encontrado");
    return this.driversRepository.getMyLocation(driver.id);
  }

  async updateMyStatus(userId: string, input: UpdateMyStatusInput) {
    const driver = await this.driversRepository.findDriverByUserId(userId);
    if (!driver) throw new NotFoundError("Driver no encontrado");
    if (driver.estado === EstadoChofer.OCUPADO) throw new AppError("No se puede cambiar manualmente el estado de un chofer OCUPADO");
    return this.driversRepository.updateMyStatus(driver.id, input.estado);
  }
}
