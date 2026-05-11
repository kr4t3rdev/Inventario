-- Migration: Fix Ventas - Add idempotencyKey + AuditVenta
-- Adds idempotencyKey to Venta and creates AuditVenta table

-- Step 1: Add idempotencyKey to Venta
ALTER TABLE "Venta" ADD COLUMN "idempotencyKey" TEXT;

-- Step 2: Create unique index for idempotencyKey (partial, only non-null)
CREATE UNIQUE INDEX "Venta_idempotencyKey_key" ON "Venta"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX "Venta_tenantId_idempotencyKey_idx" ON "Venta"("tenantId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;

-- Step 3: Create AuditVenta table
CREATE TABLE "audit_venta" (
    "auditId" TEXT NOT NULL,
    "ventaId" TEXT,
    "tenantId" TEXT NOT NULL,
    "operacion" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "mensaje" TEXT,
    "detalles" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_venta_pkey" PRIMARY KEY ("auditId")
);

-- Step 4: AuditVenta indexes
CREATE INDEX "audit_venta_tenantId_createdAt_idx" ON "audit_venta"("tenantId", "createdAt");
