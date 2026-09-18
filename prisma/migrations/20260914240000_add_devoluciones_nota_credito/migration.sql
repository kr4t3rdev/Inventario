-- DNC-T1: devoluciones parciales de ventas + nota de crédito.
-- Incluye: Anticipo.contratoId pasa a opcional (saldos a favor sin contrato),
-- ContextoAnticipo.NOTA_CREDITO y las tablas devoluciones_venta(+_items).

-- Repair the legacy Anticipo base. The model predates the tracked migration
-- history, so a fresh CI database does not have these types or tables yet.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type
        WHERE typname = 'TipoAnticipo' AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE "TipoAnticipo" AS ENUM ('PAGO', 'COBRO');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_type
        WHERE typname = 'EstadoAnticipo' AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE "EstadoAnticipo" AS ENUM ('RESERVADO', 'EJECUTADO', 'ANULADO');
    END IF;
END $$;

-- CreateEnum
CREATE TYPE "EstadoDevolucion" AS ENUM ('REGISTRADA', 'ANULADA');

-- Repair the legacy enum before extending it. Older environments have the
-- Anticipo model but not the enum migration, while fresh CI databases need
-- the complete enum definition before the DNC tables are created.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'ContextoAnticipo'
          AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE "ContextoAnticipo" AS ENUM (
            'COMPRA_PRODUCTO',
            'COMPRA_SERVICIO',
            'FACTURA_OFERTA',
            'FACTURA_DIRECTA',
            'NOTA_CREDITO'
        );
    ELSE
        ALTER TYPE "ContextoAnticipo" ADD VALUE IF NOT EXISTS 'NOTA_CREDITO';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Anticipo" (
    "anticipoId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoAnticipo" NOT NULL,
    "estado" "EstadoAnticipo" NOT NULL DEFAULT 'RESERVADO',
    "contratoId" TEXT,
    "proveedorId" TEXT,
    "clienteId" TEXT,
    "facturaId" TEXT,
    "compraProductoId" TEXT,
    "montoOriginal" DECIMAL(65,30) NOT NULL,
    "saldoDisponible" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CUP',
    "cuentaOrigenId" TEXT,
    "tipoPagoOrigenId" TEXT,
    "referenciaExterna" TEXT,
    "vigenciaHasta" TIMESTAMP(3),
    "fechaReserva" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEjecucion" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Anticipo_pkey" PRIMARY KEY ("anticipoId")
);

CREATE TABLE IF NOT EXISTS "AnticipoMovimiento" (
    "movimientoId" TEXT NOT NULL,
    "anticipoId" TEXT NOT NULL,
    "tipoMovimiento" TEXT NOT NULL,
    "contexto" "ContextoAnticipo",
    "documentoDestinoId" TEXT,
    "reconciliacionVentaId" TEXT,
    "reconciliacionGastoId" TEXT,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL,
    "tasaAplicada" DECIMAL(65,30),
    "montoConvertido" DECIMAL(65,30),
    "saldoAntes" DECIMAL(65,30) NOT NULL,
    "saldoDespues" DECIMAL(65,30) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnticipoMovimiento_pkey" PRIMARY KEY ("movimientoId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Anticipo_facturaId_key" ON "Anticipo"("facturaId");
CREATE UNIQUE INDEX IF NOT EXISTS "Anticipo_compraProductoId_key" ON "Anticipo"("compraProductoId");
CREATE INDEX IF NOT EXISTS "Anticipo_tenantId_idx" ON "Anticipo"("tenantId");
CREATE INDEX IF NOT EXISTS "Anticipo_contratoId_idx" ON "Anticipo"("contratoId");
CREATE INDEX IF NOT EXISTS "Anticipo_proveedorId_idx" ON "Anticipo"("proveedorId");
CREATE INDEX IF NOT EXISTS "Anticipo_clienteId_idx" ON "Anticipo"("clienteId");
CREATE INDEX IF NOT EXISTS "Anticipo_estado_idx" ON "Anticipo"("estado");
CREATE INDEX IF NOT EXISTS "Anticipo_tipo_idx" ON "Anticipo"("tipo");
CREATE UNIQUE INDEX IF NOT EXISTS "AnticipoMovimiento_anticipoId_idempotencyKey_key"
    ON "AnticipoMovimiento"("anticipoId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "AnticipoMovimiento_anticipoId_createdAt_idx"
    ON "AnticipoMovimiento"("anticipoId", "createdAt");
CREATE INDEX IF NOT EXISTS "AnticipoMovimiento_documentoDestinoId_idx"
    ON "AnticipoMovimiento"("documentoDestinoId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Anticipo_tenantId_fkey') THEN
        ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Anticipo_contratoId_fkey') THEN
        ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_contratoId_fkey"
            FOREIGN KEY ("contratoId") REFERENCES "Contrato"("contratoId") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Anticipo_clienteId_fkey') THEN
        ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_clienteId_fkey"
            FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Anticipo_compraProductoId_fkey') THEN
        ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_compraProductoId_fkey"
            FOREIGN KEY ("compraProductoId") REFERENCES "CompraProducto"("compraProductoId") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Anticipo_facturaId_fkey') THEN
        ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_facturaId_fkey"
            FOREIGN KEY ("facturaId") REFERENCES "facturas"("idFactura") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Anticipo_proveedorId_fkey') THEN
        ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_proveedorId_fkey"
            FOREIGN KEY ("proveedorId") REFERENCES "Vendor"("vendorId") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Anticipo_creador_fkey') THEN
        ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_creador_fkey"
            FOREIGN KEY ("createdById") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AnticipoMovimiento_anticipoId_fkey') THEN
        ALTER TABLE "AnticipoMovimiento" ADD CONSTRAINT "AnticipoMovimiento_anticipoId_fkey"
            FOREIGN KEY ("anticipoId") REFERENCES "Anticipo"("anticipoId") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- DropForeignKey
ALTER TABLE "Anticipo" DROP CONSTRAINT IF EXISTS "Anticipo_contratoId_fkey";

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
