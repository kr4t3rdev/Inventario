-- Evidencia histórica tenant-scoped para conversiones aplicadas al corte.
CREATE TABLE "fx_evidence" (
  "fxEvidenceId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "originalAmount" DECIMAL(20,8) NOT NULL,
  "originalCurrency" TEXT NOT NULL,
  "functionalAmount" DECIMAL(20,8) NOT NULL,
  "functionalCurrency" TEXT NOT NULL,
  "exchangeRate" DECIMAL(20,10) NOT NULL,
  "rateEffectiveAt" TIMESTAMP(3) NOT NULL,
  "cutoffAt" TIMESTAMP(3) NOT NULL,
  "fxCatalogRateId" TEXT,
  "provenance" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "evidenceFingerprint" TEXT NOT NULL,
  "evidenceVersion" INTEGER NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fx_evidence_pkey" PRIMARY KEY ("fxEvidenceId"),
  CONSTRAINT "fx_evidence_amounts_check"
    CHECK ("originalAmount" > 0 AND "functionalAmount" > 0 AND "exchangeRate" > 0),
  CONSTRAINT "fx_evidence_currencies_check"
    CHECK (length(trim("originalCurrency")) > 0 AND length(trim("functionalCurrency")) > 0),
  CONSTRAINT "fx_evidence_chronology_check"
    CHECK ("rateEffectiveAt" <= "cutoffAt" AND "cutoffAt" <= "capturedAt")
);

CREATE UNIQUE INDEX "fx_evidence_tenant_source_fingerprint_key"
  ON "fx_evidence"("tenantId", "sourceType", "sourceId", "evidenceFingerprint");
CREATE INDEX "fx_evidence_tenant_source_cutoff_idx"
  ON "fx_evidence"("tenantId", "sourceType", "sourceId", "cutoffAt");
CREATE INDEX "fx_evidence_tenant_source_captured_idx"
  ON "fx_evidence"("tenantId", "sourceType", "sourceId", "capturedAt");

ALTER TABLE "fx_evidence"
  ADD CONSTRAINT "fx_evidence_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_fx_evidence_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'FX evidence is immutable'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "fx_evidence_immutable_update"
BEFORE UPDATE ON "fx_evidence"
FOR EACH ROW EXECUTE FUNCTION reject_fx_evidence_mutation();

CREATE TRIGGER "fx_evidence_immutable_delete"
BEFORE DELETE ON "fx_evidence"
FOR EACH ROW EXECUTE FUNCTION reject_fx_evidence_mutation();
