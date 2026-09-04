# Design: POS móvil — turnos, arqueo y cuadre

## Technical Approach

Espejo de Server Actions en rutas non-v1 con autenticación bearer, conservando los guards de plan (`requireFeature`). Mobile adhiere con un client `pos-api` sobre `createHttpClient` (retry + refresh). `PosSurface` deja de ser stub y navega la lista de PdV → turno activo → arqueo/cuadre.

## Detailed Design

### Rutas (root)

Cada ruta sigue el skeleton:abrir con `authenticateUser` + `requireTenant` + `requireFeature`, llama prisma directamente y envuelve en `successResponse`/`errorResponse`.

```
GET  /api/mobile/pos/puntos-venta         → items: [{pvId, nombre, ubicacion, tipoCaja}]
POST /api/mobile/pos/turnos               → { turno } (201)
GET  /api/mobile/pos/turnos/activo?punt…  → { turno|null }
GET  /api/mobile/pos/turnos/activo/espe…  → { esperados }
POST /api/mobile/pos/turnos/arqueo        → { arqueo, diferencias, advertencia? }
GET  /api/mobile/pos/turnos/cuadre?turn…  → cuadre payload
```

`POST /turnos/arqueo` replica el join ventas→diferencias exactamente como `arqueo-caja/actions.ts` (totales = suma billetes×denominación, esperados desde `turno.ventas` con `metodPago[...]:efectivo/tarjeta/transferencia`).

`POST /turnos` replica `abrirTurnoAction` (sin turno ABIERTO paralelo).

`GET /turnos/cuadre` usa `getStockPorUbicacionBatch` — afuera lo empujo como dependencia natural de la feature.

### Mobile client (`pos-api.ts`)

`createPosApiClient(baseUrl, getToken, onUnauthorized?, httpOptions?)` con métodos: `listPuntosVenta`, `abrirTurno`, `getTurnoActivo`, `getEsperados`, `registrarArqueo`, `getCuadre`. Shapes TypeScript 1:1 con las rutas.

### PosSurface (móvil)

Estados internos: `view: 'pv-list' | 'turno' | 'arqueo' | 'cuadre'`.
- `pv-list`: grid con los PdV (Como `GestionSurface`): tap → `view='turno`.
- `turno`: turno activo (métricas de ventas+totales, botones "Registrar arqueo" / "Ver cuadre" / "Cerrar turno") o "Abrir turno" si no hay.
- `arqueo`: contadores CUP denominación x cantidad + observaciones; al guardar → sale a cuadre.
- `cuadre`: productos vendidos vs stock actual + resumen + botón "Cerrar turno" (deshabilitado si no hay arqueo).

"Abrir turno" pide montos iniciales (fondos CUP/USD) vía dos `TextField` numéricos.

### Tests

- Root: `src/app/api/mobile/__tests__/pos-turno.test.ts` (mocks prisma + features flag).
- Mobile: `src/pos-api.test.ts` (client shapes) + actualización de `PosSurface` flow tests no requerida (sin test previo) — opcional si `PosSurface.test.tsx` no existe.

## Riesgos y mitigación

- **`realizarArqueo` extensa en aritmética:** espejo bit-a-bit; tests aciertan la mutación del modelo.
- **`PosSurface` no tenía test:** no hay regresión — añado nuevo.
- **`requireFeature` mío en rutas móviles:** hace 403 si el plan no incluye `turnos-pos`; el mobile muestra error plano y quedó cubierto por `session-http-options`.