-- B-01: numeración de transferencias por tenant y evidencia de recepción parcial.
-- El correlativo se cuenta por tenant, por eso la unicidad pasa de global a
-- (tenantId, numeroTransferencia). Valores existentes: únicos globales hoy, no
-- colisionan al migrarse. cantidadRecibida = unidades confirmadas al recibir
-- (NULL mantiene el comportamiento histórico de recepción total).

ALTER TABLE "Transferencia" ADD COLUMN "cantidadRecibida" INTEGER;

ALTER TABLE "Transferencia" DROP CONSTRAINT "Transferencia_numeroTransferencia_key";
CREATE UNIQUE INDEX "Transferencia_tenantId_numeroTransferencia_key" ON "Transferencia"("tenantId", "numeroTransferencia");
