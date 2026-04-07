import { FastifyBaseLogger } from "fastify";
import { prisma } from "./prisma";

const MAX_LOCATIONS_PER_DRIVER = 500; // ~1.4 horas de datos a 10s de intervalo

async function cleanOldDriverLocations(logger: FastifyBaseLogger) {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 24);

  const { count } = await prisma.driverLocation.deleteMany({
    where: { recordedAt: { lt: cutoff } },
  });

  if (count > 0) {
    logger.info({ count }, "[jobs] Eliminados registros de ubicación antiguos");
  }
}

async function capDriverLocationsByDriver(logger: FastifyBaseLogger) {
  const deleted = await prisma.$executeRaw`
    DELETE FROM "DriverLocation" dl
    USING (
      SELECT id
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "driverId"
            ORDER BY "recordedAt" DESC, id DESC
          ) AS rn
        FROM "DriverLocation"
      ) ranked
      WHERE ranked.rn > ${MAX_LOCATIONS_PER_DRIVER}
    ) excess
    WHERE dl.id = excess.id
  `;

  if (deleted > 0) {
    logger.info({ deleted }, "[jobs] Recorte de ubicaciones ejecutado");
  }
}

async function cleanExpiredRefreshTokens(logger: FastifyBaseLogger) {
  const { count } = await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
    },
  });

  if (count > 0) {
    logger.info({ count }, "[jobs] Eliminados refresh tokens expirados");
  }
}

export function startJobs(logger: FastifyBaseLogger) {
  setInterval(async () => {
    try {
      await cleanOldDriverLocations(logger);
      await cleanExpiredRefreshTokens(logger);
    } catch (err) {
      logger.error({ err }, "[jobs] Error en limpieza horaria");
    }
  }, 60 * 60 * 1000);

  setInterval(async () => {
    try {
      await capDriverLocationsByDriver(logger);
    } catch (err) {
      logger.error({ err }, "[jobs] Error en recorte de ubicaciones");
    }
  }, 15 * 60 * 1000);

  logger.info("[jobs] Jobs de limpieza iniciados");
}
