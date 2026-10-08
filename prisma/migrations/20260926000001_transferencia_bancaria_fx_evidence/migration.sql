-- Persist FX provenance used to value bank transfer postings in functional currency.
ALTER TABLE "TransferenciaBancaria"
  ADD COLUMN "montoConvertido" DECIMAL(20,4),
  ADD COLUMN "functionalCurrency" TEXT,
  ADD COLUMN "rateEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "fxProvenanceKind" TEXT,
  ADD COLUMN "fxProvenanceSource" TEXT,
  ADD COLUMN "fxCatalogRateId" TEXT,
  ADD COLUMN "fxEvidenceJson" JSONB,
  ADD COLUMN "fxEvidenceFingerprint" TEXT,
  ADD COLUMN "fxEvidenceVersion" INTEGER;

CREATE INDEX "TransferenciaBancaria_tenantId_fxProvenanceKind_idx"
  ON "TransferenciaBancaria"("tenantId", "fxProvenanceKind");
