-- Reglas de monto del desglose de la devolución de venta: la devolución
-- reparte el importe entre cuentas por cobrar aplicadas, saldo a favor del
-- cliente (anticipo) y reembolso en efectivo. Cada parte necesita su propia
-- regla porque el motor resuelve una línea por rol con un único importe.
ALTER TYPE "ReglaMontoEvento" ADD VALUE IF NOT EXISTS 'MONTO_APLICADO_CXC';
ALTER TYPE "ReglaMontoEvento" ADD VALUE IF NOT EXISTS 'MONTO_SALDO_FAVOR';
ALTER TYPE "ReglaMontoEvento" ADD VALUE IF NOT EXISTS 'MONTO_REEMBOLSADO';
