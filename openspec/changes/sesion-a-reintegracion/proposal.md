# Proposal: Sesión A — re-integración (revert-del-revert)

## Intent

Sesión A (`feat/correcciones-urgentes-2-datos`, A-1..A-5 + refuerzos) se fusionó
a main en `bd586fc4` y se revirtió en `b4be12ba` sin motivo documentado. Ninguno
de sus fixes fue re-creado por otras vías (verificado ítem por ítem el
2026-10-18), así que main sigue sin:

- **A-1**: guard de borrado de punto de venta y cascadas no destructivas
  (`Restrict`/`SetNull` en 3 FKs del schema + contrato de cascadas).
- **A-2**: alta móvil de mermas alineada al desktop vía servicio compartido.
- **A-3**: ofertas — liberar vínculo al anular venta y guarda de venta vinculada.
- **A-4**: filtros de agregados de stock de PV (BUG-3) — el permiso de
  `completar` ya está en main vía Sesión B (D6, línea idéntica).
- **A-5**: enforcement server del período contable cerrado en gastos.
- **Refuerzos**: `mermaId` string, migración de cascadas, cantidades enteras.

Esta sesión re-lands ese contenido con `git revert b4be12ba` sobre main actual,
resuelve los conflictos conservando TODO lo de Sesión B, y **extiende A-4** con
la semántica de recepción que la Sesión B introdujo (`cantidadRecibida`/PARCIAL).

## Scope

### In Scope

1. Revert-del-revert de `b4be12ba` (39 archivos) sobre main `ac651e79`.
2. Resolución de conflictos conservando Sesión B (despacho EN_TRANSITO,
   PARCIAL acumulativo, higiene de logs B-4, permisos D6) y el refactor
   mecánico de tests de main (helpers `expectActionSuccess/Failure`,
   `tenantRole: 'manager'`, casts).
3. **Extensión A-4/BUG-3**: los agregados de stock de PV usan
   `cantidadRecibida` en filas con recepción — el stock solo se mueve al
   recibir (design de Sesión B, riesgo documentado).
4. Migración de cascadas A-1 re-creada con fecha actual.
5. Gates: suite completa, lint, typecheck, openapi:check.

### Out of Scope

- Refactor de las rutas móviles v1 o cambios al contrato OpenAPI.
- Backfill de filas fantasma COMPLETADA históricas (D7 de Sesión B).
- Cambios de modelo más allá de los `onDelete` de A-1.
- Investigar el motivo original del revert (no documentado).

## Impact

- **Specs**: delta en capability `transferencias` (agregado de stock PV).
- **Código**: 39 archivos re-landed + extensión del agregado en
  `src/features/transferencias/actions.ts`.
- **Base de datos**: una migración nueva (onDelete de 3 FKs).
- **Compatibilidad**: el permiso de `completar` no se duplica (línea idéntica);
  los `console.log` de negocio retirados por B-4 NO vuelven.
