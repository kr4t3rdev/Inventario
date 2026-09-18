# Roadmap pendiente — app móvil TCP

Estado: oleada A+B (autenticación y negocio esencial) **completada** en las Fases 6-10.
Documenta lo que queda, fuera de la oleada A+B.

## Oleada A+B — completada

| SDD | Alcance | Estado |
|---|---|---|
| mobile-contabilidad-wiring | Tab Contabilidad cableado a `AccountingShell` (6 módulos SDK) | ✅ Fase 6 |
| mobile-orphan-surfaces | Detalle de producto, stock masivo, perfil; limpieza de código muerto | ✅ Fase 7 |
| mobile-catalog-routes | `/api/mobile/categories`, `/api/mobile/units` | ✅ Fase 8 |
| mobile-inventory-ops-routes | `/api/mobile/transfers`, `/mermas`, `/purchases` | ✅ Fase 9 |
| mobile-secondary-clients | `/api/mobile/contracts`, `/api/mobile/services` (exchange resuelto vía SDK) | ✅ Fase 10 |

Resultado: **0 llamadas de la app a rutas 404** (las 8 detectadas quedan respaldadas o desacopladas).

## Posponido dentro de A+B (pendiente de contrato/formulario)

- `POST /api/mobile/transfers` y `PUT` de transfers/mermas/purchases: sin formulario móvil consumidor; en transfers, contrato multiproducto no alineado con el client de producto único.
- `POST/PUT /api/mobile/contracts`: el client móvil no porta `numeroContrato/tipo/creadoPor` que el modelo exige.
- `PUT /api/mobile/services`.

## Oleada C — POS móvil (turno/arqueo/cuadre)

- Backend ya tiene: `GET /api/ventas/punto-venta/[id]/turno-activo`, `[id]/productos`, `POST /ventas/punto-venta/ventas`.
- Falta REST bearer para: `abrir turno`, `cerrar turno`, `arqueo` (esperados + realizar), `cuadre`. La lógica existe como Server Actions en `features/turnos-pos/actions*.ts` y `features/arqueo-caja/actions.ts`.
- Móvil: `PosSurface` es stub "Próximamente"; requiere cliente + superficie de turno/arqueo.

## Oleada D — Reparaciones móvil

- Backend REST completo bajo `/api/reparaciones/*` (equipos, ordenes, piezas, defectaciones, recibos, catalogo) + helpers `lib/api/reparaciones/*`.
- Falta solo cliente móvil + superficies.

## Oleada E — Reportes, sugerencias y paridad admin

- Reportes contables: SDK `AccountingReportsApi` (accounting/reports/*) sin wrapper ni superficie móvil.
- Sugerencias: `/api/sugerencias/*`.
- Paridad admin: audit-logs, backups, finanzas, migraciones, sistema, subscriptions, planes/referidos admin.

## Deuda técnica detectada (no bloqueante para móvil)

- 22 tests fallando en `src/features/contabilidad/api/__tests__/exchange-handlers.test.ts` (`getBalanceFinanciero` con `activos`/`pasivos` undefined) — preexistentes, ajenos a esta oleada.