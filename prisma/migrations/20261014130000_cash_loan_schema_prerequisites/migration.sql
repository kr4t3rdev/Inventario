-- Close the main migration-history gap required by the existing cash-loan Prisma models.
ALTER TABLE "ReconciliacionVenta"
  ADD COLUMN "deudaCashId" TEXT,
  ADD COLUMN "prestamoCashId" TEXT,
  ADD COLUMN "tipoReconciliacion" TEXT,
  ALTER COLUMN "ventaId" DROP NOT NULL;

CREATE TABLE "DeudaCash" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "idNumerico" SERIAL NOT NULL,
  "proveedorId" TEXT NOT NULL,
  "cuentaPorPagarId" TEXT NOT NULL,
  "montoCapital" DECIMAL(65,30) NOT NULL,
  "moneda" TEXT NOT NULL DEFAULT 'CUP',
  "tasaInteres" DECIMAL(65,30),
  "fechaVencimiento" TIMESTAMP(3),
  "observaciones" TEXT,
  "createdById" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "comprobanteUrl" TEXT,
  "cuentaBancariaId" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
  CONSTRAINT "DeudaCash_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrestamoCash" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "idNumerico" SERIAL NOT NULL,
  "clienteId" TEXT NOT NULL,
  "cuentaPorCobrarId" TEXT NOT NULL,
  "montoCapital" DECIMAL(65,30) NOT NULL,
  "moneda" TEXT NOT NULL DEFAULT 'CUP',
  "tasaInteres" DECIMAL(65,30),
  "fechaOtorgamiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaVencimiento" TIMESTAMP(3),
  "observaciones" TEXT,
  "createdById" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tasaCambioAlCrear" DECIMAL(65,30),
  "cuentaBancariaId" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
  CONSTRAINT "PrestamoCash_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeudaCash_cuentaPorPagarId_key" ON "DeudaCash"("cuentaPorPagarId");
CREATE INDEX "DeudaCash_tenantId_idx" ON "DeudaCash"("tenantId");
CREATE INDEX "DeudaCash_proveedorId_idx" ON "DeudaCash"("proveedorId");
CREATE INDEX "DeudaCash_estado_idx" ON "DeudaCash"("estado");

CREATE UNIQUE INDEX "PrestamoCash_cuentaPorCobrarId_key" ON "PrestamoCash"("cuentaPorCobrarId");
CREATE INDEX "PrestamoCash_tenantId_idx" ON "PrestamoCash"("tenantId");
CREATE INDEX "PrestamoCash_clienteId_idx" ON "PrestamoCash"("clienteId");
CREATE INDEX "PrestamoCash_estado_idx" ON "PrestamoCash"("estado");

ALTER TABLE "ReconciliacionVenta"
  ADD CONSTRAINT "ReconciliacionVenta_deudaCashId_fkey"
  FOREIGN KEY ("deudaCashId") REFERENCES "DeudaCash"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ReconciliacionVenta_prestamoCashId_fkey"
  FOREIGN KEY ("prestamoCashId") REFERENCES "PrestamoCash"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeudaCash"
  ADD CONSTRAINT "DeudaCash_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DeudaCash_proveedorId_fkey"
  FOREIGN KEY ("proveedorId") REFERENCES "Vendor"("vendorId")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DeudaCash_cuentaPorPagarId_fkey"
  FOREIGN KEY ("cuentaPorPagarId") REFERENCES "CuentaPorPagar"("cuentaPorPagarId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrestamoCash"
  ADD CONSTRAINT "PrestamoCash_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PrestamoCash_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PrestamoCash_cuentaPorCobrarId_fkey"
  FOREIGN KEY ("cuentaPorCobrarId") REFERENCES "CuentaPorCobrar"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
