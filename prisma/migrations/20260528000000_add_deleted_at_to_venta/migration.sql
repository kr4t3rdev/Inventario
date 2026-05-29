-- Add deletedAt column to Venta table for soft-delete support
ALTER TABLE "Venta" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Update indexen to include deletedAt filter
CREATE INDEX "Venta_deletedAt_idx" ON "Venta"("deletedAt");
