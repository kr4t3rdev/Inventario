-- Persist the normalized request identity atomically with each new injection.
-- Nullable for records created before this migration; current service writes a fingerprint.
ALTER TABLE "InyeccionCapital" ADD COLUMN "payloadFingerprint" TEXT;
