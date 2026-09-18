# Tasks: Bulk Price Update — Ficha de Costo

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1100–1400 (2 actions + tests + UI + page + sidebar + seed) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (WU1: actions) → PR 2 (WU2: plan gate) → PR 3 (WU3: UI) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

> Action names below follow the **spec** contract (`bulkApplyPercentageAction`, `bulkApplyTemplateAction`), not the proposal draft.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Tipos + 2 server actions + refactor `recordCostChange` + tests | PR 1 | Base `main`; ~500 líneas; sin UI |
| 2 | Plan key `ficha-costo-precios-masivo` + Empresarial + tests | PR 2 | Base `main`; depende solo del spec |
| 3 | Página `/busy/ficha-costo/bulk` + client component + tests + sidebar | PR 3 | Base `main`; depende de WU1 y WU2 |

---

## Work Unit 1: Server Actions (TDD)

### Tarea 1.1: RED — Tests de `bulkApplyPercentageAction`
- [ ] Crear `src/features/ficha-costo/__tests__/actions-bulk.test.ts`
- [ ] Mockear `@/lib/server-actions/get-current-user`, `@/lib/services/tenant-scope` (`requireTenant`, `requireFeature`, `requireManagerRole`), `@/lib/cost-history-utils` (`recordCostChange`, `CostChangeReason`), `next/cache` (`revalidatePath`), `@/lib/prisma` (`producto.findFirst`, `producto.update`, `productoCostHistory.create`, `$transaction`).
- [ ] Escribir 9 tests (AAA):
  1. Happy path: 3 productos `pv=[100,200,50]`, `porcentaje=10` → `updated=3`, `results=[{110,220,55}]`, 3 `productoCostHistory.create` con `reason='ADJUSTMENT'`
  2. Porcentaje negativo: `pv=200, porcentaje=-25` → `newPrecio=150` (`Math.round(200*0.75)`)
  3. Multi-tenant: `p1` de T1 + `pX` de T2 → `p1` ok, `pX` en `errors` con `code='NOT_FOUND'`, sin history row
  4. Non-manager: `tenantRole='viewer'` → `success: false`, `error.code='FORBIDDEN'`, sin update
  5. `porcentaje=0` → Zod reject (`porcentaje` strict > 0), sin update
  6. `porcentaje=1000` → Zod reject (`porcentaje` strict < 1000), sin update
  7. `porcentaje=999.99` (upper bound exclusive) → ok, `pv=100` → `Math.round(100*10.9999)`
  8. Empty selection `productoIds=[]` → `{updated:0, skipped:0, errors:[], results:[]}` sin throw
  9. Chunking 120 ids → `$transaction` llamado 3 veces con `[50, 50, 20]` ids
- [ ] Correr `pnpm test:run src/features/ficha-costo/__tests__/actions-bulk.test.ts` → **DEBE FALLAR** (archivo no existe)

### Tarea 1.2: RED — Tests de `bulkApplyTemplateAction` (mismo archivo)
- [ ] Agregar mock de `prisma.productoCostSheetTemplate.findFirst` (template lookup), `prisma.producto.findFirst` (con `plantillaActiva` join)
- [ ] Escribir 6 tests:
  1. Happy path: 3 productos con `plantillaActiva=TPL v3 precioSugerido=150`, `pv=[100,200,50]` → `updated=3, skipped=0`, todos quedan en `150`, 3 history rows con `reason='MANUAL_EDIT'` y `notes` conteniendo `v3` y `masivo`
  2. Skip sin plantilla: `p1,p3` con plantilla + `p2` con `plantillaActiva=null` → `updated=2, skipped=1`, `p2` en `results` con flag skipped, sin history row
  3. Multi-tenant producto cross-tenant → en `errors` con `NOT_FOUND`, sin update
  4. Non-manager → `FORBIDDEN`, sin update
  5. Template de otro tenant → `ActionError('Plantilla no encontrada', 'NOT_FOUND')` sin updates
  6. Chunking 120 productos con plantilla → template fetched 1 vez (cached en closure), `$transaction` 3 veces
- [ ] Correr tests → **DEBEN FALLAR** (action no existe)

