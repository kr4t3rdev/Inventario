# Ventas

> Registra ventas en POS, valida stock por punto de venta, genera factura cuando corresponde y permite anular operaciones.

## Qué hace

Este módulo maneja la operación comercial diaria en caja. Al crear una venta no solo guarda líneas y totales: también valida features del plan, exige o crea turno según el tipo de POS, descuenta stock en la ubicación correcta y puede generar factura automáticamente.

## Qué incluye

- listado y detalle de ventas
- creación de ventas con ítems
- validación de stock por ubicación
- integración con turno POS
- generación opcional de factura
- actualización y anulación

## Flujo principal

1. Se selecciona un punto de venta y los productos.
2. El sistema valida stock disponible en `StockUbicacion` del POS.
3. Si no se informó turno, intenta obtener uno activo o crearlo según el tipo de caja.
4. Se registra la venta y sus ítems.
5. Si el plan tiene facturación habilitada, se genera la factura asociada.
6. Se revalidan las pantallas operativas de ventas.

## Cuándo usarlo

- Cuando necesitás vender desde un punto de venta físico o móvil.
- Cuando querés consultar ventas por tenant y detalle por operación.
- Cuando hace falta anular una venta ya registrada.
- Cuando querés revisar la relación entre venta, factura y turno.

## Reglas importantes

- El stock se valida contra la ubicación del POS, no contra stock global del producto.
- Si falta el backfill de `StockUbicacion`, la venta puede bloquearse aunque el producto exista.
- Un POS principal exige turno abierto antes de vender.
- Las anulaciones deben contemplar impacto operativo y documental.
- **El precio lo re-resuelve el servidor** (lista del cliente > lista del POS > precio base): un `precioUnitario` que no coincida se rechaza con `PRICE_MISMATCH`, salvo que el usuario tenga el permiso `ventas.precio.override`, en cuyo caso la desviación queda auditada. Detalle completo en [Integridad de precios](./integridad-precios.md).

## Qué conviene cuidar

- Si una venta falla, conviene revisar turno, stock por ubicación y features del plan antes que el formulario.
- El módulo no trabaja aislado: impacta facturación, caja y arqueo.

## Rutas y referencias

- `/busy/sales`
- `/busy/sales/new`
- `/busy/sales/editar/[id]`
- [Integridad de precios (LP-0)](./integridad-precios.md)
- `src/features/ventas/actions.ts`
- `src/features/ventas/services/venta-mutation-service.ts`
- `src/features/ventas/services/precio-venta-resolver.ts`
- `src/features/ventas/services/facturacion-workflow.ts`

## Relación con otros módulos

- **Turnos POS**: define si se puede operar y en qué turno cae la venta.
- **Puntos de venta**: define desde qué caja y con qué stock/lista de precios se vende.
- **Facturas**: se genera automáticamente si el plan lo permite.
- **Arqueo/Cuadre diario**: usan las ventas del turno para validar cierres.

## En una frase

Convierte una operación de caja en una venta consistente con turno, stock y facturación.
