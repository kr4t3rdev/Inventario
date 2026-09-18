-- AS-05 ola 3: denormalización de tenantId en InyeccionCapital, PagoDeuda y SaldoSnapshot.
-- Aditiva: columnas nullable + índices. Los tres modelos tienen writers con contexto
-- de tenant disponible (user o derivado de PeriodoContable).
--
-- InyeccionCapital → CuentaBancaria (scoped) → tenantId resoluble.
-- PagoDeuda → InyeccionCapital → CuentaBancaria → tenantId resoluble (cadena 2 hop).
-- SaldoSnapshot → PeriodoContable (scoped) → tenantId resoluble (1 hop).

ALTER TABLE "InyeccionCapital"
  ADD COLUMN "tenantId" TEXT;

CREATE INDEX "InyeccionCapital_tenantId_idx"
  ON "InyeccionCapital"("tenantId");

ALTER TABLE "PagoDeuda"
  ADD COLUMN "tenantId" TEXT;

CREATE INDEX "PagoDeuda_tenantId_idx"
  ON "PagoDeuda"("tenantId");

ALTER TABLE "saldos_snapshot"
  ADD COLUMN "tenantId" TEXT;

CREATE INDEX "SaldoSnapshot_tenantId_idx"
  ON "saldos_snapshot"("tenantId");
