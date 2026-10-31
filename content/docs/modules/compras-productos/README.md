# Compras de Productos

> Registra compras de mercadería, actualiza stock y costo, y genera vínculos contables como gasto, cuenta por pagar o aplicación de anticipos.

## Qué hace

Este módulo no solo guarda compras: también recalcula precio de costo, incrementa stock por ubicación, registra historial de cambios y crea relaciones contables según la forma de pago. Si la compra es parcial puede abrir una cuenta por pagar; si usa anticipo puede aplicarlo dentro del flujo.

## Qué incluye

- listado filtrable y paginado de compras
- alta, edición y consulta por ID
- items múltiples por compra
- recálculo de costo promedio / costo histórico
- actualización de stock por almacén
- creación de gasto contable asociado
- integración con anticipos y cuentas por pagar

## Cuándo usarlo

- Cuando entra mercadería nueva al inventario.
- Cuando querés dejar trazado proveedor, factura, forma de pago y costo unitario.
- Cuando necesitás que compras impacten contabilidad e inventario en el mismo paso.

## Reglas importantes

- Al crear la compra se validan proveedor y productos del tenant.
- La compra ajusta stock mediante `StockUbicacion` y puede recalcular `precioCosto`.
- `PAGO_PARCIAL` puede generar una cuenta por pagar enlazada.
- Para crear una compra que deje saldo pendiente, el plan debe incluir la función `cuentas-pagar`.
- `ANTICIPO_PAGO` tiene reglas especiales y no soporta ciertos cambios posteriores de reconciliación.

## Unidades de compra (alcance F-1)

- La acción de compra directa puede recibir una unidad de origen configurada para el producto.
- El servidor valida la conversión y registra existencias y costos en la unidad base del producto.
- La línea conserva una instantánea de la unidad, cantidad y costo de origen para su trazabilidad.
- Este alcance no incluye interfaz de selección, órdenes/recepciones, POS ni ventas.
- Las tres migraciones de esquema se aplicaron en producción el 25 de octubre de 2026 después de verificar un respaldo cifrado y su recuperación local. La aceptación del release queda pendiente del despliegue del runtime y de la prueba posterior para el SHA exacto.
- Las unidades existentes conservan dimensión `UNKNOWN`; antes de usar una unidad alternativa, configura una dimensión compatible y su conversión para el producto.

## Qué conviene cuidar

- Verificá proveedor, fecha y monto antes de guardar.
- Guardá comprobantes o referencias cuando corresponda.
- Si la forma de pago cambia después, puede requerir reconciliar entidades contables relacionadas.
- Este módulo alimenta ficha de costo, stock y contabilidad; un error acá se propaga rápido.

## Rutas y referencias

- `/busy/compras-productos`
- `/busy/compras-productos/new`
- `/busy/compras-productos/[id]/edit`
- `src/features/compras-productos/actions.ts`

## En una frase

Es la puerta de entrada de mercadería al sistema con impacto directo en stock, costo y deuda.
