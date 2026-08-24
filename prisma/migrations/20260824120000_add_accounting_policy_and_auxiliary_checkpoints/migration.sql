-- Política explícita de moneda funcional por tenant (nullable por ausencia de fila).
CREATE TABLE "tenant_accounting_policies" (
  "tenantId" TEXT NOT NULL,
  "functionalCurrencyCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT NOT NULL,
  CONSTRAINT "tenant_accounting_policies_pkey" PRIMARY KEY ("tenantId")
);

CREATE INDEX "tenant_accounting_policies_functionalCurrencyCode_idx"
  ON "tenant_accounting_policies"("functionalCurrencyCode");

ALTER TABLE "tenant_accounting_policies"
  ADD CONSTRAINT "tenant_accounting_policies_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_accounting_policies"
  ADD CONSTRAINT "tenant_accounting_policies_functionalCurrencyCode_fkey"
  FOREIGN KEY ("functionalCurrencyCode") REFERENCES "Moneda"("codigo")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Evidencia exacta de auxiliares y resultados, capturada solo en el corte actual real.
CREATE TABLE "financial_auxiliary_checkpoints" (
  "checkpointId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "cutoffAt" TIMESTAMP(3) NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "functionalCurrencyCode" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "hashIntegridad" TEXT NOT NULL,
  "capturedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_auxiliary_checkpoints_pkey" PRIMARY KEY ("checkpointId"),
  CONSTRAINT "financial_auxiliary_checkpoints_chronology_check"
    CHECK ("cutoffAt" <= "capturedAt")
);

CREATE UNIQUE INDEX "financial_auxiliary_checkpoints_tenantId_cutoffAt_key"
  ON "financial_auxiliary_checkpoints"("tenantId", "cutoffAt");
CREATE INDEX "financial_auxiliary_checkpoints_tenantId_capturedAt_idx"
  ON "financial_auxiliary_checkpoints"("tenantId", "capturedAt");
CREATE INDEX "financial_auxiliary_checkpoints_functionalCurrencyCode_idx"
  ON "financial_auxiliary_checkpoints"("functionalCurrencyCode");

ALTER TABLE "financial_auxiliary_checkpoints"
  ADD CONSTRAINT "financial_auxiliary_checkpoints_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_auxiliary_checkpoints"
  ADD CONSTRAINT "financial_auxiliary_checkpoints_functionalCurrencyCode_fkey"
  FOREIGN KEY ("functionalCurrencyCode") REFERENCES "Moneda"("codigo")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_financial_auxiliary_checkpoint_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'financial auxiliary checkpoints are immutable'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "financial_auxiliary_checkpoints_immutable_update"
BEFORE UPDATE ON "financial_auxiliary_checkpoints"
FOR EACH ROW EXECUTE FUNCTION reject_financial_auxiliary_checkpoint_mutation();

CREATE TRIGGER "financial_auxiliary_checkpoints_immutable_delete"
BEFORE DELETE ON "financial_auxiliary_checkpoints"
FOR EACH ROW EXECUTE FUNCTION reject_financial_auxiliary_checkpoint_mutation();

CREATE OR REPLACE FUNCTION reject_used_functional_currency_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."functionalCurrencyCode" IS DISTINCT FROM OLD."functionalCurrencyCode" AND (
    EXISTS (
      SELECT 1 FROM "financial_auxiliary_checkpoints" c
      WHERE c."tenantId" = OLD."tenantId"
    ) OR EXISTS (
      SELECT 1 FROM "snapshot_periodos" s
      JOIN "periodos_contables" p ON p."periodoId" = s."periodoId"
      WHERE p."tenantId" = OLD."tenantId" AND p."estado" = 'APROBADO'
    ) OR EXISTS (
      SELECT 1 FROM "ReconciliacionVenta" r
      WHERE r."tenantId" = OLD."tenantId" AND r."fxEvidenceVersion" = 1
    ) OR EXISTS (
      SELECT 1 FROM "ReconciliacionServicio" r
      WHERE r."tenantId" = OLD."tenantId" AND r."fxEvidenceVersion" = 1
    ) OR EXISTS (
      SELECT 1 FROM "ReconciliacionGasto" r
      WHERE r."tenantId" = OLD."tenantId" AND r."fxEvidenceVersion" = 1
    )
  ) THEN
    RAISE EXCEPTION 'functional currency is immutable after accounting evidence exists'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "tenant_accounting_policy_currency_immutable_after_evidence"
BEFORE UPDATE ON "tenant_accounting_policies"
FOR EACH ROW EXECUTE FUNCTION reject_used_functional_currency_change();
