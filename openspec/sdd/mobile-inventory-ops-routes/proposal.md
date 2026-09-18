# SDD Proposal: Rutas móviles de operaciones de inventario — transferencias, mermas y compras

## Business Problem

Los clients móviles `transfers-api`, `mermas-api` y `purchases-api` llaman a `/api/mobile/transfers`, `/api/mobile/mermas` y `/api/mobile/purchases`, rutas inexistentes (404). Las superficies correspondientes (`TransfersSurface`, `MermasSurface`, `PurchasesSurface`) solo ejercitan `list()` y `remove()`; sus botones "Nueva …" son stubs con `onPress={() => {}}`. Al no existir las rutas, incluso el listado y el borrado fallan, dejando tres pestañas de "Acciones" rotas contra el backend real.

## Hallazgos (Evidence)

### H1 — Rutas 404

`find src/app/api/mobile` no muestra `transfers/`, `mermas/` ni `purchases/`.

### H2 — Contrato móvil (solo lectura + borrado)

- `transferencias`: `transfers-api.ts` expone `list/getById/create/update/remove`, pero `TransfersSurface` solo usa `api.list()` y `api.remove(id)`.
- `mermas`: `TransfersSurface`/`MermasSurface` solo usan `list()` y `remove(id)`.
- `purchases`: `PurchasesSurface` solo usa `list()` y `remove(id)`.

### H3 — Dominio reusable y modelos

- `Transferencia { transferenciaId, tenantId, productoId, cantidad, origenId?, destinoId?, puntoDeVentaOrigenId?, puntoDeVentaDestinoId?, estado (default COMPLETADA), numeroTransferencia, deletedAt, ... }`. Borrado = soft-delete + revertir stock solo si `COMPLETADA` (ver `deleteTransferenciaAction`).
- `Merma { mermaId, tenantId, productoId, cantidad, motivo?, almacenId?, costoTotal? }`. Borrado = hard-delete + restaurar stock (ver `deleteMermaAction`).
- `CompraProducto { compraProductoId, tenantId, productoId, proveedorId, cantidad, precioUnitario, total, descripcion?, estado, numeroFactura, facturaUrl, formaPago, deletedAt, ... }`. Borrado = soft-delete (`deletedAt`).
- Helper `upsertStockUbicacion(tx, opts)` en `lib/services/stock-ubicacion-service.ts` acepta `tenantId?`, `modo: "increment"` con `delta` negativo.

### H4 — Mismatch de create en transferencias

El `createTransferenciaAction` web usa esquema multiproducto `{ productos[], tipoOrigen, origenId, tipoDestino, destinoId, estado? }`; el client móvil `create()` envía un solo producto con `{ productoId, cantidad, origenId?, destinoId?, tipoTransferencia, descripcion? }`. Sin formulario móvil de creación real, implementar `POST /transfers` es especulativo.

## Target Users

- Compradores que consultan el historial de transferencias, mermas y compras, y cancelan/eliminan registros.

## Scope

### Incluye

- `GET` listado + `GET [id]` + `DELETE [id]` para transfers, mermas y purchases (mapeados al contrato móvil).
- `POST` crear para mermas (decremento de stock) y purchases (alta simple en `CompraProducto`).
- Tests vitest (mapeo de los tres listados, 404 ajeno, delete idempotente, revert de stock).
- Actualizar bundle SDD y documentar los endpoints.

### Excluye (diferido con motivo)

- `POST /transfers` y `PUT` de transfers/mermas/purchases: sin formulario móvil consumidor y, en transfers, contrato ambiguo (multiproducto vs producto único). Se documentan como pendientes.

## Data Sources

- Modelos `Transferencia`, `Merma`, `CompraProducto`, `StockUbicacion` (sin migración).

## Rollback

Reversible: revert del commit (rutas nuevas).