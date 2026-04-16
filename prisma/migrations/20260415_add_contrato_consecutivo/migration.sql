-- AlterEnum
ALTER TYPE "TipoContrato" RENAME VALUE 'VENTA' to 'COMPRA_VENTA';
ALTER TYPE "TipoContrato" ADD VALUE 'SUMINISTROS';
ALTER TYPE "TipoContrato" DROP VALUE 'PROVEEDOR';

-- DropConstraint (si existe) y agregar campos nuevos
ALTER TABLE "Contrato" ADD COLUMN "numeroConsecutivo" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Contrato" ADD COLUMN "numeroContratoClienteProveedor" TEXT;

-- AddIndex: Composite unique (tipo, numeroConsecutivo)
CREATE UNIQUE INDEX "Contrato_tipo_numeroConsecutivo_key" ON "Contrato"("tipo", "numeroConsecutivo");
