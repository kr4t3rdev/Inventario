/*
  Warnings:

  - You are about to drop the column `dcCodigo` on the `Servicios` table. All the data in the column will be lost.
  - You are about to drop the column `especificoCodigo` on the `Servicios` table. All the data in the column will be lost.
  - You are about to drop the column `idSeccionCodigo` on the `Servicios` table. All the data in the column will be lost.
  - You are about to drop the column `proveedorCodigo` on the `Servicios` table. All the data in the column will be lost.
  - You are about to drop the column `surtidoCodigo` on the `Servicios` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Servicios" DROP COLUMN "dcCodigo",
DROP COLUMN "especificoCodigo",
DROP COLUMN "idSeccionCodigo",
DROP COLUMN "proveedorCodigo",
DROP COLUMN "surtidoCodigo";
