# Spec: POS móvil — turnos, arqueo y cuadre

## Requisitos funcionales

### RF-1 — Listar puntos de venta

`GET /api/mobile/pos/puntos-venta` → `200 { items: [{ pvId, nombre, ubicacion, tipoCaja }] }` scoped por tenant.

### RF-2 — Abrir turno

`POST /api/mobile/pos/turnos` con `{ puntoDeVentaId, fondoInicialCup?, fondoInicialUsd?, empleadoId?, observaciones? }`:
- `404` si el PdV no pertenece al tenant.
- `409 CONFLICT` si ya hay turno `ABIERTO` en ese PdV.
- `201` con el turno creado (incluye `puntoDeVenta` y `empleado`).

### RF-3 — Turno activo

`GET /api/mobile/pos/turnos/activo?puntoDeVentaId=` → `200 { turno }` (`turno` puede ser `null`); incluye arqueos (último), ventas (totales) y conteo.

### RF-4 — Esperados del arqueo

`GET /api/mobile/pos/turnos/activo/esperados?puntoDeVentaId=` → `200 { esperados }` con `esperadoEfectivoCup`, `esperadoEfectivoUsd`, `esperadoTarjeta`, `esperadoTransferencia`, `esperadoCredito`, `fondoInicialCup`, `fondoInicialUsd`, `ventasEfectivoCup`, `ventasEfectivoUsd`; `404` si no hay turno ABIERTO.

### RF-5 — Registrar arqueo

`POST /api/mobile/pos/turnos/arqueo` con `{ turnoId, ...conteo, totalTarjeta, totalTransferencia, totalCredito, observaciones? }`:
- `404` si el turno no es del tenant.
- `409 CONFLICT` si el turno no está ABIERTO.
- `201` con `{ arqueo, diferencias: { cup, usd }, advertencia? }`.

### RF-6 — Cuadre

`GET /api/mobile/pos/turnos/cuadre?turnoId=` → `200 { turno, arqueo, totalVentaTurno, productos[], resumen }`; `404` turno no del tenant; `409 NO_ARQUEO` si falta el arqueo.

### RF-7 — Feature flags

Todos DEBEN respetar `requireFeature(user, 'turnos-pos' | 'puntos-venta', ...)` antes de ejecutar.

## Requisitos no funcionales

### RNF-1 — Sin regresión

No afectan paridad `mobile/v1`; no rompen los `__integration__` tests del root (excluidos por defecto).

### RNF-2 — Stock of truth

El cuadre lee de `StockUbicacion` (Fase 4), no de `producto.stock`.

## RFC 2119

"DEBE" expresa requisito normativo.