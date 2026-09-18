# SDD Proposal: Arreglar 25 tests fallando preexistentes

## Business Problem

La suite de tests de la aplicación reportaba **25 tests fallando en 14 archivos**.
Todos eran fallos preexistentes (ninguno fue introducido por el trabajo de
forgot/reset password que se estaba realizando en la misma rama). Los tests
fallaban porque el código evolucionó y los tests quedaron desactualizados:

- **Mocks de Prisma incompletos**: el código migró de `user.update` a
  `user.updateMany`, de `$queryRaw` a `$queryRawUnsafe`, de `findUnique` a
  `findFirst`, y agregó dependencias nuevas (`cloudinaryAsset.findMany`,
  `requireFeature`) que los mocks no exponían.
- **Comportamiento cambiado**: el stock del dashboard ahora se calcula desde
  `StockUbicacion` (fuente de verdad) en vez de `producto.stock`; se eliminó la
  validación de inconsistencia stock>0 sin StockUbicacion; el gating de
  `categorias-ean13` pasó de `skipEan13Validation` al flag `requireFeature`.
- **Tests dependientes del tiempo**: usaban fechas fijas (`2026-07-05`) que ya
  quedaron fuera de la ventana de 7/14 días comparada contra la fecha actual.
- **Migración a Server Actions**: la página `/admin/finanzas` dejó de usar
  `fetch('/api/admin/finance')` y ahora llama `getAdminFinanceAction()`.
- **Next.js 16**: `revalidateTag` ahora recibe `('tag', 'max')`.
- **Suite fantasma**: `src/app/admin/page.test.tsx` no tenía ningún `it()`/`test()`.

## Current State (antes de la intervención)

```
Suite completa: 25 failed | 2557 passed | 1 skipped | 2 todo (14 files)
pnpm lint: 109 errores preexistentes en archivos no tocados (ajenos)
```

## Scope: lo que SÍ entra

- **Cat. A** — Alinear mocks de Prisma desactualizados con el código actual
  (`updateMany`, `$queryRawUnsafe`, `findFirst`, `cloudinaryAsset.findMany`,
  `requireFeature`, `select` + `salesAgentReferrals/Profile/Balance`).
- **Cat. B** — Actualizar tests cuyo comportamiento esperado cambió
  (StockUbicacion como fuente de stock, validación de inconsistencia removida,
  `skipEan13Validation: false` siempre, fechas dinámicas).
- **Cat. C** — Alinear tests con migraciones a Server Actions y la firma de
  `revalidateTag` de Next 16.
- **Cat. D** — Eliminar la suite fantasma `src/app/admin/page.test.tsx`.

## Out of Scope: lo que NO entra

- No se modifica código de producción (solo tests).
- No se tocan los cambios ajenos sin commitear en el working tree
  (`src/features/admin/actions.ts`, `index.ts`, `schemas.ts`,
  `src/app/admin/licencias/page.tsx`, `globals.css`,
  `openspec/changes/renovar-licencia-admin/`, `relases/`,
  `src/features/admin/__tests__/renew-licencia.test.ts`, `graphify-out/*`).
- No se arreglan los 109 errores de lint preexistentes en archivos ajenos.

## Solution Sketch

```
25 tests fallando en 14 archivos
  │
  ├── Cat. A (7 archivos): actualizar mocks de Prisma
  │     auth/actions, auth/refresh route, reconciliacion gastos route,
  │     userMetrics, actions-periodos-arqueo, reparaciones ordenes,
  │     admin server data
  │
  ├── Cat. B (4 archivos): alinear comportamiento esperado
  │     productos-ubicacion, dashboard stats-minimum-stock,
  │     categorias actions, admin actions (fechas dinámicas)
  │
  ├── Cat. C (2 archivos): migración SA + Next 16
  │     /admin/finanzas page (mock getAdminFinanceAction),
  │     profile (revalidateTag('Profile', 'max'))
  │
  └── Cat. D (1 archivo): eliminar suite fantasma
        src/app/admin/page.test.tsx
```

## Risk Assessment

| Riesgo | Nivel | Mitigación |
|--------|-------|------------|
| Cambiar tests para que pasen "a ciegas" (false green) | Medio | Cada cambio verifica el comportamiento real del código actual; assert actualizado al contrato vigente |
| Mocks incompletos sigan ocultando llamadas nuevas | Medio | Suite completa corrió y quedó en 0 fallos |
| Regresión en tests que ya pasaban | Bajo | Solo se tocaron los 14 archivos con fallos |
| Commit incluye cambios ajenos | Medio | `git add` explícito de los 14 archivos de test; verificado con `git status` |

## Acceptance Criteria

- [x] Suite completa sin fallos: `2582 passed | 1 skipped | 2 todo` (0 failed).
- [x] Lint pasa en los 9 archivos de test tocados (no solo los que se corrigen).
- [x] No se modifica ningún archivo de producción.
- [x] Commit `bd41773d` en rama `codex/upgrade-next-16` solo incluye los 14 archivos de test.
- [x] Push a `origin/codex/upgrade-next-16` completado.
