-- Índice único parcial: un solo preferente por (tenant, producto).
-- La transacción en la acción evita la condición de carrera en la práctica;
-- el índice la hace imposible a nivel de base de datos.
CREATE UNIQUE INDEX "ProveedorProducto_preferente_unico"
  ON "proveedor_productos" ("tenantId", "productoId")
  WHERE "esPreferente" = true;
