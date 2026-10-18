# Tasks: Sesión A — re-integración (revert-del-revert)

## 1. Preparación

- [x] 1.1 Rama `feat/sesion-a-reintegracion` desde `origin/main` (ac651e79)
- [x] 1.2 Change openspec: proposal, design, tasks, delta de spec

## 2. Revert-del-revert

- [x] 2.1 `git revert --no-commit b4be12ba` — 39 archivos, 3 conflictos reales
- [x] 2.2 Resolver `transferencias/actions.ts` (comentario B-2; permiso idéntico)
- [x] 2.3 Resolver tests de gastosDE (imports fusionados + guard toggle + `manager`)
- [x] 2.4 Retirar los `console.log` de negocio re-introducidos (higiene B-4) — verificado: el revert-of-revert no los re-introdujo (Sesión A ya los había retirado)
- [x] 2.5 Verificar staged diff completo y marcar resueltos

## 3. Extensión BUG-3 (TDD)

- [x] 3.1 RED: tests del agregado — PARCIAL aporta `cantidadRecibida`;
      PENDIENTE/APROBADA/EN_TRANSITO aportan 0; CANCELADA/RECHAZADA/deleted
      excluidas; venta ANULADA/eliminada no consume (5 fallos capturados)
- [x] 3.2 GREEN: implementar en `getStockDisponibleEnPuntoVenta` vía
      `calcularAporteRecibido` (lib/stock-pv.ts) + findMany — 62/62
- [x] 3.3 Suite de transferencias + reportes/dashboard relacionada verde (62/62 scoped)

## 4. Migración de cascadas (A-1)

- [x] 4.1 Re-crear la migración con fecha 2026-10-18 (ON DELETE de 3 FKs) —
      re- fechada de 20260926000000 a 20261018103000_hardening_catalog_on_delete
- [x] 4.2 `prisma generate` y revisión del SQL (idempotente: DROP+ADD)

## 5. Gates

- [x] 5.0 Fix preexistente de main detectado por la suite: permisos de las
      rutas móvil v1 de gestión-4 en el route-map (drift PG-07) —
      `categorias`, `listas-precios`, `puntos-venta`
- [x] 5.1 Suite completa unitaria verde: 4583/4583 (717 archivos, exit 0)
- [x] 5.2 `pnpm run lint` 0 errores (416 warnings preexistentes) y
      `pnpm run typecheck` 0 errores
- [x] 5.3 `pnpm run openapi:check` verde (lint + paridad + smoke + generate:check)

## 6. Cierre

- [x] 6.1 Code review del diff completo (skill, motor Claude): APPROVE, sin
      críticos/altos; hallazgo documentado: el revert trajo de vuelta el
      change openspec ORIGINAL de Sesión A (`correcciones-urgentes-2-datos`),
      que se conserva junto al de esta sesión
- [x] 6.2 Merge a main + push (con graphify update)

## Notas de verificación (2026-10-18)

- Revert-del-revert: 39 archivos, 36 auto-merge, 3 conflictos resueltos
  (comentario de permiso en transferencias, 2 headers de tests de gastosDE).
- BUG-3 extendido con TDD: RED con 5 fallos capturados → GREEN 62/62
  (helper puro `calcularAporteRecibido` con 7 tests + 5 escenarios de
  integración vía `createTransferenciaAction`).
- La extensión va más allá del F-4 original (que solo filtraba estados):
  ahora el aporte por fila es `cantidadRecibida` — ver design D3 y el delta
  de spec.
- Suite completa: 4583/4583 · lint 0 errores · typecheck 0 errores ·
  openapi:check exit 0.
