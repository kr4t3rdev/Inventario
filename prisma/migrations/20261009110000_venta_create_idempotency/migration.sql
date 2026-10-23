CREATE TABLE "VentaCreateIdempotency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "payloadFingerprint" TEXT NOT NULL,
    "ventaId" TEXT,
    "responseSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaCreateIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VentaCreateIdempotency_tenantId_keyHash_key"
    ON "VentaCreateIdempotency"("tenantId", "keyHash");
CREATE UNIQUE INDEX "VentaCreateIdempotency_ventaId_key"
    ON "VentaCreateIdempotency"("ventaId");
CREATE INDEX "VentaCreateIdempotency_tenantId_createdAt_idx"
    ON "VentaCreateIdempotency"("tenantId", "createdAt");

ALTER TABLE "VentaCreateIdempotency"
    ADD CONSTRAINT "VentaCreateIdempotency_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VentaCreateIdempotency"
    ADD CONSTRAINT "VentaCreateIdempotency_ventaId_fkey"
    FOREIGN KEY ("ventaId") REFERENCES "Venta"("ventaId")
    ON DELETE SET NULL ON UPDATE CASCADE;
