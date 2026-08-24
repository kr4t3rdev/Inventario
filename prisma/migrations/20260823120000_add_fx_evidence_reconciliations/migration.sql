-- Evidencia inmutable de conversión aplicada (nullable-first) para reconciliaciones.
ALTER TABLE "ReconciliacionVenta"
  ADD COLUMN "functionalCurrency" TEXT,
  ADD COLUMN "rateEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "fxProvenanceKind" TEXT,
  ADD COLUMN "fxProvenanceSource" TEXT,
  ADD COLUMN "fxCatalogRateId" TEXT,
  ADD COLUMN "fxEvidenceJson" JSONB,
  ADD COLUMN "fxEvidenceFingerprint" TEXT,
  ADD COLUMN "fxEvidenceVersion" INTEGER;

ALTER TABLE "ReconciliacionServicio"
  ADD COLUMN "functionalCurrency" TEXT,
  ADD COLUMN "rateEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "fxProvenanceKind" TEXT,
  ADD COLUMN "fxProvenanceSource" TEXT,
  ADD COLUMN "fxCatalogRateId" TEXT,
  ADD COLUMN "fxEvidenceJson" JSONB,
  ADD COLUMN "fxEvidenceFingerprint" TEXT,
  ADD COLUMN "fxEvidenceVersion" INTEGER;

ALTER TABLE "ReconciliacionGasto"
  ADD COLUMN "functionalCurrency" TEXT,
  ADD COLUMN "rateEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "fxProvenanceKind" TEXT,
  ADD COLUMN "fxProvenanceSource" TEXT,
  ADD COLUMN "fxCatalogRateId" TEXT,
  ADD COLUMN "fxEvidenceJson" JSONB,
  ADD COLUMN "fxEvidenceFingerprint" TEXT,
  ADD COLUMN "fxEvidenceVersion" INTEGER;

CREATE INDEX "ReconciliacionVenta_tenantId_fxProvenanceKind_idx"
  ON "ReconciliacionVenta"("tenantId", "fxProvenanceKind");

CREATE INDEX "ReconciliacionServicio_tenantId_fxProvenanceKind_idx"
  ON "ReconciliacionServicio"("tenantId", "fxProvenanceKind");

CREATE INDEX "ReconciliacionGasto_tenantId_fxProvenanceKind_idx"
  ON "ReconciliacionGasto"("tenantId", "fxProvenanceKind");