### Tarea 1.3: GREEN — Refactor `recordCostChange`
- [ ] Modificar `src/lib/cost-history-utils.ts`
- [ ] Agregar campo opcional `existingProducto?: { id: string }` a `RecordCostChangeParams`
- [ ] Si `existingProducto?.id === params.productoId` → skip el `prisma.producto.findUnique` interno
- [ ] Si `existingProducto?.id !== params.productoId` → throw con el id original (defensa)
- [ ] Sin `existingProducto` → comportamiento actual intacto (backward compatible)
- [ ] JSDoc actualizado en `@param` y `@returns`
- [ ] Correr suite existente de ficha-costo (`pnpm test:run src/features/ficha-costo`) → **NO DEBE ROMPER** (84+ tests previos)

### Tarea 1.4: GREEN — Agregar tipos en `types.ts`
- [ ] Modificar `src/features/ficha-costo/types.ts`
- [ ] Agregar interfaces:
  - `BulkApplyPercentageInput { porcentaje: number; productoIds: string[]; notes?: string }`
  - `BulkApplyTemplateInput { plantillaId: string; productoIds: string[]; notes?: string }`
  - `BulkPriceResult { updated: number; skipped: number; errors: Array<{ productoId: string; message: string; code?: string }>; results: Array<{ productoId: string; oldPrecio: number; newPrecio: number; skipped?: boolean }> }`
- [ ] JSDoc en español en cada interfaz

### Tarea 1.5: GREEN — Implementar actions
- [ ] Crear `src/features/ficha-costo/actions-bulk.ts` con `'use server'`
- [ ] Importar: `zod`, `revalidatePath`, `withAction`, `ActionError`, `prisma`, `requireTenant`, `requireFeature`, `requireManagerRole`, `recordCostChange`, `CostChangeReason`
- [ ] Constante `BULK_CHUNK_SIZE = 50` (documentar motivo: safety cap por `$transaction`)
- [ ] Helper privado `chunk<T>(arr: T[], size: number): T[][]` (5 líneas, sin deps)
- [ ] Helper privado `safeParseProductos(ids: string[]): { id: string; ok: true } | { id: string; ok: false; error: string }` (try/catch wrapper por producto)
- [ ] **Implementar `bulkApplyPercentageAction = withAction(async (input, user) => ...)`**:
  1. `requireTenant(user)` + `requireManagerRole(user, 'ajustar precios masivamente')` + `requireFeature(user, 'ficha-costo-precios-masivo', 'ajustar precios masivamente')`
  2. Zod: `porcentaje > 0 && < 1000`, `productoIds: z.array(z.string()).max(500)` (sanity)
  3. Si `productoIds.length === 0` → return shape vacío
  4. Para cada chunk: `prisma.$transaction(async (tx) => { ... })` con `Promise.allSettled` por producto
  5. Por producto: `prisma.producto.findFirst({ where: { id, tenantId }, select: { id, precioCosto, precioVenta, tenantId } })` → si null, push a `errors` con `code='NOT_FOUND'`
  6. Compute `newPrecio = Math.round(oldPrecioVenta * (1 + porcentaje/100))`
  7. Si `newPrecio === oldPrecioVenta` → skip sin history row (no-op real)
  8. `tx.producto.update({ where: { id }, data: { precioVenta: newPrecio } })`
  9. `recordCostChange(tx, { ..., existingProducto: { id } })` para evitar N+1
  10. `notes = notes ?? \`Ajuste masivo ${porcentaje > 0 ? '+' : ''}${porcentaje}%\``
- [ ] **Implementar `bulkApplyTemplateAction = withAction(async (input, user) => ...)`**:
  1. Mismas gates de auth/feature
  2. `prisma.productoCostSheetTemplate.findFirst({ where: { id: plantillaId, tenantId } })` (UNA vez, fuera del chunk loop)
  3. Si null → `ActionError('Plantilla no encontrada', 'NOT_FOUND')`
  4. Por producto: `prisma.producto.findFirst({ where: { id, tenantId, plantillaActiva: { id: plantillaId } } })` con tenant
  5. Si `plantillaActiva` no matchea → push a `results` con `skipped: true`, mensaje 'sin plantilla activa'
  6. `newPrecio = Math.round(plantilla.precioSugerido)`
  7. `tx.producto.update` + `recordCostChange` con `reason='MANUAL_EDIT'`, `notes = \`Plantilla ${plantillaId.slice(0,8)} v${plantilla.version} aplicada masivamente\``
