-- E-2: nuevo estado VENCIDA para ofertas (expiración perezosa por fechaVencimiento).
-- Aditiva: los valores existentes no cambian; sin backfill.
ALTER TYPE "EstadoOferta" ADD VALUE IF NOT EXISTS 'VENCIDA';
