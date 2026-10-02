-- Estado INCIERTA (Phase 5, remediacion-integridad-ventas-credito-fiscal):
-- emisión con resultado externo no verificable. Aditivo: los workers previos
-- desconocen el estado y nunca lo seleccionan (sus queries filtran PENDIENTE).
ALTER TYPE "EstadoFiscalDocumento" ADD VALUE 'INCIERTA';

-- Identidad durable del intento: el claim la fija y la finalización es CAS
-- por attemptId (dos workers no resuelven el mismo intento).
ALTER TABLE "fiscal_documents" ADD COLUMN "attemptId" TEXT;

-- Eventos append-only por intento.
ALTER TABLE "fiscal_emision_events" ADD COLUMN "attemptId" TEXT;
