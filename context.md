# Code Context — Mock Gap Analysis

## 1. src/features/productos/__tests__/actions.test.ts

### Current mock models
**Main prisma mock (`vi.mock('@/lib/prisma')`):**
- `producto`: findMany, findUnique, create, update, delete
- `precioProducto`: upsert
- `gastoCompra`: findMany, count, create
- `categoria`: findUnique
- `miEmpresa`: findFirst
- `$transaction`: callback-based (passes a `tx` object with the above models)

**`mockTx` (local inside `restockProductoAction` describe block):**
- `producto`: findUnique, update, create
- `gastoCompra`: create
- `compraProducto`: create, update
- `tipoPago`: findFirst
- `cuentaBancaria`: findUnique, findFirst, update
- `reconciliacionGasto`: create
- `cuentaPorPagar`: create
- `stockUbicacion`: upsert

### Missing methods
**None.** All Prisma methods called in the tested code paths are covered:

- `getProductosAction` → `producto.findMany` ✓ (mocked)
- `createProductoAction` (non-EAN-13 path) → `miEmpresa.findFirst`, `producto.create` ✓
- `updateProductoAction` → `producto.findUnique`, `precioProducto.upsert`, `producto.update` ✓
- `deleteProductoAction` → `producto.findUnique`, `producto.delete` ✓
- `restockProductoAction` (pre-transaction) → `producto.findUnique` ✓ with custom mockResolvedValue
- `restockProductoAction` (inside $transaction) → uses the local `mockTx` which has all needed models ✓

### Other issues
- The EAN-13 branch of `createProductoAction` is **not tested** at all (requires `miEmpresa.usaCodigoEan13: true`). That path would need `vendor.findUnique`, `categoria.findUnique` ×2, `$transaction` with `FindNextAvailableSurtido`, `generateProductCodeWithRetry`, `ValidateAssembledCode`, `gastoCompra.create`. Not a mock issue — it's a coverage gap.
- All external dependencies are properly mocked: `getCurrentUser`, `revalidatePath`, `upsertStockUbicacion`, `executeProductInstanceCreationWorkflow`.

---

## 2. src/features/ventas/__tests__/actions.test.ts

### Current mock models
**`vi.mock('@/lib/prisma')`:**
- `venta`: findMany, findUnique, create, delete
- `ventaItem`: create
- `producto`: findUnique, update
- **No `$transaction`** ⚠️

### Missing methods
1. **`$transaction`**: callback-style mock is completely missing. This is the primary blocker — `createVentaAction` will throw before any tx method is called.
2. Inside the transaction, when mocking `$transaction` with a `tx` object, the following models/methods are needed on `tx`:
   - `serieFacturacion`: **findFirst**, **create**, **update** — used to find/create/increment the invoice series
   - `venta`: **create** — already mocked at `prisma.venta.create` but needs to also be on `tx`
3. For paths with `clienteId` (not in the current simple test, but still a gap):
   - `factura`: **create**
   - `applyFacturacionCobroWorkflow` (already imported, may need internal prisma models)

### Other issues
- `getOrCreateTurnoActivo` (from `@/features/turnos-pos`) is **not mocked**. It calls `prisma.turnoPuntoVenta.findFirst`, `prisma.puntoDeVenta.findFirst`, `prisma.turnoPuntoVenta.create` — none mocked. However, the action catches the error silently, so this doesn't break the test — it just means the venta is created without a turnoId.
- Once `$transaction` is added, the series lookup/create/update flow needs to be properly mocked inside the transaction to return a valid series so `venta.create` is reached.

---

## 3. src/features/venta-servicios/__tests__/actions.test.ts

### Current mock models
**`mockTx` (module-level, before `vi.mock`):**
- `ventaServicios`: create
- `tipoPago`: findFirst
- `cuentaBancaria`: findFirst
- `anticipo`: findUnique
- `reconciliacionServicio`: create

**`vi.mock('@/lib/prisma')`:**
- `ventaServicios`: findMany, findFirst, create, update, delete
- `$transaction`: callback-based (passes `mockTx`)

### Missing methods
**None.** All Prisma methods used in tested code paths are covered:

- `getVentaServiciosAction` → `ventaServicios.findMany` ✓
- `getVentaServicioByIdAction` → `ventaServicios.findFirst` ✓
- `createVentaServicioAction` legacy mode → `$transaction` + `mockTx.ventaServicios.create` ✓ (anticipo path skipped when no anticipos)
- `createVentaServicioAction` mixta mode → overrides `$transaction` to support array form, uses `prisma.ventaServicios.create` directly ✓
- `updateVentaServicioAction` → `ventaServicios.findFirst`, `ventaServicios.update` ✓
- `deleteVentaServicioAction` → `ventaServicios.findFirst`, `ventaServicios.delete` ✓

