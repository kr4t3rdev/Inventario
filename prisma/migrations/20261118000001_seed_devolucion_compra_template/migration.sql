INSERT INTO "plantillas_asiento" (
  "plantillaId", "evento", "orden", "lado", "rolCuenta", "montoRegla",
  "condicion", "version", "activa"
) VALUES
  ('seed_devolucion_compra_1', 'DEVOLUCION_COMPRA', 1, 'DEBE', 'CXP_PROVEEDORES', 'MONTO_APLICADO_CXC', NULL, 1, TRUE),
  ('seed_devolucion_compra_2', 'DEVOLUCION_COMPRA', 2, 'DEBE', 'ANTICIPOS_PROVEEDORES', 'MONTO_SALDO_FAVOR', NULL, 1, TRUE),
  ('seed_devolucion_compra_3', 'DEVOLUCION_COMPRA', 3, 'HABER', 'INVENTARIOS', 'TOTAL', NULL, 1, TRUE)
ON CONFLICT ("evento", "orden", "version") DO UPDATE SET
  "lado" = EXCLUDED."lado",
  "rolCuenta" = EXCLUDED."rolCuenta",
  "montoRegla" = EXCLUDED."montoRegla",
  "condicion" = EXCLUDED."condicion",
  "activa" = TRUE;
