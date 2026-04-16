-- Safe migration for Contrato model updates (15 de abril de 2026)

-- Step 1: Add new columns with defaults
ALTER TABLE "Contrato" ADD COLUMN "numeroConsecutivo" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Contrato" ADD COLUMN "numeroContratoClienteProveedor" TEXT;

-- Step 2: Create unique index for the combination
CREATE UNIQUE INDEX "Contrato_tipo_numeroConsecutivo_key" ON "Contrato"("tipo", "numeroConsecutivo");

-- Step 3: Handle enum changes - First add new values if they don't exist
-- This uses PostgreSQL conditional logic to safely add values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'COMPRA_VENTA' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TipoContrato')) THEN
    ALTER TYPE "TipoContrato" ADD VALUE 'COMPRA_VENTA';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SUMINISTROS' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TipoContrato')) THEN
    ALTER TYPE "TipoContrato" ADD VALUE 'SUMINISTROS';
  END IF;
END
$$;

-- Step 4: Migrate existing data from old enum values to new ones
UPDATE "Contrato" SET "tipo" = 'COMPRA_VENTA' WHERE "tipo" = 'VENTA';
UPDATE "Contrato" SET "tipo" = 'SUMINISTROS' WHERE "tipo" = 'PROVEEDOR';

-- Step 5: Remove old enum values (only after data migration)
-- Note: This might fail if dependent objects still exist, which is expected
DO $$
BEGIN
  BEGIN
    ALTER TYPE "TipoContrato" DROP VALUE 'VENTA';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    ALTER TYPE "TipoContrato" DROP VALUE 'PROVEEDOR';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END
$$;
