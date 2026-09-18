-- Additive v3 metadata. Existing v2 rows remain nullable and untouched.
ALTER TABLE "snapshot_periodos"
  ADD COLUMN "tenantId" TEXT,
  ADD COLUMN "schemaVersion" INTEGER,
  ADD COLUMN "status" TEXT,
  ADD COLUMN "cutoffAt" TIMESTAMP(3),
  ADD COLUMN "capturedAt" TIMESTAMP(3),
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedBy" TEXT,
  ADD COLUMN "canonicalContractVersion" TEXT;

ALTER TABLE "financial_auxiliary_checkpoints"
  ADD COLUMN "schemaVersion" INTEGER;

ALTER TABLE "snapshot_periodos"
  ADD CONSTRAINT "snapshot_periodos_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "snapshot_periodos"
  ADD CONSTRAINT "snapshot_periodos_v3_schema_version_check"
  CHECK ("schemaVersion" IS NULL OR "schemaVersion" IN (2, 3));

ALTER TABLE "snapshot_periodos"
  ADD CONSTRAINT "snapshot_periodos_status_check"
  CHECK ("status" IS NULL OR "status" IN ('CAPTURED', 'APPROVED'));

ALTER TABLE "snapshot_periodos"
  ADD CONSTRAINT "snapshot_periodos_v3_chronology_check"
  CHECK (
    ("cutoffAt" IS NULL OR "capturedAt" IS NULL OR "cutoffAt" <= "capturedAt")
    AND ("approvedAt" IS NULL OR "capturedAt" IS NULL OR "capturedAt" <= "approvedAt")
  );

ALTER TABLE "snapshot_periodos"
  ADD CONSTRAINT "snapshot_periodos_v3_metadata_check"
  CHECK (
    "schemaVersion" IS DISTINCT FROM 3
    OR (
      "tenantId" IS NOT NULL
      AND "status" IN ('CAPTURED', 'APPROVED')
      AND "cutoffAt" IS NOT NULL
      AND "capturedAt" IS NOT NULL
      AND "canonicalContractVersion" IS NOT NULL
    )
  );

CREATE INDEX "snapshot_periodos_tenantId_status_cutoffAt_idx"
  ON "snapshot_periodos"("tenantId", "status", "cutoffAt");

CREATE INDEX "financial_auxiliary_checkpoints_tenantId_schemaVersion_cutoffAt_idx"
  ON "financial_auxiliary_checkpoints"("tenantId", "schemaVersion", "cutoffAt");

CREATE OR REPLACE FUNCTION reject_approved_financial_snapshot_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" = 'APPROVED' THEN
    RAISE EXCEPTION 'approved financial snapshots are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'APPROVED' THEN
    RAISE EXCEPTION 'approved financial snapshots are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW."status" = 'APPROVED' AND (
    NEW."schemaVersion" IS DISTINCT FROM 3
    OR NEW."approvedAt" IS NULL
    OR NEW."approvedBy" IS NULL
    OR NEW."resumenJson" IS NULL
    OR NEW."hashIntegridad" IS NULL
  ) THEN
    RAISE EXCEPTION 'approved v3 snapshots require final evidence and approval metadata'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "snapshot_periodos_approved_immutable_update"
BEFORE UPDATE ON "snapshot_periodos"
FOR EACH ROW EXECUTE FUNCTION reject_approved_financial_snapshot_mutation();

CREATE TRIGGER "snapshot_periodos_approved_immutable_delete"
BEFORE DELETE ON "snapshot_periodos"
FOR EACH ROW EXECUTE FUNCTION reject_approved_financial_snapshot_mutation();
