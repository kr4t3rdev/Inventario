# Tasks: ficha-costo-reconciliacion-historial

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~700-1000 (código + tests + UI) |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Suggested split | 4 PRs = 4 Work Units (uno por commit) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: **Yes**
Chained PRs recommended: **Yes**
Chain strategy: **stacked-to-main**
400-line budget risk: **High**

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Calculador puro + 14 tests | PR 1 | Base branch `main`; tests incluidos |
| 2 | Tipos + Server Action + 9 tests | PR 2 | Base branch `main`; depende de tipos (no del calculador) |
| 3 | UI enriquecida + 3 tests | PR 3 | Base branch `main`; depende de PR 1 y PR 2 |
| 4 | Verificación + commit final | PR 4 (incluido en 3 si se agrupa) | Lint + test:run + commit message |

> El calculador (PR 1) y el action (PR 2) podrían fusionarse sin violar el budget
> porque juntos siguen debajo de 400 líneas netas, pero se mantienen separados
> para preservar el orden TDD strict (RED→GREEN por concern).

---

## Work Unit 1: Calculador puro (TDD)

### Tarea 1.1: RED — Tests del reconciliador
- Crear `src/features/ficha-costo/__tests__/reconciliador-historial.test.ts`
- Escribir 14 tests con AAA (Arrange, Act, Assert):
  1. Item a 364 días → `enVentanaCPP = true`
  2. Item a 367 días → `enVentanaCPP = false`
  3. Item a 30 días → `enVentanaCPP = true`
  4. `fechaReferencia` omitida → usa `new Date()` (verificable con `toBeInstanceOf(Date)`)
  5. Prorrateo igualitario: 3 items mismo doc, gasto 300 → cada uno 100
  6. Prorrateo desigual: items cant 10/20, gasto 300 → 100/200
  7. Items sin `gastosPorDocumento` → todos `gastoProporcional = 0`
  8. Invariante: `suma(gastoProporcional)` por doc ≈ gasto total ± 0.01
  9. Múltiples proveedores: 3 de A, 1 de B → 2 grupos en `proveedores`
  10. Un solo proveedor → `participacionPorcentaje = 100`
  11. Resumen solo items en ventana (items fuera excluidos)
  12. Lista vacía → `{ items: [], proveedores: [] }`
  13. No mutación de inputs (snapshot de `items` y `gastosPorDocumento` antes/después)
  14. Determinismo: dos llamadas con mismos inputs → mismo output (con `fechaReferencia` fija)
- Correr `pnpm test:run src/features/ficha-costo/__tests__/reconciliador-historial.test.ts` → **DEBEN FALLAR** (módulo no existe)

### Tarea 1.2: GREEN — Implementar reconciliador
- Crear `src/features/ficha-costo/lib/reconciliador-historial.ts`
- Exports:
  - `function reconciliarHistorial(items, options): ReconciliadorResult`
  - Tipos: `ItemCompraMaterializado`, `ReconciliadorOptions`, `ItemReconciliado`, `ResumenProveedor`, `ReconciliadorResult`
- Algoritmo según `design.md` sección "Pure Calculator" (pasos 1-7):
  - Calcular `diasDiff = (fechaRef - item.fecha) / 86_400_000`
  - `enVentana = diasDiff <= ventanaMeses * 30.5`
  - Prorrateo: `gastoProporcional = (item.cantidad / cantTotalDoc) * gastosPorDocumento[docId]` con guard `cantTotalDoc > 0`
  - Agrupar por `proveedorId` solo items `enVentanaCPP`
  - Calcular `participacionPorcentaje = (montoProveedor / montoTotalGeneral) * 100`
- **Pureza**: sin imports de Prisma/Next.js/Redux; sin `Date.now()`; `new Date()` solo cuando `fechaReferencia` no se pasa
- JSDoc en español en `reconciliarHistorial` y en cada tipo exportado
- Correr tests → **DEBEN PASAR** los 14

### Tarea 1.3: REFACTOR — Code review
- Releer `reconciliador-historial.ts` y mejorar:
  - Naming consistente (`enVentanaCPP` vs `diasDiff` vs `cantTotalDoc`)
  - JSDoc completo: descripción, `@param`, `@returns`, ejemplo de uso
  - Extraer helpers privados si hay bloques duplicados (`esEnVentana`, `prorratearGasto`)
  - Verificar que no se mutan inputs (comparar con `structuredClone` antes/después en un test extra si falta)
- Correr tests → siguen pasando, cobertura 100% de la función

---

