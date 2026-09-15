-- DNC-T1: devoluciones parciales de ventas + nota de crédito.
-- Incluye: Anticipo.contratoId pasa a opcional (saldos a favor sin contrato),
-- ContextoAnticipo.NOTA_CREDITO y las tablas devoluciones_venta(+_items).

-- CreateEnum
CREATE TYPE "EstadoDevolucion" AS ENUM ('REGISTRADA', 'ANULADA');

-- AlterEnum
ALTER TYPE "ContextoAnticipo" ADD VALUE 'NOTA_CREDITO';

-- DropForeignKey
ALTER TABLE "Anticipo" DROP CONSTRAINT "Anticipo_contratoId_fkey";

-- AlterTable
ALTER TABLE "Anticipo" ALTER COLUMN "contratoId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "devoluciones_venta" (
    "devolucionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "estado" "EstadoDevolucion" NOT NULL DEFAULT 'REGISTRADA',
    "motivo" TEXT,
    "subtotal" INTEGER NOT NULL,
    "descuento" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CUP',
    "tasaCambio" DECIMAL(65,30),
    "facturaNotaCreditoId" TEXT,
    "anticipoId" TEXT,
    "turnoReembolsoId" TEXT,
    "montoAplicadoCxc" INTEGER NOT NULL DEFAULT 0,
    "montoSaldoFavor" INTEGER NOT NULL DEFAULT 0,
    "montoReembolsado" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devoluciones_venta_pkey" PRIMARY KEY ("devolucionId")
);

-- CreateTable
CREATE TABLE "devoluciones_venta_items" (
    "id" TEXT NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "ventaItemId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "costoUnitarioDevolucion" INTEGER NOT NULL,
    "tipoUbicacion" TEXT NOT NULL,
    "ubicacionId" TEXT NOT NULL,

    CONSTRAINT "devoluciones_venta_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_venta_facturaNotaCreditoId_key" ON "devoluciones_venta"("facturaNotaCreditoId");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_venta_anticipoId_key" ON "devoluciones_venta"("anticipoId");

-- CreateIndex
CREATE INDEX "devoluciones_venta_tenantId_ventaId_idx" ON "devoluciones_venta"("tenantId", "ventaId");

-- CreateIndex
CREATE INDEX "devoluciones_venta_tenantId_turnoReembolsoId_idx" ON "devoluciones_venta"("tenantId", "turnoReembolsoId");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_venta_tenantId_idempotencyKey_key" ON "devoluciones_venta"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "devoluciones_venta_items_ventaItemId_idx" ON "devoluciones_venta_items"("ventaItemId");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_venta_items_devolucionId_ventaItemId_key" ON "devoluciones_venta_items"("devolucionId", "ventaItemId");

-- AddForeignKey
ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("contratoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_venta" ADD CONSTRAINT "devoluciones_venta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("ventaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_venta" ADD CONSTRAINT "devoluciones_venta_facturaNotaCreditoId_fkey" FOREIGN KEY ("facturaNotaCreditoId") REFERENCES "facturas"("idFactura") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_venta" ADD CONSTRAINT "devoluciones_venta_anticipoId_fkey" FOREIGN KEY ("anticipoId") REFERENCES "Anticipo"("anticipoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_venta" ADD CONSTRAINT "devoluciones_venta_turnoReembolsoId_fkey" FOREIGN KEY ("turnoReembolsoId") REFERENCES "turnos_punto_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_venta" ADD CONSTRAINT "devoluciones_venta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_venta_items" ADD CONSTRAINT "devoluciones_venta_items_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "devoluciones_venta"("devolucionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_venta_items" ADD CONSTRAINT "devoluciones_venta_items_ventaItemId_fkey" FOREIGN KEY ("ventaItemId") REFERENCES "venta_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
