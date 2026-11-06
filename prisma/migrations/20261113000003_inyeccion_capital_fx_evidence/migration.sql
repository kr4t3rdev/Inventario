-- La inyeccion de capital movia tesoreria sin contraparte operativa, pero su
-- valoracion en moneda extranjera no quedo persistida: el replay historico no
-- podia reconstruir el asiento con fidelidad. Se persisten la tasa aplicada y
-- el importe convertido, igual que hace el ajuste bancario.
ALTER TABLE "InyeccionCapital"
  ADD COLUMN IF NOT EXISTS "tasaCambio" DECIMAL(20, 10),
  ADD COLUMN IF NOT EXISTS "montoConvertido" DECIMAL(20, 4);
