-- Expand-only metadata: historical hashes and lines are never rewritten here.
-- Nullable fields require an explicit verifier/classifier before old rows may be
-- assigned a version or sequence; chronology is not inferred from timestamps.
ALTER TABLE "asientos" ADD COLUMN "hashVersion" TEXT;
ALTER TABLE "asientos" ADD COLUMN "tenantSequence" BIGINT;
CREATE UNIQUE INDEX "asientos_tenantId_tenantSequence_key"
  ON "asientos"("tenantId", "tenantSequence");
