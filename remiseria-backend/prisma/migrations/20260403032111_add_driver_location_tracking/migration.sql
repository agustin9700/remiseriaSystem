/*
  Warnings:

  - You are about to drop the column `activo` on the `Driver` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Driver" DROP CONSTRAINT "Driver_userId_fkey";

-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "activo",
ADD COLUMN     "latitud" DOUBLE PRECISION,
ADD COLUMN     "longitud" DOUBLE PRECISION,
ADD COLUMN     "ultimaUbicacionAt" TIMESTAMP(3),
ALTER COLUMN "estado" SET DEFAULT 'DISPONIBLE';

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
