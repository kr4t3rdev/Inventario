-- El pago externo persiste el banco que movió: sin él el recolector de
-- replay no puede reconstruir el medio de cobro (CAJA o BANCOS) del
-- evento. Los pagos ordinarios anteriores quedan con cuenta nula.
ALTER TABLE "PagoCuentaPorPagar" ADD COLUMN "cuentaId" TEXT;
CREATE INDEX "PagoCuentaPorPagar_cuentaId_idx" ON "PagoCuentaPorPagar"("cuentaId");
ALTER TABLE "PagoCuentaPorPagar" ADD CONSTRAINT "PagoCuentaPorPagar_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaBancaria"("cuentaId") ON DELETE SET NULL ON UPDATE CASCADE;
