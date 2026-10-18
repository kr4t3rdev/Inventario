BEGIN;

CREATE TABLE "periodo_cache" (
  "cacheKey" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL,
  "resultadoJson" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "periodo_cache_pkey" PRIMARY KEY ("cacheKey")
);

CREATE INDEX "periodo_cache_tenantId_expiresAt_idx"
  ON "periodo_cache"("tenantId", "expiresAt");
CREATE INDEX "periodo_cache_expiresAt_idx"
  ON "periodo_cache"("expiresAt");

COMMIT;
