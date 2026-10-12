-- DropForeignKey
ALTER TABLE "Categoria" DROP CONSTRAINT "Categoria_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Producto" DROP CONSTRAINT "Producto_categoriaId_fkey";

-- DropForeignKey
ALTER TABLE "Producto" DROP CONSTRAINT "Producto_puntoDeVentaId_fkey";

-- DropForeignKey
ALTER TABLE "apertura_periodos" DROP CONSTRAINT "apertura_periodos_periodoId_fkey";

-- AlterTable
ALTER TABLE "CompraDocumento" ALTER COLUMN "tasaCambio" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "montoConvertido" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "InyeccionCapital" ALTER COLUMN "tasaCambio" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "montoConvertido" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "PagoDeuda" ALTER COLUMN "tasaCambio" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "montoConvertido" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "RecetaIngrediente" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TransferenciaBancaria" ALTER COLUMN "montoConvertido" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "apertura_revisiones" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "apertura_periodos" RENAME CONSTRAINT "apertura_periodos_periodoId_tenantId_fkey" TO "apertura_periodos_tenantId_periodoId_fkey";

-- RenameForeignKey
ALTER TABLE "apertura_revisiones" RENAME CONSTRAINT "apertura_revisiones_opening_fkey" TO "apertura_revisiones_tenantId_periodoId_aperturaId_fkey";

-- RenameForeignKey
ALTER TABLE "apertura_revisiones" RENAME CONSTRAINT "apertura_revisiones_period_fkey" TO "apertura_revisiones_tenantId_periodoId_fkey";

-- RenameForeignKey
ALTER TABLE "apertura_revisiones" RENAME CONSTRAINT "apertura_revisiones_tenant_fkey" TO "apertura_revisiones_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "lineas_apertura_periodo" RENAME CONSTRAINT "lineas_apertura_periodo_aperturaId_tenantId_periodoId_fkey" TO "lineas_apertura_periodo_tenantId_periodoId_aperturaId_fkey";

-- RenameForeignKey
ALTER TABLE "lineas_apertura_periodo" RENAME CONSTRAINT "lineas_apertura_periodo_periodoId_tenantId_fkey" TO "lineas_apertura_periodo_tenantId_periodoId_fkey";

-- RenameForeignKey
ALTER TABLE "lineas_apertura_periodo" RENAME CONSTRAINT "lineas_apertura_periodo_revisionId_fkey" TO "lineas_apertura_periodo_tenantId_periodoId_aperturaId_revi_fkey";

-- RenameForeignKey
ALTER TABLE "series_facturacion" RENAME CONSTRAINT "SerieFacturacion_tenantId_fkey" TO "series_facturacion_tenantId_fkey";

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Categoria"("catId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("catId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_puntoDeVentaId_fkey" FOREIGN KEY ("puntoDeVentaId") REFERENCES "PuntoDeVenta"("pvId") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ReglaReabastecimiento_tenantId_productoId_tipoUbicacion_ubicaci" RENAME TO "ReglaReabastecimiento_tenantId_productoId_tipoUbicacion_ubi_key";

-- RenameIndex
ALTER INDEX "StockMoveLine_eventoKey_key" RENAME TO "StockMoveLine_tenantId_tipoOrigen_origenId_productoId_tipoU_key";

-- RenameIndex
ALTER INDEX "accounting_policy_tenant_approvals_tenantId_functionalCurrencyC" RENAME TO "accounting_policy_tenant_approvals_tenantId_functionalCurre_key";

-- RenameIndex
ALTER INDEX "accounting_policy_tenant_approvals_tenantId_status_expiresAt_id" RENAME TO "accounting_policy_tenant_approvals_tenantId_status_expiresA_idx";

-- RenameIndex
ALTER INDEX "financial_auxiliary_checkpoints_tenantId_schemaVersion_cutoffAt" RENAME TO "financial_auxiliary_checkpoints_tenantId_schemaVersion_cuto_idx";

-- RenameIndex
ALTER INDEX "fx_evidence_tenant_source_captured_idx" RENAME TO "fx_evidence_tenantId_sourceType_sourceId_capturedAt_idx";

-- RenameIndex
ALTER INDEX "fx_evidence_tenant_source_cutoff_idx" RENAME TO "fx_evidence_tenantId_sourceType_sourceId_cutoffAt_idx";

-- RenameIndex
ALTER INDEX "fx_evidence_tenant_source_fingerprint_key" RENAME TO "fx_evidence_tenantId_sourceType_sourceId_evidenceFingerprin_key";

-- RenameIndex
ALTER INDEX "SaldoSnapshot_tenantId_idx" RENAME TO "saldos_snapshot_tenantId_idx";
