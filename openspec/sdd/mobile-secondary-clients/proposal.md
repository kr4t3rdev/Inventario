# SDD Proposal: Clientes secundarios — contratos, servicios y exchange

## Business Problem

Quedan dos rutas 404 móviles: `/api/mobile/contracts` y `/api/mobile/services`. El tercer ítem del plan (exchange) ya no aplica: `exchange-converter-api` y `ExchangeSurface` se eliminaron en SDD-02 como código muerto, y el exchange canónico es el SDK `v1/accounting/exchange` (cubierto por la paridad OpenAPI). Repointar `contracts-api` a `/api/contratos` del web es inviable porque esa ruta devuelve `{ data, meta }` (no `{ items }`) y no filtra por `tenantId`. Se crean rutas propias non-v1 con el patrón vigente.

## Hallazgos (Evidence)

### H1 — Contratos (web REST) no sirve para móvil

`src/features/contratos/api/handlers.ts:116` devuelve `{ data: contratos, meta }`; el `where` (líneas 88-93) no incluye `tenantId`. El client móvil espera `{ items }`.

### H2 — Modelos

- `Contrato { contratoId, tenantId, numeroContrato, tipo, estado (EstadoContrato), fechaInicio, fechaFin?, monto: Decimal?, observaciones?, clienteId?, vendorId?, ... }`. Enum: BORRADOR, PENDIENTE_APROBACION, APROBADO, RECHAZADO, ACTIVO, FINALIZADO, ANULADO.
- `Servicios { servicioId, tenantId, nombre, precio, descripcion, moneda (default CUP), ... }` — **sin** campo `estado` ni `deletedAt`.

### H3 — Contrato móvil

`mobile/src/contracts-api.ts` tipa `Contrato { contratoId, clienteId, titulo, descripcion?, monto, estado: ACTIVO|FINALIZADO|CANCELADO, fechaInicio, fechaFin?, cliente? }`. Los campos `titulo` y `descripcion` no existen así en el modelo (mapeo a `numeroContrato`/`observaciones`). `ContractsSurface` solo usa `list()` y `remove(id)`.

### H4 — Servicio móvil

`mobile/src/services-api.ts` tipa `Servicio { servicioId, nombre, descripcion?, precio, estado: ACTIVO|INACTIVO, ... }`. `ServicesSurface` usa `list()` y `remove(id)`. El modelo no tiene `estado` (se emite `ACTIVO` como valor constante de catálogo).

## Target Users

- Compradores que consultan contratos y servicios, y cancelan/eliminan registros.

## Scope

### Incluye

- `GET`/`GET [id]`/`DELETE [id]` para contratos.
- `GET`/`GET [id]`/`POST`/`DELETE [id]` para servicios (crear es simple; borrado con guard `HAS_REFERENCES`).
- Mappers de `estado` (ANULADO→CANCELADO), `titulo←numeroContrato`.
- Tests vitest.

### Excluye (diferido)

- `POST/PUT` de contratos: botón "Nuevo contrato" es stub y el client móvil no porta `numeroContrato/tipo/creadoPor` que el modelo exige.
- `PUT` de servicios: sin formulario móvil.
- Exchange: ya resuelto vía SDK.

## Data Sources

- Modelos `Contrato`, `Servicios` (sin migración).

## Rollback

Reversible: revert del commit.