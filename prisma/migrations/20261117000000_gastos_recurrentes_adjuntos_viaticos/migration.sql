ALTER TABLE "GastosDE"
  ADD COLUMN "empleadoId" TEXT,
  ADD COLUMN "gastoRecurrenteId" TEXT,
  ADD COLUMN "claveIdempotencia" TEXT;

CREATE TABLE "gastos_recurrentes" (
  "gastoRecurrenteId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "conceptoId" TEXT,
  "elementoId" TEXT,
  "proveedorId" TEXT,
  "empleadoId" TEXT,
  "monto" INTEGER NOT NULL,
  "moneda" TEXT NOT NULL DEFAULT 'CUP',
  "frecuencia" TEXT NOT NULL,
  "diaGeneracion" INTEGER NOT NULL,
  "proximaGeneracion" TIMESTAMP(3) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "notas" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gastos_recurrentes_pkey" PRIMARY KEY ("gastoRecurrenteId")
);

CREATE UNIQUE INDEX "Empleado_tenantId_empleadoId_key"
  ON "Empleado"("tenantId", "empleadoId");
CREATE UNIQUE INDEX "GastoConcepto_tenantId_conceptoId_key"
  ON "GastoConcepto"("tenantId", "conceptoId");
CREATE UNIQUE INDEX "GastoElemento_tenantId_elementoId_key"
  ON "GastoElemento"("tenantId", "elementoId");
CREATE UNIQUE INDEX "GastoElemento_tenantId_conceptoId_elementoId_key"
  ON "GastoElemento"("tenantId", "conceptoId", "elementoId");
CREATE UNIQUE INDEX "gastos_recurrentes_tenantId_gastoRecurrenteId_key"
  ON "gastos_recurrentes"("tenantId", "gastoRecurrenteId");
CREATE UNIQUE INDEX "GastosDE_tenantId_claveIdempotencia_key"
  ON "GastosDE"("tenantId", "claveIdempotencia");
CREATE INDEX "GastosDE_empleadoId_idx" ON "GastosDE"("empleadoId");
CREATE INDEX "gastos_recurrentes_tenantId_activo_idx"
  ON "gastos_recurrentes"("tenantId", "activo");
CREATE INDEX "gastos_recurrentes_tenantId_proximaGeneracion_idx"
  ON "gastos_recurrentes"("tenantId", "proximaGeneracion");

ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_concepto_fkey"
  FOREIGN KEY ("tenantId", "conceptoId") REFERENCES "GastoConcepto"("tenantId", "conceptoId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_elemento_fkey"
  FOREIGN KEY ("tenantId", "elementoId") REFERENCES "GastoElemento"("tenantId", "elementoId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_vendor_fkey"
  FOREIGN KEY ("tenantId", "proveedorId") REFERENCES "Vendor"("tenantId", "vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_empleado_fkey"
  FOREIGN KEY ("tenantId", "empleadoId") REFERENCES "Empleado"("tenantId", "empleadoId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GastosDE" ADD CONSTRAINT "GastosDE_empleado_fkey"
  FOREIGN KEY ("tenantId", "empleadoId") REFERENCES "Empleado"("tenantId", "empleadoId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GastosDE" ADD CONSTRAINT "GastosDE_recurrente_fkey"
  FOREIGN KEY ("tenantId", "gastoRecurrenteId") REFERENCES "gastos_recurrentes"("tenantId", "gastoRecurrenteId") ON DELETE RESTRICT ON UPDATE CASCADE;