- [ ] Al final de ambos: `revalidatePath('/busy/ficha-costo')` + `revalidatePath('/busy/ficha-costo/bulk')`
- [ ] JSDoc en español en ambas acciones
- [ ] Correr tests → **DEBEN PASAR** los 15 nuevos

### Tarea 1.6: Actualizar barrel `actions.ts`
- [ ] Modificar `src/features/ficha-costo/actions.ts`
- [ ] Agregar `export { bulkApplyPercentageAction, bulkApplyTemplateAction } from './actions-bulk'`
- [ ] Agregar tipos al block `export type`: `BulkApplyPercentageInput`, `BulkApplyTemplateInput`, `BulkPriceResult`

### Tarea 1.7: REFACTOR — Code review WU1
- [ ] Verificar: cada `findFirst`/`update` incluye `tenantId` en `where` (multi-tenant hard rule)
- [ ] Verificar: `recordCostChange` recibe `existingProducto` siempre que esté disponible (elimina N+1)
- [ ] Constantes nombradas: `BULK_CHUNK_SIZE`, `MAX_PRODUCTOS_POR_BATCH = 500`
- [ ] `Promise.allSettled` (no `all`) para que fallos parciales no aborten
- [ ] JSDoc completo en funciones públicas, sin `any`
- [ ] Tests siguen pasando: 15 nuevos + 84+ previos

---

## Work Unit 2: Plan Feature Gate (TDD)

### Tarea 2.1: RED — Tests del seed
- [ ] Crear `prisma/seed/__tests__/plans-seed-bulk.test.ts` (vitest sobre el módulo, sin DB)
- [ ] Escribir 4 tests (importar constantes directamente, sin ejecutar el seed):
  1. `PLAN_BASICO_FEATURES['ficha-costo-precios-masivo'] === false`
  2. `PLAN_PROFESIONAL_FEATURES['ficha-costo-precios-masivo'] === false`
  3. `PLAN_EMPRESARIAL_FEATURES['ficha-costo-precios-masivo'] === true`
  4. La key existe en las 3 constantes (shape consistente — sin `undefined`)
- [ ] Correr `pnpm test:run prisma/seed/__tests__/plans-seed-bulk.test.ts` → **DEBEN FALLAR** (key no existe)

### Tarea 2.2: GREEN — Agregar plan key al seed
- [ ] Modificar `prisma/seed/plans-seed.ts`
- [ ] En `PLAN_BASICO_FEATURES`: agregar `"ficha-costo-precios-masivo": false,` (después de `productos-stock-masivo`)
- [ ] En `PLAN_PROFESIONAL_FEATURES`: no tocar (hereda de Básico → `false`)
- [ ] En `PLAN_EMPRESARIAL_FEATURES`: agregar `"ficha-costo-precios-masivo": true,` (después de `productos-stock-masivo: true`)
- [ ] Correr test → **DEBE PASAR**

### Tarea 2.3: REFACTOR — Verificar
- [ ] Correr `pnpm test:run prisma/seed` completo (no se rompió ningún test de plan existente)
- [ ] Verificar que `PLAN_PROFESIONAL_FEATURES['ficha-costo-precios-masivo']` resuelve a `false` via spread (assert explícito en test)
- [ ] Comentario inline en el seed explicando el patrón (refleja `productos-stock-masivo` como precedente)

---

## Work Unit 3: UI Shell (TDD)

### Tarea 3.1: RED — Tests del componente cliente
- [ ] Crear `src/features/ficha-costo/__tests__/bulk-price-manager.test.tsx`
- [ ] Mockear `listarProductosParaFichaAction` y los 2 nuevos `bulkApply*Action`
- [ ] Helper `makeProduct(overrides)` con defaults
- [ ] Escribir 6 tests (AAA + `@testing-library/react` + `userEvent`):
  1. Renderiza lista de N productos → N filas con checkbox
  2. Click en checkbox de fila → "selected count" en action bar se incrementa
  3. "Seleccionar todos" → todas las filas marcadas; click otra vez → limpio
  4. Sin selección → ambos botones (`Aplicar %` y `Aplicar plantilla`) están `disabled`
  5. Con selección → botones `enabled`; click "Aplicar %" abre dialog con input numérico
  6. Dialog template con 0 productos con plantilla activa → botón Confirm `disabled` + warning "X productos sin plantilla activa"
