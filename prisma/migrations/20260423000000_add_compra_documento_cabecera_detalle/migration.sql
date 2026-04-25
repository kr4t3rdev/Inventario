-- Idempotent: Add soft delete and audit fields to CompraProducto (skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CompraProducto' AND column_name = 'deletedAt') THEN
    ALTER TABLE "CompraProducto" ADD COLUMN "deletedAt" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CompraProducto' AND column_name = 'updatedById') THEN
    ALTER TABLE "CompraProducto" ADD COLUMN "updatedById" TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CompraProducto_deletedAt_idx" ON "CompraProducto"("deletedAt");

-- AlterTable: Add soft delete to GastoCompra
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'GastoCompra' AND column_name = 'deletedAt') THEN
    ALTER TABLE "GastoCompra" ADD COLUMN "deletedAt" TIMESTAMP(3);
  END IF;
END $$;

-- AlterTable: Add soft delete to CuentaPorPagar
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CuentaPorPagar' AND column_name = 'deletedAt') THEN
    ALTER TABLE "CuentaPorPagar" ADD COLUMN "deletedAt" TIMESTAMP(3);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CuentaPorPagar_deletedAt_idx" ON "CuentaPorPagar"("deletedAt");

-- CreateTable: CompraDocumento (cabecera de compra multiple)
CREATE TABLE IF NOT EXISTS "CompraDocumento" (
    "compraDocumentoId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "numeroFactura" TEXT NOT NULL DEFAULT '',
    "facturaUrl" TEXT NOT NULL DEFAULT '',
    "formaPago" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "tipoOperacion" TEXT NOT NULL DEFAULT 'REGULAR',
    "descripcion" TEXT,
    "fechaCompra" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" INTEGER NOT NULL DEFAULT 0,
    "gastoCompraId" TEXT,
    "cuentaPorPagarId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompraDocumento_pkey" PRIMARY KEY ("compraDocumentoId")
);

-- CreateTable: CompraDocumentoItem (lineas de detalle)
CREATE TABLE IF NOT EXISTS "CompraDocumentoItem" (
    "compraDocumentoItemId" TEXT NOT NULL,
    "compraDocumentoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "totalLinea" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompraDocumentoItem_pkey" PRIMARY KEY ("compraDocumentoItemId")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "CompraDocumento_gastoCompraId_key" ON "CompraDocumento"("gastoCompraId");
CREATE UNIQUE INDEX IF NOT EXISTS "CompraDocumento_cuentaPorPagarId_key" ON "CompraDocumento"("cuentaPorPagarId");
CREATE INDEX IF NOT EXISTS "CompraDocumento_estado_idx" ON "CompraDocumento"("estado");
CREATE INDEX IF NOT EXISTS "CompraDocumento_proveedorId_idx" ON "CompraDocumento"("proveedorId");
CREATE INDEX IF NOT EXISTS "CompraDocumento_fechaCompra_idx" ON "CompraDocumento"("fechaCompra");
CREATE INDEX IF NOT EXISTS "CompraDocumento_deletedAt_idx" ON "CompraDocumento"("deletedAt");
CREATE INDEX IF NOT EXISTS "CompraDocumentoItem_compraDocumentoId_idx" ON "CompraDocumentoItem"("compraDocumentoId");
CREATE INDEX IF NOT EXISTS "CompraDocumentoItem_productoId_idx" ON "CompraDocumentoItem"("productoId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CompraDocumento_proveedorId_fkey') THEN
    ALTER TABLE "CompraDocumento" ADD CONSTRAINT "CompraDocumento_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Vendor"("vendorId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CompraDocumento_gastoCompraId_fkey') THEN
    ALTER TABLE "CompraDocumento" ADD CONSTRAINT "CompraDocumento_gastoCompraId_fkey" FOREIGN KEY ("gastoCompraId") REFERENCES "GastoCompra"("gastoCompraId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CompraDocumento_cuentaPorPagarId_fkey') THEN
    ALTER TABLE "CompraDocumento" ADD CONSTRAINT "CompraDocumento_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "CuentaPorPagar"("cuentaPorPagarId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CompraDocumento_updatedById_fkey') THEN
    ALTER TABLE "CompraDocumento" ADD CONSTRAINT "CompraDocumento_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CompraDocumentoItem_compraDocumentoId_fkey') THEN
    ALTER TABLE "CompraDocumentoItem" ADD CONSTRAINT "CompraDocumentoItem_compraDocumentoId_fkey" FOREIGN KEY ("compraDocumentoId") REFERENCES "CompraDocumento"("compraDocumentoId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CompraDocumentoItem_productoId_fkey') THEN
    ALTER TABLE "CompraDocumentoItem" ADD CONSTRAINT "CompraDocumentoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;