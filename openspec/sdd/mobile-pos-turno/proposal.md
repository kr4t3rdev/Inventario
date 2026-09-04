# SDD Proposal: POS móvil — turnos, arqueo y cuadre

## Business Problem

`PosSurface` en la app móvil es un stub de "Próximamente". El backend web sí opera turnos de caja (abrir, arquear, cerrar, cuadrar) pero toda esa lógica vive como Server Actions con cookie-auth. Solo tres rutas REST existen (`GET turno-activo`, `GET productos`, `POST ventas`). Para que un cajero móvil pueda abrir su turno, contar efectivo, arquear y cuadrar, faltan cinco endpoints REST asequibles por bearer.

## Hallazgos (Evidence)

### H1 — Turno activo y productos POS ya son REST

`GET /api/ventas/punto-venta/[id]/turno-activo`, `GET /api/ventas/punto-venta/[id]/productos` y `POST /api/ventas/punto-venta/ventas` usan `withAuthGet/Post` (bearer-ok).

### H2 — Ciclo de turno solo en Server Actions (cookie)

`src/features/turnos-pos/actions.ts`: `abrirTurnoAction` (valida PV en tenant + excluye turno ABIERTO concurrente), `cerrarTurnoAction` (exige último arqueo y tolerancia $0.01 vs ventas), `getTurnosAction`, `getTurnoActivoAction`.

### H3 — Arqueo solo en Server Actions

`src/features/arqueo-caja/actions.ts`: `realizarArqueoAction` (cuenta billetes CUP + USD + totales no-efectivo, calcula esperados desde ventas del turno y diferencias), `getEsperadosArqueoAction`, `getArqueosAction`.

### H4 — Cuadre depende de arqueo previo

`src/features/turnos-pos/actions-cuadre.ts`: `getCuadreTurnoAction` (productos vendidos en el turno + stock actual del PV desde `getStockPorUbicacionBatch`).

### H5 — Modelos

`TurnoPuntoVenta` (id, tenantId, puntoDeVentaId, empleadoId?, tipo, fechaApertura, fechaCierre, fondoInicialCup/Usd, estado ABIERTO|CERRADO, observaciones), `ArqueoCaja` (conteo + totales + esperados + diferencias), `PuntoDeVenta` (pvId, tenantId, nombre, ubicacion?, tipoCaja PRINCIPAL).

## Target Users

- Cajeros (empleado) que abren su turno en un POS, registran el arqueo y cierran.

## Scope

### Incluye

Rutas non-v1 bajo `/api/mobile/pos/`:
- `GET /puntos-venta` — listar PdVs del tenant.
- `POST /turnos` — abrir turno (espejo `abrirTurnoAction`).
- `GET /turnos/activo?puntoDeVentaId=` — turno activo.
- `GET /turnos/activo/esperados` — esperados del arqueo (`turnoId` implícito).
- `POST /turnos/arqueo` — registrar arqueo.
- `GET /turnos/cuadre?turnoId=` — cuadre.

Móvil: `pos-api` client (`createHttpClient`) y `PosSurface` operativo (lista PdV, abrir turno, ver turno activo, registrar arqueo, ver cuadre, cerrar turno).

### Excluye

- Vender desde móvil (usa `POST /api/ventas/punto-venta/ventas` existente; la UI de caja-venta es otro paquete).
- Cierre automático desde turno AUTO de POS móvil/secundario (tipo POS MOVIL no es el flujo aquí).
- ¡Cuadre-diario! (reportes globales) — fuera.
- Editor de puntos de venta (CRUD) en mobile.

## Data Sources

- `TurnoPuntoVenta`, `ArqueoCaja`, `PuntoDeVenta`, `Venta` (sin migración).

## Rollback

Reversible: revert del commit de la fase (rutas nuevas + mobile-notario).