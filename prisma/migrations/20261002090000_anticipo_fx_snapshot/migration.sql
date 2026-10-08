-- Nullable: anticipos históricos sin evidencia permanecen explícitamente no valorados.
ALTER TABLE "Anticipo" ADD COLUMN "fxSnapshot" JSONB;
ALTER TABLE "AnticipoMovimiento" ADD COLUMN "fxSnapshot" JSONB;
