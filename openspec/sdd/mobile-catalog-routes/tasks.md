# Tasks: Rutas móviles de catálogo — categorías y unidades

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~260 (4 rutas + 1 test + matrix) |
| 400-line budget risk | Low |
| Chained PRs recommended | No — single PR (root), luego sync móvil |
| Files touched | 5 en root + 1 en mobile |

## Priority & Dependency Order

Rutas list → [id] → tests → matrix. Categories antes que Units (más simple, sin P2002/in-use).

---

## Task 1: Rutas de categorías

### Files
- `src/app/api/mobile/categories/route.ts`
- `src/app/api/mobile/categories/[id]/route.ts`

### Changes
- [ ] `mapCategoria` exportado desde `route.ts`.
- [ ] `GET`/`POST` en `route.ts`; `GET`/`PUT`/`DELETE` en `[id]/route.ts`.
- [ ] Validación `nombre` trimmed 1..100; tenant scope.

### Verification
- [ ] `pnpm run typecheck` (root).

---

## Task 2: Rutas de unidades

### Files
- `src/app/api/mobile/units/route.ts`
- `src/app/api/mobile/units/[id]/route.ts`

### Changes
- [ ] `mapUnidad` (simbolo→abreviatura).
- [ ] `GET`/`POST` en `route.ts`; `GET`/`PUT`/`DELETE` en `[id]/route.ts`.
- [ ] Capturar P2002 → `409 CONFLICT`; in-use → `409 IN_USE`.

### Verification
- [ ] `pnpm run typecheck` (root).

---

## Task 3: Tests de ruta

### Files
- `src/app/api/mobile/__tests__/categories-units.test.ts`

### Changes
- [ ] Harness `vi.hoisted` + mocks prisma/auth.
- [ ] Casos: listado mapeado, create, validación 400, 403, 404, 409 conflict, 409 in-use.

### Verification
- [ ] `pnpm run test:run -- src/app/api/mobile/__tests__/categories-units.test.ts`.

---

## Task 4: Validar shapes móviles y docs

### Files
- `mobile/docs/mobile-endpoint-matrix.md`

### Changes
- [ ] Registrar rutas `/api/mobile/categories` y `/api/mobile/units` con estado LIVE.
- [ ] Confirmar que `categories-api.ts`/`units-api.ts` no requieren cambios (clients ya consumen `{items}`).

### Verification
- [ ] `cd mobile && pnpm run typecheck && pnpm test`.

---

## Task 5: Verificación integral

- [ ] Root: `pnpm run typecheck` + tests objetivos.
- [ ] Mobile: `pnpm run typecheck` + `pnpm test`.
- [ ] Smoke manual: `GET /api/mobile/categories` y `/units` devuelven `{items:[]}` con backend local.