### Other issues
- The anticipo allocation path inside the legacy transaction is not tested (no test passes `anticipos`), but the mock includes all needed models (`tipoPago`, `cuentaBancaria`, `anticipo`, `reconciliacionServicio`).
- `applyAnticipoAllocations` is properly mocked ✓.

---

## 4. src/features/compras-productos/__tests__/actions.test.ts

### Current mock models
**`mockTx` (module-level, before `vi.mock`):**
- `compraDocumento`: create
- `producto`: update

**`vi.mock('@/lib/prisma')`:**
- `compraDocumento`: findMany, findFirst, update, count
- `vendor`: findFirst
- `producto`: findFirst
- `$transaction`: callback-based (passes `mockTx`)

### Missing methods
Inside the transaction for `createCompraProductoAction` with `PAGO_COMPLETO` (the tested path), the action calls:

1. **`tx.gastoCompra.create`** ⚠️ — NOT in `mockTx`. The action creates a `GastoCompra` record for both `PAGO_COMPLETO` and `PAGO_PARCIAL`.
2. **`tx.compraDocumento.update`** ⚠️ — NOT in `mockTx`. After creating the `GastoCompra`, the action links it by updating `compraDocumento.gastoCompraId`.

Add to `mockTx`:
- `gastoCompra`: **create**
- `compraDocumento`: **update**

For `PAGO_PARCIAL` (not tested in current tests, but would break if tested):
- `cuentaPorPagar`: **create**
- `compraDocumento`: **update** (second call to link `cuentaPorPagarId`)

### Other issues
- `calcularPrecioCostoCompra` is properly mocked ✓.
- `applyAnticipoAllocations` is properly mocked ✓.
- `hasUnrevertedAnticipoExecution` is properly mocked ✓.
- `upsertStockUbicacion` is properly mocked ✓.
- The `compraDocumento.update` at the prisma level (not inside transaction) is already mocked for `updateCompraProductoAction` and `deleteCompraProductoAction` — only the `tx.compraDocumento.update` inside `mockTx` is missing.

---

## 5. src/features/compras-servicios/__tests__/actions.test.ts

### Current mock models
**`mockTx` (module-level, before `vi.mock`):**
- `compraServicio`: create
- `tipoPago`: findFirst
- `cuentaBancaria`: findFirst
- `anticipo`: findUnique
- `reconciliacionGasto`: create

**`vi.mock('@/lib/prisma')`:**
- `compraServicio`: findMany, findFirst, update, delete
- `servicios`: findUnique
- `vendor`: findUnique
- `$transaction`: callback-based (passes `mockTx`)

### Missing methods
**None.** All Prisma methods used in tested code paths are covered:

- `getComprasServiciosAction` → `compraServicio.findMany` ✓
- `getCompraServicioByIdAction` → `compraServicio.findFirst` ✓
- `createCompraServicioAction` → `servicios.findUnique` ✓; `vendor.findUnique` skipped (no proveedorId in test); `$transaction` + `mockTx.compraServicio.create` ✓ (anticipo path skipped)
- `updateCompraServicioAction` → `compraServicio.findFirst`, `compraServicio.update` ✓
- `deleteCompraServicioAction` → `compraServicio.findFirst`, `compraServicio.delete` ✓

### Other issues
- The anticipo allocation path is not tested but all needed mock methods are present.
- `applyAnticipoAllocations` is properly mocked ✓.

---

## 6. src/features/servicios/__tests__/actions.test.ts

### Current mock models
**`vi.mock('@/lib/prisma')`:**
- `servicios`: findMany, findFirst, create, update, delete

### Missing methods
**None.** All Prisma methods used in tested code paths are covered:

- `getServiciosAction` → `servicios.findMany` ✓
- `createServicioAction` → `servicios.create` ✓
- `deleteServicioAction` → `servicios.findFirst`, `servicios.delete` ✓

### Other issues
- `getServicioByIdAction` and `updateServicioAction` are not tested, but the mocks have all needed methods (`servicios.findFirst`, `servicios.update`).
- Mock is clean and minimal — no issues.

---

## Summary Table

| # | File | Missing mock items | Severity |
|---|------|-------------------|----------|
| 1 | productos/actions.test.ts | None | ✅ |
| 2 | **ventas/actions.test.ts** | **`$transaction` (entire mock missing), `serieFacturacion`: findFirst/create/update** | 🔴 BLOCKER |
| 3 | venta-servicios/actions.test.ts | None | ✅ |
| 4 | **compras-productos/actions.test.ts** | **`tx.gastoCompra.create`, `tx.compraDocumento.update`** (in `mockTx`) | 🔴 BLOCKER |
| 5 | compras-servicios/actions.test.ts | None | ✅ |
| 6 | servicios/actions.test.ts | None | ✅ |
