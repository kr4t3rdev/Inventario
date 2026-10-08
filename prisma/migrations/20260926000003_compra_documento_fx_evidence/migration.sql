-- Preserve source FX valuation for foreign supplier invoices.
ALTER TABLE "CompraDocumento"
  ADD COLUMN "tasaCambio" DECIMAL(20,10),
  ADD COLUMN "montoConvertido" DECIMAL(20,4),
  ADD COLUMN "functionalCurrency" TEXT,
  ADD COLUMN "rateEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "fxProvenanceKind" TEXT,
  ADD COLUMN "fxProvenanceSource" TEXT,
  ADD COLUMN "fxCatalogRateId" TEXT,
  ADD COLUMN "fxEvidenceJson" JSONB,
  ADD COLUMN "fxEvidenceFingerprint" TEXT,
  ADD COLUMN "fxEvidenceVersion" INTEGER;

CREATE INDEX "CompraDocumento_tenantId_fxProvenanceKind_idx"
  ON "CompraDocumento"("tenantId", "fxProvenanceKind");
