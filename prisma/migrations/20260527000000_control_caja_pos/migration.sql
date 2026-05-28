-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('ABIERTO', 'CERRADO');
CREATE TYPE "MetodoPagoVenta" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CREDITO', 'MIXTO');

-- AlterTable
ALTER TABLE "PuntoDeVenta" ADD COLUMN "almacenId" TEXT,
ADD COLUMN "cuentaContableId" TEXT,
ADD COLUMN "tipoCaja" TEXT DEFAULT 'PRINCIPAL';

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN "metodoPago" "MetodoPagoVenta",
ADD COLUMN "montoCredito" INTEGER,
ADD COLUMN "montoEfectivo" INTEGER,
ADD COLUMN "montoTarjeta" INTEGER,
ADD COLUMN "montoTransferencia" INTEGER,
ADD COLUMN "turnoId" TEXT;

-- CreateTable
CREATE TABLE "turnos_punto_venta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "puntoDeVentaId" TEXT NOT NULL,
    "empleadoId" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'NORMAL',
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "fondoInicialCup" INTEGER NOT NULL DEFAULT 0,
    "fondoInicialUsd" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoTurno" NOT NULL DEFAULT 'ABIERTO',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "turnos_punto_venta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "arqueos_caja" (
    "id" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "puntoDeVentaId" TEXT NOT NULL,
    "billetes1000Cup" INTEGER NOT NULL DEFAULT 0,
    "billetes500Cup" INTEGER NOT NULL DEFAULT 0,
    "billetes200Cup" INTEGER NOT NULL DEFAULT 0,
    "billetes100Cup" INTEGER NOT NULL DEFAULT 0,
    "billetes50Cup" INTEGER NOT NULL DEFAULT 0,
    "billetes20Cup" INTEGER NOT NULL DEFAULT 0,
    "monedasCup" INTEGER NOT NULL DEFAULT 0,
    "billetes100Usd" INTEGER NOT NULL DEFAULT 0,
    "billetes50Usd" INTEGER NOT NULL DEFAULT 0,
    "billetes20Usd" INTEGER NOT NULL DEFAULT 0,
    "billetes10Usd" INTEGER NOT NULL DEFAULT 0,
    "billetes5Usd" INTEGER NOT NULL DEFAULT 0,
    "billetes1Usd" INTEGER NOT NULL DEFAULT 0,
    "monedasUsd" INTEGER NOT NULL DEFAULT 0,
    "totalEfectivoCup" INTEGER NOT NULL DEFAULT 0,
    "totalEfectivoUsd" INTEGER NOT NULL DEFAULT 0,
    "totalTarjeta" INTEGER NOT NULL DEFAULT 0,
    "totalTransferencia" INTEGER NOT NULL DEFAULT 0,
    "totalCredito" INTEGER NOT NULL DEFAULT 0,
    "esperadoEfectivoCup" INTEGER NOT NULL DEFAULT 0,
    "esperadoEfectivoUsd" INTEGER NOT NULL DEFAULT 0,
    "esperadoTarjeta" INTEGER NOT NULL DEFAULT 0,
    "esperadoTransferencia" INTEGER NOT NULL DEFAULT 0,
    "esperadoCredito" INTEGER NOT NULL DEFAULT 0,
    "diferenciaCup" INTEGER NOT NULL DEFAULT 0,
    "diferenciaUsd" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "contabilizado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "arqueos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "turnos_punto_venta_tenantId_idx" ON "turnos_punto_venta"("tenantId");
CREATE INDEX "turnos_punto_venta_puntoDeVentaId_fechaApertura_idx" ON "turnos_punto_venta"("puntoDeVentaId", "fechaApertura");
CREATE UNIQUE INDEX "arqueos_caja_turnoId_key" ON "arqueos_caja"("turnoId");
CREATE INDEX "arqueos_caja_tenantId_idx" ON "arqueos_caja"("tenantId");
CREATE INDEX "arqueos_caja_puntoDeVentaId_idx" ON "arqueos_caja"("puntoDeVentaId");
CREATE INDEX "Venta_turnoId_idx" ON "Venta"("turnoId");
CREATE UNIQUE INDEX idx_un_turno_abierto_por_pv ON turnos_punto_venta ("puntoDeVentaId") WHERE estado = 'ABIERTO';

-- AddForeignKey
ALTER TABLE "PuntoDeVenta" ADD CONSTRAINT "PuntoDeVenta_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("almacenId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "turnos_punto_venta" ADD CONSTRAINT "turnos_punto_venta_puntoDeVentaId_fkey" FOREIGN KEY ("puntoDeVentaId") REFERENCES "PuntoDeVenta"("pvId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "turnos_punto_venta" ADD CONSTRAINT "turnos_punto_venta_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("empleadoId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "turnos_punto_venta" ADD CONSTRAINT "turnos_punto_venta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "arqueos_caja" ADD CONSTRAINT "arqueos_caja_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos_punto_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arqueos_caja" ADD CONSTRAINT "arqueos_caja_puntoDeVentaId_fkey" FOREIGN KEY ("puntoDeVentaId") REFERENCES "PuntoDeVenta"("pvId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "arqueos_caja" ADD CONSTRAINT "arqueos_caja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos_punto_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
