INSERT INTO "plantillas_asiento"
  ("plantillaId", "evento", "orden", "lado", "rolCuenta", "montoRegla", "condicion", "version", "activa")
VALUES
  ('tpl-merma-1', 'MERMA_INVENTARIO', 1, 'DEBE', 'MERMAS', 'TOTAL', NULL, 1, true),
  ('tpl-merma-2', 'MERMA_INVENTARIO', 2, 'HABER', 'INVENTARIOS', 'TOTAL', NULL, 1, true),
  ('tpl-merma-reverso-1', 'MERMA_INVENTARIO_REVERSADA', 1, 'DEBE', 'INVENTARIOS', 'TOTAL', NULL, 1, true),
  ('tpl-merma-reverso-2', 'MERMA_INVENTARIO_REVERSADA', 2, 'HABER', 'MERMAS', 'TOTAL', NULL, 1, true),
  ('tpl-produccion-1', 'PRODUCCION_SALIDA', 1, 'DEBE', 'INVENTARIOS', 'TOTAL', NULL, 1, true),
  ('tpl-produccion-2', 'PRODUCCION_SALIDA', 2, 'HABER', 'INVENTARIOS', 'TOTAL', NULL, 1, true)
ON CONFLICT ("evento", "orden", "version") DO NOTHING;
