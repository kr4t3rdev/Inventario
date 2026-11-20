CREATE TABLE "inicializaciones_contables" (
  "inicializacionId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'EN_PROGRESO',
  "resultado" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inicializaciones_contables_pkey" PRIMARY KEY ("inicializacionId"),
  CONSTRAINT "inicializaciones_contables_estado_check" CHECK (
    ("estado" = 'EN_PROGRESO' AND "resultado" IS NULL) OR
    ("estado" = 'COMPLETADA' AND "resultado" IS NOT NULL AND jsonb_typeof("resultado") = 'object')
  ),
  CONSTRAINT "inicializaciones_contables_idempotencyKey_check" CHECK (length(trim("idempotencyKey")) BETWEEN 1 AND 64),
  CONSTRAINT "inicializaciones_contables_payloadHash_check" CHECK ("payloadHash" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "inicializaciones_contables_tenantId_key"
  ON "inicializaciones_contables"("tenantId");
CREATE INDEX "inicializaciones_contables_tenantId_estado_createdAt_idx"
  ON "inicializaciones_contables"("tenantId", "estado", "createdAt");
ALTER TABLE "inicializaciones_contables"
  ADD CONSTRAINT "inicializaciones_contables_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
