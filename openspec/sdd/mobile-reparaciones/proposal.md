# SDD Proposal: Reparaciones en la app móvil

## Business Problem

La sección de Reparaciones (órdenes de trabajo de equipo/servicio técnico) ya existe en el web con rutas REST completas (`/api/reparaciones/*`), pero la app móvil no la expone. El caso más recurrente de un negocio de servicio técnico (abrir y consultar órdenes de reparación) queda fuera de la app.

## Hallazgos (Evidence)

- El backend ya implementa rutas REST para órdenes, equipos, piezas, defectaciones y recibos bajo `/api/reparaciones/*` con `withAuthGet`/`withAuthPost` (bearer-compatible).
- Los modelos son `OrdenReparacion` (con `numeroOrden` autoincremental, `clienteId`, `equipoTipoId`, `marca`, `modelo`, `numeroSerie`, `problemaReportado`, `estado`, `prioridad`, `esGarantia`, `fechaEstimada`), `EquipoReparacion` (tipos), `PiezaReparacion` (items), `DefectacionCatalogo`, `OrdenReparacionItem`.
- `AccionesSurface` en mobile es donde viven otras operaciones (ventas, compras, contratos, etc.).

## Target Users

- Valería de servicio técnico que crea y consulta órdenes de trabajo desde el móvil.

## Scope

### Incluye

- Mobile `reparaciones-api` client para `/api/reparaciones/ordenes` (list, getById, create, update).
- `ReparacionesSurface` (lista órdenes + nueva + edición) con flujo interno.
- Entrada `Reparaciones` en `AccionesSurface` y `BusinessShell`.

### Excluye

- Equipos típicos / piezas / defectaciones / recibos de la app (el web ya los cubre).
- Aplicación de ofertas por complejidad (`complejidad`) — fuera de scope.

## Data Sources

- `OrdenReparacion`, `Cliente`, `EquipoReparacion`.

## Rollback

Reversible: revert del commit de fase (solo repo móvil).