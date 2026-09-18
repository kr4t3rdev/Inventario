-- Idempotencia de recepciones: una clave por solicitud evita duplicar
-- recepción, stock y kardex ante reintentos o doble clic.
ALTER TABLE "Recepcion" ADD COLUMN "claveIdempotencia" TEXT;
CREATE UNIQUE INDEX "Recepcion_claveIdempotencia_key"
  ON "Recepcion"("claveIdempotencia");
