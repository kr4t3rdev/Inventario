-- CxP: montos funcionales para valuación multi-moneda en deudas cash.
-- Espejo de los campos ya existentes en CuentaPorCobrar.
ALTER TABLE "CuentaPorPagar" ADD COLUMN "montoDeudaFuncional" DECIMAL(20,4);
ALTER TABLE "CuentaPorPagar" ADD COLUMN "montoPagadoFuncional" DECIMAL(20,4);
ALTER TABLE "CuentaPorPagar" ADD COLUMN "monedaFuncional" TEXT;
ALTER TABLE "CuentaPorPagar" ADD COLUMN "tasaCambio" DECIMAL(20,10);
ALTER TABLE "CuentaPorPagar" ADD COLUMN "rateEffectiveAt" TIMESTAMP(3);
ALTER TABLE "CuentaPorPagar" ADD COLUMN "fxProvenanceKind" TEXT;
ALTER TABLE "CuentaPorPagar" ADD COLUMN "fxProvenanceSource" TEXT;
ALTER TABLE "CuentaPorPagar" ADD COLUMN "fxCatalogRateId" TEXT;
ALTER TABLE "CuentaPorPagar" ADD COLUMN "fxEvidenceJson" JSONB;
ALTER TABLE "CuentaPorPagar" ADD COLUMN "fxEvidenceFingerprint" TEXT;
ALTER TABLE "CuentaPorPagar" ADD COLUMN "fxEvidenceVersion" INTEGER;
