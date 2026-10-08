-- Preserve FX valuation for capital injections and principal debt payments.
ALTER TABLE "InyeccionCapital"
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

ALTER TABLE "PagoDeuda"
  ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'CUP',
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

CREATE INDEX "InyeccionCapital_tenantId_fxProvenanceKind_idx"
  ON "InyeccionCapital"("tenantId", "fxProvenanceKind");
CREATE INDEX "PagoDeuda_tenantId_fxProvenanceKind_idx"
  ON "PagoDeuda"("tenantId", "fxProvenanceKind");
