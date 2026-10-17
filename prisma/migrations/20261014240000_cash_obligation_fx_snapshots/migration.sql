BEGIN;

ALTER TABLE "ReconciliacionVenta"
  ADD COLUMN "montoCuenta" DECIMAL(20,4),
  ADD COLUMN "monedaCuenta" TEXT;

ALTER TABLE "CuentaPorCobrar"
  ADD COLUMN "montoDeudaFuncional" DECIMAL(20,4),
  ADD COLUMN "montoPagadoFuncional" DECIMAL(20,4),
  ADD COLUMN "montoOriginal" DECIMAL(20,4),
  ADD COLUMN "monedaOriginal" TEXT,
  ADD COLUMN "monedaFuncional" TEXT,
  ADD COLUMN "tasaCambio" DECIMAL(20,10),
  ADD COLUMN "rateEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "fxProvenanceKind" TEXT,
  ADD COLUMN "fxProvenanceSource" TEXT,
  ADD COLUMN "fxCatalogRateId" TEXT,
  ADD COLUMN "fxEvidenceJson" JSONB,
  ADD COLUMN "fxEvidenceFingerprint" TEXT,
  ADD COLUMN "fxEvidenceVersion" INTEGER;

ALTER TABLE "CuentaPorPagar"
  ADD COLUMN "montoDeudaFuncional" DECIMAL(20,4),
  ADD COLUMN "montoPagadoFuncional" DECIMAL(20,4),
  ADD COLUMN "monedaOriginal" TEXT,
  ADD COLUMN "monedaFuncional" TEXT,
  ADD COLUMN "tasaCambio" DECIMAL(20,10),
  ADD COLUMN "rateEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "fxProvenanceKind" TEXT,
  ADD COLUMN "fxProvenanceSource" TEXT,
  ADD COLUMN "fxCatalogRateId" TEXT,
  ADD COLUMN "fxEvidenceJson" JSONB,
  ADD COLUMN "fxEvidenceFingerprint" TEXT,
  ADD COLUMN "fxEvidenceVersion" INTEGER;

COMMIT;
