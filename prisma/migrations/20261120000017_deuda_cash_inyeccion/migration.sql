-- La deuda recibida en la inicialización se paga por Deudas cash: el
-- enlace permite bloquear el pago por capital (registerCapitalPayment)
-- y el pago genérico de CxP iniciales (settleInitialPayable) para esa
-- deuda. Las deudas ordinarias anteriores quedan con el enlace nulo.
ALTER TABLE "DeudaCash" ADD COLUMN "inyeccionId" TEXT;
CREATE UNIQUE INDEX "DeudaCash_inyeccionId_key" ON "DeudaCash"("inyeccionId");
ALTER TABLE "DeudaCash" ADD CONSTRAINT "DeudaCash_inyeccionId_fkey" FOREIGN KEY ("inyeccionId") REFERENCES "InyeccionCapital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
