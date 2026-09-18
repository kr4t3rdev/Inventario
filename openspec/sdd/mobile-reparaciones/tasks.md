# Tasks: Reparaciones en la app móvil

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No — single PR |
| Files touched | 6 (1 client + 1 surface + tests) |

## Priority & Dependency Order

Client → tests → surface → wiring (Acciones + App.tsx).

---

## Task 1: Client `reparaciones-api`

### Files
- `mobile/src/reparaciones-api.ts`
- `mobile/src/reparaciones-api.test.ts`

### Changes
- [ ] `createReparacionesApiClient` con `list`, `create`, `update`, `getById`.
- [ ] Mapeo de payload (cliente, equipoTipo, montar).

### Verification
- [ ] `pnpm run typecheck`.
- [ ] `pnpm test -- reparaciones-api`.

---

## Task 2: `ReparacionesSurface` + Acciones entry

### Files
- `mobile/src/ReparacionesSurface.tsx`
- `mobile/src/ReparacionesSurface.test.tsx`
- `mobile/src/AccionesSurface.tsx` (entry)

### Changes
- [ ] Lista + detalle + crear/editar (estado, nota, prioridad).
- [ ] Entry `Reparaciones` in `AccionesSurface`.

### Verification
- [ ] `cd mobile && pnpm run typecheck && pnpm test`.

---

## Task 3: Wiring en App.tsx / BusinessShell

### Files
- `mobile/App.tsx`
- `mobile/src/BusinessShell.tsx`

### Changes
- [ ] Crear `reparacionesApi` y pásar a `BusinessShell`.
- [ ] Render en `gestion` de Acciones.

### Verification
- [ ] `pnpm run typecheck` y `pnpm test`.