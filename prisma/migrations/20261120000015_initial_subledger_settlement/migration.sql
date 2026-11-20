-- Cobro externo: vínculo opcional ReconciliacionVenta -> CuentaPorCobrar
-- (la CxC inicial no tiene venta; el vínculo permite reconocer el cobro en
-- el replay sin pasar por factura).
ALTER TABLE "ReconciliacionVenta" ADD COLUMN "cuentaPorCobrarId" TEXT;
CREATE INDEX "ReconciliacionVenta_cuentaPorCobrarId_idx" ON "ReconciliacionVenta"("cuentaPorCobrarId");
ALTER TABLE "ReconciliacionVenta" ADD CONSTRAINT "ReconciliacionVenta_cuentaPorCobrarId_fkey" FOREIGN KEY ("cuentaPorCobrarId") REFERENCES "CuentaPorCobrar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Pago externo: moneda y evidencia FX en PagoCuentaPorPagar
ALTER TABLE "PagoCuentaPorPagar" ADD COLUMN "moneda" TEXT;
ALTER TABLE "PagoCuentaPorPagar" ADD COLUMN "montoFuncional" DECIMAL(20,4);
ALTER TABLE "PagoCuentaPorPagar" ADD COLUMN "tasaCambio" DECIMAL(20,10);
ALTER TABLE "PagoCuentaPorPagar" ADD COLUMN "functionalCurrency" TEXT;
ALTER TABLE "PagoCuentaPorPagar" ADD COLUMN "rateEffectiveAt" TIMESTAMP(3);
ALTER TABLE "PagoCuentaPorPagar" ADD COLUMN "fxProvenanceKind" TEXT;
ALTER TABLE "PagoCuentaPorPagar" ADD COLUMN "fxProvenanceSource" TEXT;
ALTER TABLE "PagoCuentaPorPagar" ADD COLUMN "fxCatalogRateId" TEXT;
ALTER TABLE "PagoCuentaPorPagar" ADD COLUMN "fxEvidenceJson" JSONB;
ALTER TABLE "PagoCuentaPorPagar" ADD COLUMN "fxEvidenceFingerprint" TEXT;
ALTER TABLE "PagoCuentaPorPagar" ADD COLUMN "fxEvidenceVersion" INTEGER;
