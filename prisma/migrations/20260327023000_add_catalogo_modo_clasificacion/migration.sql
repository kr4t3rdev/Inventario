-- Create enum for catalog classification mode
CREATE TYPE "ModoClasificacionCatalogo" AS ENUM ('clasificador_oficial', 'estructura_usuario');

-- Add mode column to global catalog config
ALTER TABLE "CatalogoReparacionConfig"
ADD COLUMN "modoClasificacion" "ModoClasificacionCatalogo" NOT NULL DEFAULT 'clasificador_oficial';

-- Backfill existing row(s) explicitly
UPDATE "CatalogoReparacionConfig"
SET "modoClasificacion" = 'clasificador_oficial'
WHERE "modoClasificacion" IS NULL;
