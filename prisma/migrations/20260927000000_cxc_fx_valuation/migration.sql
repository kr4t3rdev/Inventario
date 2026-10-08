-- Add nullable source and functional valuation snapshots to receivables.
-- Existing rows remain unvalued until evidence-backed backfill is defined.
ALTER TABLE "CuentaPorCobrar"
  ADD COLUMN "fxCatalogRateId" TEXT,
  ADD COLUMN "fxEvidenceFingerprint" TEXT,
  ADD COLUMN "fxEvidenceJson" JSONB,
  ADD COLUMN "fxEvidenceVersion" INTEGER,
  ADD COLUMN "fxProvenanceKind" TEXT,
  ADD COLUMN "fxProvenanceSource" TEXT,
  ADD COLUMN "monedaFuncional" TEXT,
  ADD COLUMN "monedaOriginal" TEXT,
  ADD COLUMN "montoDeudaFuncional" DECIMAL(20,4),
  ADD COLUMN "montoOriginal" DECIMAL(20,4),
  ADD COLUMN "montoPagadoFuncional" DECIMAL(20,4),
  ADD COLUMN "rateEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "tasaCambio" DECIMAL(20,10);
