# Design: Rutas móviles de operaciones de inventario

## Technical Approach

Patrón `mobile/expenses`: `authenticateUser` + `tenantId` + Prisma + `successResponse`/`errorResponse`. Los movimientos de stock reutilizan `upsertStockUbicacion` (sin duplicar su lógica). Se replica el `delete` con la máquina de estados del server action, manteniendo idempotencia.

## Detailed Design

### Transfers

```ts
// mapTransferencia(t)
{
  transferenciaId, numeroTransferencia, productoId, cantidad, descripcion,
  estado, tipoTransferencia, origenId, destinoId,
  puntoDeVentaOrigenId, puntoDeVentaDestinoId,
  createdAt: ISO, updatedAt: ISO,
  producto: { id, nombre, codigoInterno },
  origen: t.origen ? { almacenId, nombre } : undefined,
  destino: t.destino ? { almacenId, nombre } : undefined,
}
// tipoTransferencia: `${origenLabel} → ${destinoLabel}` (Almacén / PDV)
```

`DELETE`: `findFirst({ transferenciaId, tenantId })`; si `deletedAt`/`CANCELADA` → devolver ya-cancelada; si `COMPLETADA` revertir stock (origen `+cantidad`, destino `-cantidad`) en transacción + `updateMany` a `CANCELADA`+`deletedAt`.

### Mermas

`mapMerma`: `{ mermaId, productoId, cantidad, motivo: motivo ?? '', createdAt, updatedAt, producto: { id, nombre, codigoInterno } }`.

`POST`: validar producto+tenant; `almacenIdEfectivo = producto.almacenId`; si no hay stock ubicación o `cantidadDisponible < cantidad` → 409 `STOCK_INSUFICIENTE`; crear + `upsertStockUbicacion` delta `-cantidad`.

`DELETE`: hard delete + `upsertStockUbicacion` delta `+cantidad` al almacén.

### Purchases (CompraProducto)

`mapCompra`: `{ compraId: compraProductoId, proveedorId, productoId, cantidad, precioUnitario, total, descripcion, estado, createdAt, updatedAt, proveedor: { nombre }, producto: { nombre, codigoInterno } }`.

`GET`: `findMany({ where: { tenantId, deletedAt: null }, include proveedor+producto, orderBy fechaCompra desc })`.

`POST`: validar proveedor+producto (tenant); `create` con defaults `numeroFactura=''`, `facturaUrl=''`, `formaPago='EFECTIVO'`, `estado='PENDIENTE'`, `total = precioUnitario * cantidad`.

`DELETE`: soft-delete con `update({ data: { deletedAt: new Date() } })`.

## Testing

`src/app/api/mobile/__tests__/transfers-mermas-purchases.test.ts` (harness compartido con mocks de prisma/auth): mapeo de listados, `POST` merma/purchase, 404 ajeno, delete idempotente transfers, revert de stock (mock de `upsertStockUbicacion` via `vi.mock` si es necesario, o validar llamadas a `prisma.$transaction`).

## Riesgos y mitigación

- **`upsertStockUbicacion` se importa y se usa dentro de `$transaction`**; en tests se mockea `@/lib/services/stock-ubicacion-service` si el unit-test no monta el helper.
- **`POST /transfers` diferido:** documentado; sin consumidor móvil ni contrato claro.
- **`CompraProducto` (legacy) vs `CompraDocumento` (web):** el client móvil mapea a `CompraProducto`; se documenta la divergencia.