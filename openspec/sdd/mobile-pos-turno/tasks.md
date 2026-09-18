# Tasks: POS móvil — turnos, arqueo y cuadre

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~520 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No — single PR |
| Files touched | ~9 (6 rutas + 1 test + pos-api + PosSurface) |

## Priority & Dependency Order

Rutas backend (puntos→turno→activo→esperados→arqueo→cuadre) → tests backend → pos-api mobile → PosSurface.

---

## Task 1: Rutas `puntos-venta` y `turnos` (abrir/activo)

### Files
- `src/app/api/mobile/pos/puntos-venta/route.ts`
- `src/app/api/mobile/pos/turnos/route.ts` (`POST` abrir)
- `src/app/api/mobile/pos/turnos/activo/route.ts` (`GET` activo)

### Changes
- [ ] `GET /puntos-venta` mapeado.
- [ ] `POST /turnos` valida PdV en tenant + no duplica ABIERTO (409).
- [ ] `GET /turnos/activo` con TURNOS_INCLUDE.

### Verification
- [ ] typecheck root.

---

## Task 2: Rutas arqueo (esperados + registrar)

### Files
- `src/app/api/mobile/pos/turnos/activo/esperados/route.ts`
- `src/app/api/mobile/pos/turnos/arqueo/route.ts`

### Changes
- [ ] `esperados` compute desde ventas del turno.
- [ ] `POST /arqueo` registra conteo + totales + diferencias.

### Verification
- [ ] typecheck root.

---

## Task 3: Ruta cuadre

### Files
- `src/app/api/mobile/pos/turnos/cuadre/route.ts`

### Changes
- [ ] `GET /cuadre` con turno + arqueo + productos + resumen.

### Verification
- [ ] typecheck root.

---

## Task 4: Tests de rutas

### Files
- `src/app/api/mobile/__tests__/pos-turno.test.ts`

### Changes
- [ ] Casos: listar, abrir (201/409/404), activo (null/activo), esperados, arqueo (201), cutoff, cuadre (200/409).

### Verification
- [ ] `pnpm run test:run -- src/app/api/mobile/__tests__/pos-turno.test.ts`.

---

## Task 5: Client mobile `pos-api`

### Files
- `mobile/src/pos-api.ts`, `mobile/src/pos-api.test.ts`

### Changes
- [ ] `createPosApiClient` con los 7 métodos y interfaces TS.

### Verification
- [ ] `pnpm test -- pos-api` en mobile.

---

## Task 6: `PosSurface` operativa

### Files
- `mobile/src/PosSurface.tsx`, opcional `mobile/src/PosSurface.test.tsx`

### Changes
- [ ] Reimplementar: estados `pv-list → turno → arqueo → cuadre`.
- [ ] Actualizar `BusinessShell.renderGestionScreen` para pasar el client (`posApi`).

### Verification
- [ ] `cd mobile && pnpm run typecheck && pnpm test`.

---

## Task 7: Verificación integral

- [ ] `cd root && pnpm run typecheck` + tests objetivo.
- [ ] `cd mobile && pnpm run typecheck && pnpm test`.
- [ ] Commit ambos repos con `(Fase 11)`.