## Work Unit 2: Tipos y Server Action (TDD)

### Tarea 2.1: Agregar tipos
- Modificar `src/features/ficha-costo/types.ts`
- Agregar al final del bloque "Tipos de historial":
  ```ts
  export interface HistorialReconciliadoItem extends HistorialCostosItem {
    enVentanaCPP: boolean
    gastoProporcional: number
    tasaAproximada: boolean
  }
  export interface HistorialProveedorResumen {
    proveedorId: string
    proveedorNombre: string
    cantidadTotal: number
    montoTotal: number
    participacionPorcentaje: number
    cantidadItems: number
  }
  export type EstadoCPP = 'CALCULADO' | 'CON_ADVERTENCIAS' | 'SIN_DATOS'
  export interface HistorialReconciliadoData {
    items: HistorialReconciliadoItem[]
    pagination: HistorialCostosPagination
    proveedores: HistorialProveedorResumen[]
    estadoCPP: EstadoCPP
    advertencias: string[]
    ventana: { meses: number; desde: string; hasta: string }
    totalCantidadEnVentana: number
    totalMontoEnVentana: number
  }
  export interface GetHistorialReconciliadoInput extends GetHistorialCostosInput {}
  ```
- Verificar que `tsc --noEmit` no se rompe (sin aún usar los tipos)

### Tarea 2.2: RED — Tests del action
- Crear `src/features/ficha-costo/__tests__/actions-reconciliacion.test.ts`
- Mockear con `vi.mock` los siguientes clientes de Prisma:
  - `prisma.producto.findFirst`
  - `prisma.compraDocumentoItem.findMany` (paginada y completa)
  - `prisma.compraDocumentoItem.count`
  - `prisma.compraDocumento.findMany` (para tasa de cambio)
  - `prisma.gastoCompra.findMany`
- Mockear `getCurrentUser` (o `withAction` helper) para inyectar `AuthenticatedUser`
- Escribir 9 tests:
  1. **Happy path**: producto con 3 compras → 3 items reconciliados, 1-2 proveedores, `estadoCPP = 'CALCULADO'`
  2. **Paginación**: 25 items, `page=2, limit=10` → 10 items en `items`, `pagination.total=25, totalPages=3`
  3. **Multi-tenant**: `producto.findFirst` devuelve `null` → `success: false`, `error.code = 'NOT_FOUND'`
  4. **Producto inexistente**: `productoId` que no existe → `NOT_FOUND`
  5. **Sin auth**: `getCurrentUser` devuelve `null` → `success: false`, error de auth
  6. **Sin compras en ventana**: ventana vacía → `items: []`, `proveedores: []`, `estadoCPP = 'SIN_DATOS'`
  7. **Con advertencias**: al menos 1 item con `tasaAproximada: true` → `estadoCPP = 'CON_ADVERTENCIAS'`, `advertencias.length > 0`
  8. **Filtro por proveedor**: query respeta el filtro (assert sobre `where` del spy)
  9. **Filtro por fecha**: `fechaDesde`/`fechaHasta` se traducen a `gte`/`lte` en `compraDocumento.fechaCompra`
- Correr `pnpm test:run src/features/ficha-costo/__tests__/actions-reconciliacion.test.ts` → **DEBEN FALLAR** (action no existe)

### Tarea 2.3: GREEN — Implementar action
- Crear `src/features/ficha-costo/actions-reconciliacion.ts` con `'use server'`
- Exportar `getHistorialReconciliadoAction = withAction(async (input, user) => ...)`
- Pasos (en orden):
  1. `requireTenant(user)` + `requireFeature(user, 'productos', 'ver el historial de costos')`
  2. `prisma.producto.findFirst({ where: { id, tenantId } })` → si null, `throw new ActionError('Producto no encontrado', 'NOT_FOUND')`
  3. Calcular `page` (default 1), `limit` (default 20, max 100), `skip = (page-1)*limit`
  4. Construir `where` base (igual que `actions-historial.ts` líneas 39-55) + filtros del usuario
  5. `Promise.all` con 4 queries en paralelo:
     - `compraDocumentoItem.findMany` paginada (igual a actual, sin cambios de `select`)
     - `compraDocumentoItem.count`
     - `compraDocumentoItem.findMany` completa (max 1000) con `take: 1000`, sin `skip`, mismo `select`
     - `gastoCompra.findMany` con `where: { id: { in: distinctDocGastoIds } }`
  6. Construir `gastosPorDocumento: Map<string, number>` desde query de gastos
  7. Materializar items completos con `tasaAproximada` (calcular por item usando `normalizarMoneda` + `prisma.compraDocumento.findMany` para tasas o usar el flag que ya viene)
  8. `reconciliarHistorial(itemsCompletos, { ventanaMeses: 12, gastosPorDocumento, fechaReferencia: new Date() })` → `{ items: reconciliados, proveedores, advertencias }`
  9. Determinar `estadoCPP`:
     - `'SIN_DATOS'` si `reconciliados.every(it => !it.enVentanaCPP)`
     - `'CON_ADVERTENCIAS'` si `advertencias.length > 0`
     - `'CALCULADO'` en otro caso
  10. Paginar `reconciliados` en memoria (`slice((page-1)*limit, page*limit)`)
  11. Retornar `HistorialReconciliadoData` con `ventana`, `totales` y `advertencias`
