# SDD Spec: Suite de tests 100% verde (0 fallos preexistentes)

> Estado verificado el 2026-08-06:
> - Los 25 fallos eran preexistentes; ninguno fue introducido por los commits de
>   forgot/reset password en la misma rama.
> - Commit de referencia: `bd41773d` (rama `codex/upgrade-next-16`).
> - Suite completa: `461 passed | 1 skipped`, `2582 passed | 1 skipped | 2 todo`.

## Requirement 1: Los tests MUST alinear sus mocks de Prisma con el código actual

Todo test que mockee Prisma MUST exponer los métodos y contratos que el código
de producción realmente invoca. La suite de tests MUST quedar sin fallos.

### Scenario: Login y refresh usan updateMany
- GIVEN `auth-service` que actualiza campos de auth con `prisma.user.updateMany`
- WHEN corre el test de login o de refresh
- THEN el mock expone `user.updateMany` y resuelve `{ count: 1 }`
- AND el assert verifica `user.updateMany` (no `user.update`)

### Scenario: Reconciliación usa $queryRawUnsafe y validación dentro de la transacción
- GIVEN el workflow `pago-gastos-workflow.ts` que usa `tx.$queryRawUnsafe`,
  `tx.cuentaBancaria.findFirst`, `tx.*.findFirst` para re-validar la referencia
  y `updateMany` con `.count`
- WHEN corre el test de la ruta de reconciliación
- THEN `createTxMock` expone todos esos métodos
- AND los asserts cubren `findFirst` (no `findUnique`)

### Scenario: Fecha de creación de usuarios se compara contra ventana dinámica
- GIVEN la comparación de 7/14 días de `getAdminSystemHealthAction` y
  `getAdminFinanceAction` que se calcula contra `Date.now()`
- WHEN corre el test de admin actions
- THEN las fechas de los fixtures se generan con `daysAgo(n)` relativo al momento
  actual (nunca fechas literales fijas)

## Requirement 2: Los tests MUST reflejar el comportamiento vigente del negocio

Cuando el comportamiento de producción cambió por diseño (refactor, nueva
fuente de verdad), el test MUST verificarse contra el nuevo contrato.

### Scenario: Stock del dashboard sale de StockUbicacion
- GIVEN `src/features/dashboard/queries.ts` (líneas 294-307) que agrega
  `stockTotalPorProducto` desde `stockUbicacionesData`
- WHEN corre el test de minimum stock
- THEN el mock alimenta `stockUbicacion.findMany` con `productoId`, `cantidad` y
  `producto` embebido
- AND el stock de la respuesta iguala la cantidad de StockUbicacion (no la de
  `producto.stock`)

### Scenario: Validación de inconsistencia removida en productos-ubicacion
- GIVEN el refactor a `getStockPorUbicacionBatch` que eliminó la validación que
  lanzaba `ServerActionError` cuando stock>0 sin StockUbicacion
- WHEN un producto tiene `stock>0` pero no hay registro de StockUbicacion
- THEN el resultado lo filtra (stockEnUbicacion=0 → excluido) en vez de lanzar

### Scenario: Gating EAN-13 se maneja con requireFeature
- GIVEN `createCategoriaAction` que siempre llama al validator con
  `{ skipEan13Validation: false }` y gatea `categorias-ean13` vía
  `requireFeature(user, 'categorias-ean13', ...)` cuando hay campos CLAS
- WHEN el usuario del tenant no tiene `categorias-ean13` en su plan
- THEN crear categoría sin campos CLAS es exitoso
- AND el assert verifica `{ skipEan13Validation: false }`

## Requirement 3: Los tests MUST usar el canal de datos vigente

Cuando una página migró de API Route a Server Action, el test MUST mockear la
Server Action. Cuando cambió la firma de una API de Next.js, el assert MUST
usar la firma nueva.

### Scenario: Página de finanzas consume Server Action
- GIVEN `/admin/finanzas/page.tsx` que llama `getAdminFinanceAction()` (ya no
  usa `fetch('/api/admin/finance')`)
- WHEN corre el test de la página
- THEN se mockea `getAdminFinanceAction` de `@/features/admin`
- AND se verifica que fue llamada una vez con el shape de `AdminFinance`

### Scenario: revalidateTag usa la firma de Next 16
- GIVEN `updateProfile` que invoca `revalidateTag('Profile', 'max')`
- WHEN corre el test de profile
- THEN el assert verifica `revalidateTag('Profile', 'max')`

## Requirement 4: Los archivos de test obsoletos MUST eliminarse

No MUST existir suites de test sin casos reales (sin `it`/`test`).

### Scenario: Suite fantasma
- GIVEN `src/app/admin/page.test.tsx` que solo contiene `describe` + `beforeEach`
  sin ningún `it`/`test`
- THEN el archivo se elimina
- AND la suite completa queda en verde tras el borrado

## Requirement 5: El alcance del commit MUST restringirse a archivos de test

El commit de arreglo MUST incluir únicamente los 14 archivos de test tocados.
Los cambios ajenos sin commitear en el working tree MUST permanecer intactos.

### Scenario: Commit quirúrgico
- GIVEN cambios ajenos en `src/features/admin/*`, `globals.css`,
  `openspec/changes/renovar-licencia-admin/`, `relases/`, `graphify-out/*`
- WHEN se hace `git add`
- THEN solo se agregan los archivos de test arreglados
- AND `git status` confirma que lo ajeno sigue sin commitear
