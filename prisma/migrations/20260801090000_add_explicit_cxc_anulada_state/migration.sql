-- Preserve CuentaPorCobrar financial history while introducing an explicit annulled state.
ALTER TYPE "EstadoCuentaPorCobrar" ADD VALUE IF NOT EXISTS 'ANULADA';
