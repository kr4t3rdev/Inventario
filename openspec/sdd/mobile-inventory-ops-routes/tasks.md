# Tasks: Rutas móviles de operaciones de inventario

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~520 (6 rutas + 1 test + 4 docs) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No — single PR |
| Files touched | 7 en root |

## Priority & Dependency Order

Mermas (simpler) → Purchases → Transfers (delete con stock) → tests.

---

## Task 1: Rutas de mermas

### Files
- `src/app/api/mobile/mermas/route.ts`, `src/app/api/mobile/mermas/[id]/route.ts`

### Changes
- [ ] `mapMerma`; `GET`/`POST`; `GET`/`DELETE` en `[id]`.
- [ ] `POST` decrementa stock; `DELETE` restaura stock.

### Verification
- [ ] typecheck root.

---

## Task 2: Rutas de compras

### Files
- `src/app/api/mobile/purchases/route.ts`, `src/app/api/mobile/purchases/[id]/route.ts`

### Changes
- [ ] `mapCompra` (compraProductoId→compraId); `GET`/`POST`; `GET`/`DELETE` soft-delete.

### Verification
- [ ] typecheck root.

---

## Task 3: Rutas de transferencias

### Files
- `src/app/api/mobile/transfers/route.ts`, `src/app/api/mobile/transfers/[id]/route.ts`

### Changes
- [ ] `mapTransferencia` + `tipoTransferencia`; `GET`; `GET`/`DELETE` idempotente con revert de stock si `COMPLETADA`.

### Verification
- [ ] typecheck root.

---

## Task 4: Tests

### Files
- `src/app/api/mobile/__tests__/transfers-mermas-purchases.test.ts`

### Changes
- [ ] Mapeo de listados, POST, 404, delete.

### Verification
- [ ] `pnpm run test:run -- src/app/api/mobile/__tests__/transfers-mermas-purchases`.

---

## Task 5: Verificación integral

- [ ] Root `pnpm run typecheck`.
- [ ] Tests objetivo.
- [ ] Documentar en resumen el alcance diferido (POST/PUT).