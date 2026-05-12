-- Add idempotencyKey to Venta
ALTER TABLE "Venta" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- CreateIndex: Unique index for idempotencyKey
CREATE UNIQUE INDEX IF NOT EXISTS "Venta_idempotencyKey_key" ON "Venta"("idempotencyKey");

-- CreateTable: AuditVenta
CREATE TABLE IF NOT EXISTS "AuditVenta" (
    "auditVentaId" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL DEFAULT '',
    "tenantId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "AuditVenta_pkey" PRIMARY KEY ("auditVentaId")
);

-- CreateIndex: AuditVenta indexes
CREATE INDEX IF NOT EXISTS "AuditVenta_ventaId_idx" ON "AuditVenta"("ventaId");
CREATE INDEX IF NOT EXISTS "AuditVenta_createdAt_idx" ON "AuditVenta"("createdAt");

-- AddForeignKey: AuditVenta → Venta (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AuditVenta_ventaId_fkey'
    ) THEN
        ALTER TABLE "AuditVenta" ADD CONSTRAINT "AuditVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("ventaId") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
