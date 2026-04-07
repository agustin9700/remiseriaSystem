import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { UpdateMyLocationInput,UpdateMyStatusInput } from "./drivers.schemas";

export class DriversRepository {

  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async findDriverByUserId(userId: string) {
    return prisma.driver.findUnique({
      where: { userId },
    });
  }

  async create(data: Prisma.DriverCreateInput) {
    return prisma.driver.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            telefono: true,
            email: true,
            rol: true,
            activo: true,
          },
        },
      },
    });
  }

  async getMeByUserId(userId: string) {
    return prisma.driver.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            telefono: true,
            email: true,
            rol: true,
            activo: true,
          },
        },
      },
    });
  }

  async list() {
    return prisma.driver.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            telefono: true,
            email: true,
            rol: true,
            activo: true,
          },
        },
      },
    });
  }

  async updateMyLocation(driverId: string, input: UpdateMyLocationInput) {
    await prisma.driver.update({
      where: { id: driverId },
      data: {
        latitud: input.lat,
        longitud: input.lng,
        ultimaUbicacionAt: new Date(),
      },
    });

    await prisma.driverLocation.create({
      data: {
        driverId,
        lat: input.lat,
        lng: input.lng,
        speedKmh: input.speedKmh ?? null,
        heading: input.heading ?? null,
      },
    });

    return prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        latitud: true,
        longitud: true,
        ultimaUbicacionAt: true,
      },
    });
  }

  async getMyLocation(driverId: string) {
    return prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        latitud: true,
        longitud: true,
        ultimaUbicacionAt: true,
      },
    });
  }
  async updateMyStatus(driverId: string, estado: "DISPONIBLE" | "OFFLINE") {
    return prisma.driver.update({
      where: { id: driverId },
      data: {
        estado,
      },
      select: {
        id: true,
        estado: true,
        ultimaUbicacionAt: true,
        userId: true,
      },
    });
  }
  
}