- JSDoc en español describiendo el contrato
- Correr tests → **DEBEN PASAR** los 9

### Tarea 2.4: Actualizar barrel
- Modificar `src/features/ficha-costo/actions.ts`:
  - Agregar `export { getHistorialReconciliadoAction } from './actions-reconciliacion'`
  - Agregar tipos nuevos al `export type { ... }`:
    `HistorialReconciliadoItem`, `HistorialProveedorResumen`, `EstadoCPP`, `HistorialReconciliadoData`, `GetHistorialReconciliadoInput`
- Verificar que `getHistorialCostosAction` queda intacto (compatibilidad con consumers)

### Tarea 2.5: REFACTOR — Code review
- Releer `actions-reconciliacion.ts`:
  - Queries paralelas con `Promise.all` (verificar que las 4 están en un solo `Promise.all`)
  - Límite duro de `1000` items en query completa como constante nombrada (`MAX_RECONCILIAR_ITEMS = 1000`)
  - Límite de paginación `default 20, max 100` como constantes (`DEFAULT_LIMIT = 20`, `MAX_LIMIT = 100`)
  - JSDoc en cada query describiendo qué devuelve y por qué
- Releer tests del action:
  - Reutilizar `makeMockUser()` helper si hay duplicación
  - Verificar que no hay `any` (usar `unknown` o tipos específicos)
- Correr tests → siguen pasando los 9 + 14 de Work Unit 1

---

## Work Unit 3: UI enriquecida (TDD)

### Tarea 3.1: RED — Tests UI
- Crear `src/features/ficha-costo/__tests__/historial-costos.test.tsx`
- Setup:
  - Mockear `getHistorialReconciliadoAction` con `vi.mock` (mismo patrón que `ficha-costo-view.test.tsx`)
  - Helper `makeReconciliadoData(overrides)` para construir un `HistorialReconciliadoData` de fixture
- Escribir 3 tests con `@testing-library/react` y `vitest-axe`:
  1. **Renderiza banner de estado CPP**: `estadoCPP = 'CALCULADO'` muestra banner verde con texto "CPP calculado con N compras"
  2. **Renderiza tabla de resumen por proveedor**: `proveedores.length > 0` → tabla con `aria-label="Resumen de compras por proveedor"`
  3. **Renderiza badge "En CPP" en filas**: items con `enVentanaCPP: true` muestran badge "Incluida en CPP" (verde), `false` muestra "Fuera de ventana" (gris)
- Correr `pnpm test:run src/features/ficha-costo/__tests__/historial-costos.test.tsx` → **DEBEN FALLAR**

### Tarea 3.2: GREEN — Implementar UI
- Modificar `src/features/ficha-costo/components/historial-costos.tsx`:
  - Importar `getHistorialReconciliadoAction`, `HistorialReconciliadoData` desde `../actions`
  - Cambiar tipo de estado: `useState<HistorialCostosData | null>` → `useState<HistorialReconciliadoData | null>`
  - Cambiar la llamada: `getHistorialCostosAction` → `getHistorialReconciliadoAction`
  - Agregar helper interno `renderBannerEstado(data: HistorialReconciliadoData)`:
    - `'CALCULADO'` → `role="status"` verde con `aria-label="CPP calculado con N compras en ventana"`
    - `'CON_ADVERTENCIAS'` → `role="status"` amarillo + bloque colapsable con `<details>` mostrando `advertencias`
    - `'SIN_DATOS'` → `role="alert"` gris "No hay compras en los últimos 12 meses"
  - Renderizar banner arriba del bloque de filtros
  - Agregar columnas nuevas a la `<Table>`:
    - `En CPP` (badge verde "Incluida en CPP" / gris "Fuera de ventana")
    - `Gasto prop.` (monto formateado con `Intl.NumberFormat`, solo si hay `gastoProporcional > 0` en la lista — usar `data.items.some(it => it.gastoProporcional > 0)`)
  - Renderizar sección "Resumen por proveedor" al final (después de la paginación):
    - `<Table aria-label="Resumen de compras por proveedor">` con columnas: Proveedor | Cantidad | Monto | Items | Participación
    - Caption: `"Calculado sobre todas las compras en ventana (no solo la página actual)"`
  - JSDoc actualizado en el componente
