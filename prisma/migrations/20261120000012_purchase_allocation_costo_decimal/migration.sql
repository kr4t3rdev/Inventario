-- El snapshot de costo unitario debe guardar decimales: el contrato de
-- inventario inicial acepta hasta 4 decimales (25.50) y la columna Int
-- truncaba el valor al persistir la asignación FIFO.
ALTER TABLE "purchase_allocations"
  ALTER COLUMN "costoUnitarioSnapshot" TYPE DECIMAL(20, 4)
    USING "costoUnitarioSnapshot"::DECIMAL(20, 4);
