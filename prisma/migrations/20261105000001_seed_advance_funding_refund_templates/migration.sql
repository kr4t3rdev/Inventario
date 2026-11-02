INSERT INTO "plantillas_asiento"
  ("plantillaId", "evento", "orden", "lado", "rolCuenta", "montoRegla", "condicion", "version", "activa")
VALUES
  ('tpl-anticipo-cliente-devuelto-1', 'ANTICIPO_CLIENTE_DEVUELTO', 1, 'DEBE', 'ANTICIPOS_CLIENTES', 'TOTAL', 'SIN_DIFERENCIA_FX', 1, true),
  ('tpl-anticipo-cliente-devuelto-2', 'ANTICIPO_CLIENTE_DEVUELTO', 2, 'DEBE', 'ANTICIPOS_CLIENTES', 'TOTAL_MENOS_DIFERENCIA', 'FX_POSITIVA', 1, true),
  ('tpl-anticipo-cliente-devuelto-3', 'ANTICIPO_CLIENTE_DEVUELTO', 3, 'DEBE', 'ANTICIPOS_CLIENTES', 'TOTAL_MAS_DIFERENCIA', 'FX_NEGATIVA', 1, true),
  ('tpl-anticipo-cliente-devuelto-4', 'ANTICIPO_CLIENTE_DEVUELTO', 4, 'DEBE', 'DIFERENCIA_CAMBIARIA_GASTO', 'DIFERENCIA_FX', 'FX_POSITIVA', 1, true),
  ('tpl-anticipo-cliente-devuelto-5', 'ANTICIPO_CLIENTE_DEVUELTO', 5, 'HABER', 'DIFERENCIA_CAMBIARIA_INGRESO', 'DIFERENCIA_FX', 'FX_NEGATIVA', 1, true),
  ('tpl-anticipo-cliente-devuelto-6', 'ANTICIPO_CLIENTE_DEVUELTO', 6, 'HABER', 'CAJA_PRINCIPAL', 'TOTAL', NULL, 1, true),
  ('tpl-anticipo-proveedor-reintegrado-1', 'ANTICIPO_PROVEEDOR_REINTEGRADO', 1, 'DEBE', 'CAJA_PRINCIPAL', 'TOTAL', NULL, 1, true),
  ('tpl-anticipo-proveedor-reintegrado-2', 'ANTICIPO_PROVEEDOR_REINTEGRADO', 2, 'HABER', 'ANTICIPOS_PROVEEDORES', 'TOTAL', 'SIN_DIFERENCIA_FX', 1, true),
  ('tpl-anticipo-proveedor-reintegrado-3', 'ANTICIPO_PROVEEDOR_REINTEGRADO', 3, 'HABER', 'ANTICIPOS_PROVEEDORES', 'TOTAL_MENOS_DIFERENCIA', 'FX_POSITIVA', 1, true),
  ('tpl-anticipo-proveedor-reintegrado-4', 'ANTICIPO_PROVEEDOR_REINTEGRADO', 4, 'HABER', 'ANTICIPOS_PROVEEDORES', 'TOTAL_MAS_DIFERENCIA', 'FX_NEGATIVA', 1, true),
  ('tpl-anticipo-proveedor-reintegrado-5', 'ANTICIPO_PROVEEDOR_REINTEGRADO', 5, 'HABER', 'DIFERENCIA_CAMBIARIA_INGRESO', 'DIFERENCIA_FX', 'FX_POSITIVA', 1, true),
  ('tpl-anticipo-proveedor-reintegrado-6', 'ANTICIPO_PROVEEDOR_REINTEGRADO', 6, 'DEBE', 'DIFERENCIA_CAMBIARIA_GASTO', 'DIFERENCIA_FX', 'FX_NEGATIVA', 1, true)
ON CONFLICT ("evento", "orden", "version") DO NOTHING;