- Correr tests → **DEBEN PASAR** los 3 nuevos + los existentes de `ficha-costo-view.test.tsx`

### Tarea 3.3: REFACTOR — Code review
- Verificar accesibilidad:
  - Banner con `role="status"` + `aria-live="polite"` para casos normales
  - Banner con `role="alert"` para `SIN_DATOS`
  - Tabla de proveedores con `aria-label`
  - Inputs de filtro ya tienen `aria-label` (verificar que no se rompió)
- Verificar que `pnpm run lint` pasa
- Verificar que `pnpm test:run src/features/ficha-costo/__tests__/historial-costos.test.tsx` sigue pasando

---

## Work Unit 4: Verificación final

### Tarea 4.1: Lint
- Correr `pnpm run lint` → debe pasar **sin errores ni warnings**
- Si hay warnings de ESLint, resolverlos antes de continuar (no `// eslint-disable` sin justificación)

### Tarea 4.2: Tests completos
- Correr `pnpm test:run src/features/ficha-costo` → **todos** los tests deben pasar:
  - 14 tests de `reconciliador-historial.test.ts`
  - 9 tests de `actions-reconciliacion.test.ts`
  - 3 tests de `historial-costos.test.tsx`
  - + 56 tests existentes del módulo (regresión)
- Correr `pnpm test:run` completo para verificar que no se rompió nada en otros módulos

### Tarea 4.3: Code review final
- Releer el diff completo (`git diff main...HEAD` o contra el último commit del feature)
- Verificar:
  - **Cero código deprecado**: `getHistorialCostosAction` queda intacto (no se elimina ni se comenta)
  - **JSDoc completo** en todas las funciones públicas nuevas
  - **Sin `any`** en código nuevo
  - **Sin console.log** olvidados
  - **Sin imports muertos** en los archivos modificados
- Verificar que los 4 work units corresponden a 4 commits separados (si no, reorganizar con `git rebase -i`)

### Tarea 4.4: Commit
- Stagear **todos** los archivos del change:
  - `src/features/ficha-costo/lib/reconciliador-historial.ts` (nuevo)
  - `src/features/ficha-costo/__tests__/reconciliador-historial.test.ts` (nuevo)
  - `src/features/ficha-costo/types.ts` (modificado)
  - `src/features/ficha-costo/actions-reconciliacion.ts` (nuevo)
  - `src/features/ficha-costo/__tests__/actions-reconciliacion.test.ts` (nuevo)
  - `src/features/ficha-costo/actions.ts` (modificado)
  - `src/features/ficha-costo/components/historial-costos.tsx` (modificado)
  - `src/features/ficha-costo/__tests__/historial-costos.test.tsx` (nuevo)
- Commit con mensaje:
  ```
  feat(ficha-costo): reconcilia historial de compras con cálculo de CPP

  - Calculador puro reconciliarHistorial() en lib/
  - Nueva action getHistorialReconciliadoAction
  - UI enriquecida con badge por línea, resumen por proveedor, banner CPP
  - 14 tests del calculador + 9 tests del action + 3 tests UI
  - Cero cambios de schema
  ```
- `git push` (solo si el usuario lo pidió explícitamente)

---

## Definition of Done

- [ ] Los 26 tests nuevos pasan (14 + 9 + 3)
- [ ] Los 56 tests existentes siguen pasando (regresión cero)
- [ ] `pnpm run lint` pasa sin errores
- [ ] `pnpm test:run` completo pasa
- [ ] `getHistorialCostosAction` sigue intacto
- [ ] Multi-tenant verificado: producto cross-tenant devuelve `NOT_FOUND`
- [ ] `HistorialReconciliadoData` cumple el contrato del spec `historial-reconciliado.md`
- [ ] `reconciliarHistorial()` cumple el contrato del spec `historial-reconciliado-calculador.md`
- [ ] Sin emojis en código/UI (regla del proyecto)
- [ ] Sin `Co-Authored-By` en commits
- [ ] Commit final con mensaje convencional en español/inglés
