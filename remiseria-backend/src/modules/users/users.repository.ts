import { prisma } from "../../lib/prisma";
import { Prisma, RolUsuario } from "@prisma/client";

type CreateUserData = {
  nombre: string;
  apellido: string;
  telefono: string;
  email?: string;
  passwordHash: string;
  rol: RolUsuario;
};

export class UsersRepository {
  async findByPhone(telefono: string) {
    return prisma.user.findUnique({
      where: { telefono },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: CreateUserData) {
    return prisma.user.create({
      data,
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
    });
  }

  async list() {
    return prisma.user.findMany({
      orderBy: { createdAt: "desc" },
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
    });
  }
}