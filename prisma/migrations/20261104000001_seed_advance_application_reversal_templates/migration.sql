INSERT INTO "plantillas_asiento"
  ("plantillaId", "evento", "orden", "lado", "rolCuenta", "montoRegla", "condicion", "version", "activa")
VALUES
  ('tpl-anticipo-cliente-reverso-1', 'ANTICIPO_CLIENTE_APLICACION_REVERSADA', 1, 'DEBE', 'CXC_CLIENTES', 'TOTAL', 'SIN_DIFERENCIA_FX', 1, true),
  ('tpl-anticipo-cliente-reverso-2', 'ANTICIPO_CLIENTE_APLICACION_REVERSADA', 2, 'DEBE', 'CXC_CLIENTES', 'TOTAL_MENOS_DIFERENCIA', 'FX_POSITIVA', 1, true),
  ('tpl-anticipo-cliente-reverso-3', 'ANTICIPO_CLIENTE_APLICACION_REVERSADA', 3, 'DEBE', 'CXC_CLIENTES', 'TOTAL_MAS_DIFERENCIA', 'FX_NEGATIVA', 1, true),
  ('tpl-anticipo-cliente-reverso-4', 'ANTICIPO_CLIENTE_APLICACION_REVERSADA', 4, 'DEBE', 'DIFERENCIA_CAMBIARIA_INGRESO', 'DIFERENCIA_FX', 'FX_POSITIVA', 1, true),
  ('tpl-anticipo-cliente-reverso-5', 'ANTICIPO_CLIENTE_APLICACION_REVERSADA', 5, 'HABER', 'DIFERENCIA_CAMBIARIA_GASTO', 'DIFERENCIA_FX', 'FX_NEGATIVA', 1, true),
  ('tpl-anticipo-cliente-reverso-6', 'ANTICIPO_CLIENTE_APLICACION_REVERSADA', 6, 'HABER', 'ANTICIPOS_CLIENTES', 'TOTAL', NULL, 1, true),
  ('tpl-anticipo-proveedor-reverso-1', 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA', 1, 'DEBE', 'ANTICIPOS_PROVEEDORES', 'TOTAL', NULL, 1, true),
  ('tpl-anticipo-proveedor-reverso-2', 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA', 2, 'HABER', 'CXP_PROVEEDORES', 'TOTAL', 'SIN_DIFERENCIA_FX', 1, true),
  ('tpl-anticipo-proveedor-reverso-3', 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA', 3, 'HABER', 'CXP_PROVEEDORES', 'TOTAL_MAS_DIFERENCIA', 'FX_POSITIVA', 1, true),
  ('tpl-anticipo-proveedor-reverso-4', 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA', 4, 'HABER', 'CXP_PROVEEDORES', 'TOTAL_MENOS_DIFERENCIA', 'FX_NEGATIVA', 1, true),
  ('tpl-anticipo-proveedor-reverso-5', 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA', 5, 'DEBE', 'DIFERENCIA_CAMBIARIA_INGRESO', 'DIFERENCIA_FX', 'FX_POSITIVA', 1, true),
  ('tpl-anticipo-proveedor-reverso-6', 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA', 6, 'HABER', 'DIFERENCIA_CAMBIARIA_GASTO', 'DIFERENCIA_FX', 'FX_NEGATIVA', 1, true)
ON CONFLICT ("evento", "orden", "version") DO NOTHING;
