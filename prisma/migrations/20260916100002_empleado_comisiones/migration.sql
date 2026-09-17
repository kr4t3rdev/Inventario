-- CMV-T1: porcentaje de comisión y meta mensual por empleado.

-- AlterTable
ALTER TABLE "Empleado" ADD COLUMN     "comisionPct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "metaMensual" INTEGER NOT NULL DEFAULT 0;
