# Spec: Rutas móviles de operaciones de inventario

## Requisitos funcionales

### RF-1 — Listado de transferencias

`GET /api/mobile/transfers` → `200 { items: [{ transferenciaId, numeroTransferencia, productoId, cantidad, descripcion, estado, tipoTransferencia, origenId, destinoId, puntoDeVentaOrigenId, puntoDeVentaDestinoId, createdAt, updatedAt, producto, origen, destino }] }`, filtrado por `tenantId` y `deletedAt: null`.

### RF-2 — Borrado de transferencia

`DELETE /api/mobile/transfers/[id]` DEBE soft-delete (marca `CANCELADA` + `deletedAt`) y revertir stock **solo si** el estado era `COMPLETADA` (origen +cantidad, destino -cantidad). Idempotente ante reintentos.

### RF-3 — Mermas (list/detail/create/delete)

- `GET /api/mobile/mermas` → `{ items }` mapeando `producto`.
- `GET [id]` → mapeado o 404.
- `POST` valida producto+stock (almacén) y crea merma decrementando stock; 409 `STOCK_INSUFICIENTE` si no alcanza.
- `DELETE [id]` hard-delete y restaura stock al almacén.

### RF-4 — Compras (list/detail/create/delete)

- `GET /api/mobile/purchases` → `{ items }` mapeando `compraProductoId → compraId`, `proveedor`, `producto`.
- `GET [id]` mapeado o 404.
- `POST` crea `CompraProducto` con defaults (`total = precioUnitario * cantidad`, `estado='PENDIENTE'`, `numeroFactura=''`, `facturaUrl=''`, `formaPago='EFECTIVO'`).
- `DELETE [id]` soft-delete (`deletedAt`).

### RF-5 — Autenticación y tenant

`401` sin token, `403 TENANT_REQUIRED` sin `tenantId`; todo filtrado por `tenantId`.

## Requisitos no funcionales

### RNF-1 — Sin regresión

Rutas non-v1; no afectan paridad de `mobile/v1`.

### RNF-2 — Stock consistente

Los movimientos de stock usan `upsertStockUbicacion` dentro de `prisma.$transaction`.

## RFC 2119

- "DEBE" expresa requisito normativo. "Idempotente" expresa que reintentar no duplica el efecto.