- [ ] Correr `pnpm test:run src/features/ficha-costo/__tests__/bulk-price-manager.test.tsx` → **DEBEN FALLAR** (componente no existe)

### Tarea 3.2: GREEN — Implementar componente cliente
- [ ] Crear `src/features/ficha-costo/components/bulk-price-manager.tsx` con `'use client'`
- [ ] Props: `{ initialProductos: ProductoFichaListItem[] }` (server-fetched)
- [ ] Estado: `selected: Set<string>`, `searchTerm: string`, `dialogMode: 'percentage' | 'template' | null`, `porcentajeInput: string`, `isSubmitting: boolean`, `progress: { completed: number; total: number; errors: Array<...> }`
- [ ] UI (patrón `BulkStockMinimoManager`):
  - Header con search input (`aria-label="Buscar productos"`)
  - Tabla con columnas: Checkbox | Nombre | Código | `precioVenta` | Plantilla activa (Badge)
  - Action bar sticky en bottom: count + 2 botones
  - Dialogs (Radix `AlertDialog` o `Dialog`):
    - **Percentage**: input numérico (label "Porcentaje (%)"), placeholder `+10` o `-25`, validación inline, Confirm disabled si vacío/0/≥1000
    - **Template**: read-only summary "X productos con plantilla activa, Y sin plantilla", Confirm disabled si count = 0
  - Progress: `Progress` component + lista de errores per-row con chip rojo (`role="alert"`)
  - Toasts: `sonner` (success / partial / error)
  - Loading state: `Skeleton` mientras `isSubmitting`
  - Empty state: "No hay productos para mostrar" si `initialProductos.length === 0`
- [ ] Llamada a `bulkApplyPercentageAction({ porcentaje: Number(porcentajeInput), productoIds: Array.from(selected), notes })` o `bulkApplyTemplateAction({ plantillaId: <default activa?>, ... })`
- [ ] **Nota**: `plantillaId` para el dialog de template — usar la única plantilla activa del tenant si hay una, o pedir selección. Phase 1 simplification: si hay 0 o 2+ activas, mostrar input select. Resolver en implementación contra `getPlantillaActivaAction`.
- [ ] JSDoc en español en el componente
- [ ] Correr tests → **DEBEN PASAR** los 6

### Tarea 3.3: GREEN — Crear página server-side
- [ ] Crear `src/app/busy/ficha-costo/bulk/page.tsx`
- [ ] `'use server'`-friendly: usar `await getCurrentUser()` + `requireFeature` + `requireManagerRole` + `listarProductosParaFichaAction({ limit: 500 })`
- [ ] Si falla el gate → `redirect('/busy/ficha-costo')` o render empty state (decisión: empty state con mensaje + link de regreso, NO redirect, para no romper navegación)
- [ ] Layout: `SidebarProvider` + `AppSidebar2` + header "Actualización Masiva de Precios" + `<BulkPriceManager initialProductos={productos} />`
- [ ] Metadata: `title: 'Actualización Masiva de Precios'`
- [ ] JSDoc en español

### Tarea 3.4: GREEN — Sidebar entry
- [ ] Modificar `src/components/app-sidebar2.tsx` (línea ~496, después de la entry de Ficha de Costo)
- [ ] Agregar entry: `{ title: 'Actualización Masiva', url: '/busy/ficha-costo/bulk', icon: Percent }`
- [ ] Importar `Percent` de `lucide-react`
- [ ] Verificar que sigue el patrón de las entries vecinas (mismo shape del objeto)

### Tarea 3.5: REFACTOR — Code review WU3
- [ ] Accesibilidad: `aria-label` en checkboxes, inputs, botones; `role="alert"` en error chips; `role="status"` en progress
- [ ] Verificar que la lista de productos se re-fetcha tras éxito (`revalidatePath` ya está en el action; sumar `router.refresh()` si la página usa `useRouter`)
- [ ] Verificar que la `selected` set se limpia en success completo pero se preserva en partial failure (test 6 lo cubre)
- [ ] Sin `any`, sin `console.log`
- [ ] Tests existentes `ficha-costo-view.test.tsx` no se rompen

