-- Preserve the original FX evidence used by each bank adjustment posting.
ALTER TABLE "AjusteBancario"
  ADD COLUMN "functionalCurrency" TEXT,
  ADD COLUMN "rateEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "fxProvenanceKind" TEXT,
  ADD COLUMN "fxProvenanceSource" TEXT,
  ADD COLUMN "fxCatalogRateId" TEXT,
  ADD COLUMN "fxEvidenceJson" JSONB,
  ADD COLUMN "fxEvidenceFingerprint" TEXT,
  ADD COLUMN "fxEvidenceVersion" INTEGER;

CREATE INDEX "AjusteBancario_tenantId_fxProvenanceKind_idx"
  ON "AjusteBancario"("tenantId", "fxProvenanceKind");
