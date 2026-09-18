# Tasks: Arreglar 25 tests fallando preexistentes

> Estado: COMPLETADO — commit `bd41773d` (rama `codex/upgrade-next-16`).
> Suite completa verificada: 2582 passed | 1 skipped | 2 todo (0 failed).

## Task 1: Cat. D — Eliminar suite fantasma
- [x] Eliminar `src/app/admin/page.test.tsx` (0 tests reales)

Files: `src/app/admin/page.test.tsx` (DELETE)
Depends on: Nothing

## Task 2: Cat. A — Mocks de auth (login + refresh)
- [x] `user.update` → `user.updateMany` en mocks y asserts

Files: `src/features/auth/__tests__/actions.test.ts`, `src/app/api/auth/refresh/__tests__/route.test.ts` (MODIFY)
Depends on: Nothing

## Task 3: Cat. A — Mock de reconciliación de gastos
- [x] Alinear `createTxMock` con `pago-gastos-workflow.ts` (`$queryRawUnsafe`, `findFirst`, `updateMany`)

Files: `src/app/api/contabilidad/reconciliacion/gastos/__tests__/route.test.ts` (MODIFY)
Depends on: Nothing

## Task 4: Cat. A — Mocks restantes
- [x] `userMetrics.test.ts`: `$queryRaw` → `$queryRawUnsafe`
- [x] `actions-periodos-arqueo.test.ts`: agregar `requireFeature` al mock de tenant-scope
- [x] `ordenes.test.ts`: agregar `cloudinaryAsset.findMany`
- [x] `data.test.ts` (admin server): mock con `select` + `salesAgent*`; asserts con `objectContaining` anidados

Files: `src/lib/admin/__tests__/userMetrics.test.ts`, `src/features/contabilidad/__tests__/actions-periodos-arqueo.test.ts`, `src/lib/api/reparaciones/ordenes.test.ts`, `src/features/admin/server/data.test.ts` (MODIFY)
Depends on: Nothing

## Task 5: Cat. B — Alinear comportamiento vigente
- [x] `productos-ubicacion.test.ts`: reescribir test de inconsistencia → filtrado
- [x] `stats-minimum-stock.test.ts`: alimentar `stockUbicacion.findMany` (4 tests)
- [x] `categorias/actions.test.ts`: assert `{ skipEan13Validation: false }`
- [x] `admin/actions.test.ts`: fechas dinámicas con `daysAgo(n)`; revenue `1500/800`

Files: `src/lib/api/productos-ubicacion.test.ts`, `src/app/api/dashboard/__tests__/stats-minimum-stock.test.ts`, `src/features/categorias/__tests__/actions.test.ts`, `src/features/admin/__tests__/actions.test.ts` (MODIFY)
Depends on: Nothing

## Task 6: Cat. C — Migración a Server Actions y Next 16
- [x] `finanzas/page.test.tsx`: mockear `getAdminFinanceAction` (no fetch)
- [x] `profile.test.ts`: assert `revalidateTag('Profile', 'max')`

Files: `src/app/admin/finanzas/page.test.tsx`, `src/app/actions/profile.test.ts` (MODIFY)
Depends on: Nothing

## Task 7: Verificación
- [x] Suite completa: `pnpm exec vitest run` → 0 failed (2582 passed)
- [x] Lint: `pnpm exec eslint <9 archivos>` → limpio
- [x] Commit quirúrgico `bd41773d` (14 archivos de test, sin cambios ajenos)
- [x] Push a `origin/codex/upgrade-next-16`

Depends on: Tasks 1-6