---

## Work Unit 4: Verificación Final

### Tarea 4.1: Lint
- [ ] Correr `pnpm run lint` → debe pasar **sin errores ni warnings**
- [ ] Si hay warnings, resolverlos (no `// eslint-disable` sin justificación)

### Tarea 4.2: Tests completos
- [ ] Correr `pnpm test:run src/features/ficha-costo` → todos pasan:
  - 15 tests nuevos de `actions-bulk.test.ts` (9 + 6)
  - 4 tests nuevos de `plans-seed-bulk.test.ts`
  - 6 tests nuevos de `bulk-price-manager.test.tsx`
  - 84+ tests existentes (regresión cero)
- [ ] Correr `pnpm test:run` completo → no se rompió nada en otros módulos

### Tarea 4.3: Code review final
- [ ] Diff completo: `git diff main...HEAD` o contra el último commit del feature
- [ ] Verificar: `recordCostChange` refactor es backward compatible (callers existentes no se rompieron)
- [ ] Verificar: cada `findFirst`/`update`/`delete` en actions incluye `tenantId` (multi-tenant hard rule)
- [ ] Verificar: `revalidatePath` en ambos actions cubre `/busy/ficha-costo` y `/busy/ficha-costo/bulk`
- [ ] Verificar: JSDoc completo en español en funciones públicas
- [ ] Verificar: sin `Co-Authored-By` en commits
- [ ] Verificar: 3 work units corresponden a 3 commits separados (si no, reorganizar con `git rebase -i`)

### Tarea 4.4: Commit por WU
- [ ] **PR 1 (WU1)**: 
  ```
  feat(ficha-costo): bulk server actions para precioVenta
  
  - bulkApplyPercentageAction con chunking (50/$transaction) y Zod
  - bulkApplyTemplateAction con template fetched una vez por call
  - recordCostChange acepta existingProducto opcional (backward compatible)
  - 15 tests (9 percentage + 6 template)
  ```
- [ ] **PR 2 (WU2)**:
  ```
  feat(plans): nueva key ficha-costo-precios-masivo (Empresarial)
  
  - PLAN_BASICO_FEATURES: false
  - PLAN_EMPRESARIAL_FEATURES: true (via spread de Profesional)
  - 4 tests de shape del seed
  ```
- [ ] **PR 3 (WU3)**:
  ```
  feat(ficha-costo): UI shell para bulk price update
  
  - Página /busy/ficha-costo/bulk con plan+role gate
  - BulkPriceManager con checkboxes, 2 dialogs, progress, toasts
  - Sidebar entry "Actualización Masiva"
  - 6 tests de UI con @testing-library/react
  ```

---

## Definition of Done

- [ ] Los 25 tests nuevos pasan (15 actions + 4 plan + 6 UI)
- [ ] Los 84+ tests existentes siguen pasando (regresión cero)
- [ ] `pnpm run lint` pasa sin errores
- [ ] `pnpm test:run` completo pasa
- [ ] `recordCostChange` mantiene signature backward compatible
- [ ] Multi-tenant verificado: producto cross-tenant devuelve `NOT_FOUND`, no cross-tenant writes
- [ ] `bulkApplyPercentageAction` cumple el spec `bulk-percentage-action.md` (11 scenarios)
- [ ] `bulkApplyTemplateAction` cumple el spec `bulk-template-action.md` (9 scenarios)
- [ ] Plan feature `ficha-costo-precios-masivo` cumple el spec `plan-feature.md` (5 scenarios)
- [ ] UI cumple el spec `bulk-ui.md` (15 scenarios)
- [ ] Sin emojis en código/UI (regla del proyecto)
- [ ] Sin `Co-Authored-By` en commits
- [ ] 3 commits/PRs separados siguiendo `stacked-to-main`
- [ ] **Phase 2 (grid editing) queda explícitamente fuera de scope** — el task se documenta en proposal como follow-up
