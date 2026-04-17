-- AlterTable: cambiar columna tipo de enum TipoContrato a TEXT
ALTER TABLE "Contrato" ALTER COLUMN "tipo" TYPE TEXT USING "tipo"::TEXT;

-- DropEnum
DROP TYPE IF EXISTS "TipoContrato";
