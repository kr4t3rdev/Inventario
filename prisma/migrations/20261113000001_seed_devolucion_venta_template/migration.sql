-- Plantilla de la devolución de venta con el desglose real del writer: el
-- ingreso revertido se compensa contra la cuenta por cobrar aplicada, el
-- anticipo (saldo a favor) y el reembolso en efectivo; la mercadería
-- devuelta reingresa al inventario por su costo FIFO.
-- Va en una migración aparte porque un valor de enum added en la misma
-- transacción no se puede usar (PG: "unsafe use of new value").
INSERT INTO "plantillas_asiento"
  ("plantillaId", "evento", "orden", "lado", "rolCuenta", "montoRegla", "condicion", "version", "activa")
VALUES
  ('tpl-devolucion-venta-1', 'DEVOLUCION_VENTA', 1, 'DEBE', 'VENTAS_PRODUCTOS', 'TOTAL', NULL, 1, true),
  ('tpl-devolucion-venta-2', 'DEVOLUCION_VENTA', 2, 'HABER', 'CXC_CLIENTES', 'MONTO_APLICADO_CXC', NULL, 1, true),
  ('tpl-devolucion-venta-3', 'DEVOLUCION_VENTA', 3, 'HABER', 'ANTICIPOS_CLIENTES', 'MONTO_SALDO_FAVOR', NULL, 1, true),
  ('tpl-devolucion-venta-4', 'DEVOLUCION_VENTA', 4, 'HABER', 'CAJA_PRINCIPAL', 'MONTO_REEMBOLSADO', NULL, 1, true),
  ('tpl-devolucion-venta-5', 'DEVOLUCION_VENTA', 5, 'DEBE', 'INVENTARIOS', 'COSTO_FIFO', NULL, 1, true),
  ('tpl-devolucion-venta-6', 'DEVOLUCION_VENTA', 6, 'HABER', 'COSTO_VENTAS', 'COSTO_FIFO', NULL, 1, true)
ON CONFLICT ("evento", "orden", "version") DO UPDATE SET
  "lado" = EXCLUDED."lado",
  "rolCuenta" = EXCLUDED."rolCuenta",
  "montoRegla" = EXCLUDED."montoRegla",
  "condicion" = EXCLUDED."condicion",
  "activa" = EXCLUDED."activa";
