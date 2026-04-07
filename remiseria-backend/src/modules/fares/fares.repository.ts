import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";

export class FaresRepository {
  async getActive() {
    return prisma.fareSetting.findFirst({ where: { activo: true }, orderBy: { createdAt: "desc" } });
  }

  async list() {
    return prisma.fareSetting.findMany({ orderBy: { createdAt: "desc" } });
  }

  async create(data: Prisma.FareSettingCreateInput) {
    return prisma.fareSetting.create({ data });
  }

  async update(id: string, data: Prisma.FareSettingUpdateInput) {
    return prisma.fareSetting.update({ where: { id }, data });
  }

  async setActive(id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.fareSetting.updateMany({ where: { activo: true }, data: { activo: false } });
      return tx.fareSetting.update({ where: { id }, data: { activo: true } });
    });
  }
}
