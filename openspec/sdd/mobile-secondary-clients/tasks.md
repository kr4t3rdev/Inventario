# Tasks: Clientes secundarios — contratos y servicios

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~260 (4 rutas + 1 test + 4 docs) |
| 400-line budget risk | Low |
| Chained PRs recommended | No — single PR |
| Files touched | 5 en root |

## Priority & Dependency Order

Contratos (más simple) → Servicios → tests.

---

## Task 1: Rutas de contratos

### Files
- `src/app/api/mobile/contracts/route.ts`, `src/app/api/mobile/contracts/[id]/route.ts`

### Changes
- [ ] `mapContrato` (titulo←numeroContrato, ANULADO→CANCELADO).
- [ ] `GET` / `GET [id]` / `DELETE [id]` con tenant scope.

### Verification
- [ ] typecheck root.

---

## Task 2: Rutas de servicios

### Files
- `src/app/api/mobile/services/route.ts`, `src/app/api/mobile/services/[id]/route.ts`

### Changes
- [ ] `mapServicio` (estado:'ACTIVO').
- [ ] `GET`/`POST`; `GET`/`DELETE` en `[id]` con guard `HAS_REFERENCES`.

### Verification
- [ ] typecheck root.

---

## Task 3: Tests

### Files
- `src/app/api/mobile/__tests__/contracts-services.test.ts`

### Changes
- [ ] Mapeo, estado, 404, 409.

### Verification
- [ ] `pnpm run test:run -- src/app/api/mobile/__tests__/contracts-services`.

---

## Task 4: Verificación integral

- [ ] Root typecheck + tests objetivo.
- [ ] Resumen: 0 rutas 404 restantes de la oleada A+B.