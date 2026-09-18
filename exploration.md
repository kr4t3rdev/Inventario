# Exploration: Feature 4 — Bulk Price Update

> **Feature 4** del módulo Ficha de Costo. Tres sub-features:
> 1. Ajuste porcentual masivo (`+X%` / `-X%` sobre `precioVenta`)
> 2. Aplicar precio sugerido de PlantillaCosto a N productos
> 3. Edición tipo hoja de cálculo (grid editing) de `precioVenta`

---

## Estado Actual

### Modelo de datos (`prisma/schema.prisma`)

**`Producto`** (líneas 393-452): campos clave para esta feature:
- `precioCosto: Int` (línea 397) — precio de costo
- `precioVenta: Int` (línea 398) — **campo a modificar masivamente**
- `tenantId: String` (línea 395) — multi-tenant
- `categoriaId`, `subcategoriaId`, `almacenId`, `puntoDeVentaId`, `vendorId`
- `codigoInterno: String?` (VarChar(11)), `codigoNegocio: String?`
- `esCompuesto: Boolean`
- `@@index([tenantId])`, `@@index([tenantId, categoriaId])`, etc.

**`ProductoCostHistory`** (líneas 2054-2071): auditoría de cambios de precio.
- `oldPrecioCosto`, `newPrecioCosto`, `oldPrecioVenta`, `newPrecioVenta`
- `reason: CostChangeReason` (enum: INITIAL, RESTOCK, ADJUSTMENT, CORRECTION, IMPORT, MANUAL_EDIT, SYSTEM_SYNC)
- `changedBy: String` (userId), `notes: String?`

**`ProductoCostSheetTemplate`** (líneas 2077-2097): plantilla con `precioSugerido: Float` (decimal), `esActiva: Boolean`. Una activa por producto (`@@unique([productoId, esActiva])`).

### Listado de productos actual (`src/features/ficha-costo/`)

| Archivo | Responsabilidad |
|---------|-----------------|
| `actions-producto.ts` | `listarProductosParaFichaAction({ search, limit? })` retorna `ProductoFichaListItem[]` con `id, nombre, codigoInterno, precioCosto, precioVenta, tipo`. Límite por defecto: 500. Filtra por `tenantId` + `OR` sobre nombre/codigoInterno/codigoNegocio. |
| `components/lista-productos-ficha.tsx` | Renderiza un **grid de cards** (md:2, xl:3) con búsqueda por nombre/código. **No tiene selección, no es editable**, cada card tiene un `Link` a `/busy/ficha-costo/[id]`. |
| `components/ficha-costo-view.tsx` | Vista de detalle con Tabs (Resumen, Composición, Historial, Plantilla, Listas). |
| `components/plantilla-costo-tab.tsx` | Lista versiones de plantilla y permite **"Aplicar precio sugerido"** sobre UN producto vía `aplicarPrecioSugeridoAction`. |
| `actions-plantilla.ts` | `aplicarPrecioSugeridoAction({ plantillaId, productoId })` — actualiza `precioVenta = round(precioSugerido)` y graba `recordCostChange` con `MANUAL_EDIT` + notes "Precio sugerido aplicado desde plantilla v{N}". |

### Patrones de bulk operation existentes

| Patrón | Ubicación | Estructura | Multi-tenant safety |
|--------|-----------|------------|---------------------|
| **Per-item try/catch** | `productos/actions-stock.ts:60-93` (`bulkUpdateStockMinimoAction`) | Loop sobre `updates[]`, `prisma.producto.update({ where: { id } })` por cada uno, retorna `{ updated, errors, results }` | ⚠️ **No incluye `tenantId` en `where`** — confía en caller. Riesgo latente. |
| **Single updateMany** | `contratos/actions.ts:210-222` (`bulkUpdateContratoStatusAction`) | `prisma.contrato.updateMany({ where: { id: { in: ids }, tenantId }, data: {...} })`, retorna `{ count }` | ✅ Tenant filter en el `where`. |
| **Read-then-updateMany** | `contratos/actions.ts:224-249` (`bulkDeleteContratosAction`) | `findMany({ where: { id: { in }, tenantId } })` → filtra IDs reales → `deleteMany`. | ✅ Multi-tenant safe. |

**Recomendación para la nueva feature**: usar el patrón **`bulkUpdateContratoStatusAction` (updateMany con `tenantId`)** o el patrón de `bulkDeleteContratosAction` (read + filter + updateMany). **No copiar el patrón de `bulkUpdateStockMinimoAction`**.

### Patrón de auditoría (`src/lib/cost-history-utils.ts`)

```ts
recordCostChange(prisma, {
  productoId, oldPrecioCosto, newPrecioCosto,
  oldPrecioVenta, newPrecioVenta,
  reason: CostChangeReason.MANUAL_EDIT,
  changedBy: user.userId,
  notes: '...'
})
```
- Valida que exista el producto, valida `>= 0`, crea registro.
- No es transaccional con el update del producto (en `updatePrecioCostoAction` se llama en `try/catch` con `console.error` no-bloqueante).
- ⚠️ `recordCostChange` hace un `findUnique` por cada llamada → N+1 en bulk.

### Patrón de selección en UI

| Componente | Selección | Edición inline |
|------------|-----------|----------------|
| `components/data-table.tsx` | TanStack Table con `RowSelectionState`, paginación, search, columnas. Sin checkbox column built-in. | ❌ |
| `features/productos/components/enhanced-data-table.tsx` | TanStack Table con `rowSelection` + `getIsSelected()`. Sin checkbox column built-in. | ❌ |
| `features/productos/components/bulk-stock-minimo-manager.tsx` | **Tabla hand-rolled con `Checkbox` de Radix + estado `isSelected` por fila**. Edita `stockMinimo` con `<Input type="number">`. Botón guardar ejecuta `bulkUpdateStockMinimoAction`. Progress + error UI. | ✅ |

**El `BulkStockMinimoManager` es el blueprint directo** para todas las sub-features — se puede clonar la estructura y cambiar `stockMinimo` por `precioVenta` + la action.

### Auth y permisos

`updatePrecioCostoAction` usa:
```ts
requireManagerRole(user, 'editar el precio de costo')
requireFeature(user, 'productos', 'editar el precio de costo')
```
Mismo patrón en `aplicarPrecioSugeridoAction`. **Toda la feature debe ser manager-only** y gateada por feature key de plan.

`requireManagerRole` (en `src/lib/services/tenant-scope.ts:16-23`) verifica `user.tenantRole !== 'manager'`. Existe `scopedWhere(tenantId, where?)` helper (línea 62) — útil para queries.

### Tests existentes (patrón a seguir)

| Archivo | Cobertura |
|---------|-----------|
| `__tests__/listar-productos.test.ts` | Mockea `prisma`, `getCurrentUser`, `tenant-scope`. Testa filtro search + tenant. |
| `__tests__/update-precio-costo.test.ts` | Testa `NOT_FOUND`, validación negativo, update + recordCostChange. |
| `__tests__/actions-plantilla.test.ts` | Testa plantilla activa, `aplicarPrecioSugeridoAction`. Mockea `prisma.$transaction`. |

Patrón universal: `vi.mock` de `prisma`, `getCurrentUser`, `tenant-scope`, `cost-history-utils`, `next/cache`. ~80-300 líneas por archivo.

### Multi-tenant safety

- ✅ `listarProductosParaFichaAction`: filtra por `tenantId`.
- ✅ `updatePrecioCostoAction`: hace `findFirst({ where: { id, tenantId } })` antes de update.
- ✅ `aplicarPrecioSugeridoAction`: igual.
- ⚠️ `bulkUpdateStockMinimoAction`: hace `prisma.producto.update({ where: { id } })` SIN `tenantId`. Latent risk.
- ✅ `bulkUpdateContratoStatusAction`: `updateMany({ where: { id: { in }, tenantId } })`.

**Para Feature 4 usar siempre el patrón `updateMany` con `tenantId` o read-then-filter-update con `tenantId`.**

---

## Áreas Afectadas

### Archivos a CREAR

| Ruta | Propósito |
|------|-----------|
| `src/features/ficha-costo/actions-bulk.ts` | 3 server actions: `bulkAdjustPrecioVentaAction`, `bulkApplyPlantillaAction`, `bulkUpdatePreciosVentaAction`. |
| `src/features/ficha-costo/components/bulk-price-manager.tsx` | Tabla con Checkbox + columna `precioVenta` editable, bar de acciones (% / plantilla / guardar), progress + errores. |
| `src/features/ficha-costo/components/bulk-price-manager-client.tsx` | Wrapper con header + animaciones (mismo patrón que `bulk-stock-minimo-client.tsx`). |
| `src/app/busy/ficha-costo/bulk/page.tsx` | Página server-first con plan gate (`requireFeature` o `planFeatures['ficha-costo-bulk']`). |
| `src/app/busy/ficha-costo/bulk/layout.tsx` | Metadata. |
| `src/features/ficha-costo/__tests__/actions-bulk.test.ts` | Tests unitarios de las 3 actions. |
| `src/features/ficha-costo/__tests__/bulk-price-manager.test.tsx` | Tests del componente (render, selección, apply %). |

### Archivos a MODIFICAR

| Ruta | Cambio |
|------|--------|
| `src/features/ficha-costo/types.ts` | Agregar `BulkAdjustInput`, `BulkApplyPlantillaInput`, `BulkUpdatePreciosInput`, `BulkResult` types. |
| `src/features/ficha-costo/actions.ts` | Re-exportar las 3 nuevas actions. |
| `src/app/busy/ficha-costo/page.tsx` (opcional) | Botón "Gestión masiva de precios" en el header → link a `/busy/ficha-costo/bulk`. |
| `src/components/app-sidebar2.tsx` | Nueva entrada debajo de "Ficha de Costo" → `url: "/busy/ficha-costo/bulk"`, `icon: Percent` o `Tag`. |
| `prisma/schema.prisma` (opcional) | Si se agrega `CostChangeReason.AJUSTE_MASIVO` / `PLANTILLA_MASIVA` → requiere migration. Alternativa: reusar `ADJUSTMENT` o `MANUAL_EDIT` con notes descriptivos. |

### Sin cambios necesarios

- `src/lib/cost-history-utils.ts` — `recordCostChange` ya soporta lo necesario.
- `src/lib/services/tenant-scope.ts` — helpers ya existen.
- Dependencias — todas presentes (ver sección "Dependencias faltantes" abajo).

---

## Approaches por Sub-Feature

### 1. Ajuste porcentual masivo

**Approach A — Reutilizar `updatePrecioCostoAction` en loop** (server)
- Iterar sobre `productoIds[]`, leer `precioVenta` actual, calcular `Math.round(pv * (1 + pct/100))`, llamar lógica equivalente a `updatePrecioCostoAction` (incluyendo `recordCostChange`).
- Pros: Cero código nuevo en la lógica core, 100% consistente con edición individual.
- Cons: N queries de update + N inserts en `ProductoCostHistory` (lento con 500 productos). N+1 en `recordCostChange` (cada una hace su propio `findUnique`).

**Approach B — Single `updateMany` + history en batch** (server, optimizado)
- `prisma.producto.updateMany({ where: { id: { in: ids }, tenantId }, data: { precioVenta: <nuevo> } })` — pero el nuevo precio es por producto, no se puede con un solo updateMany.
- Alternativa: read all (1 query) → compute in memory → write in chunks via `$transaction` con per-row `recordCostChange`.
- Pros: Más rápido (chunks de 50).
- Cons: Más código, dos pasos (read + write).

**Recommendation: Approach A**. La ficha-costo actual prioriza claridad sobre performance (lista de 500, no 50k). Codebase ya tiene el patrón per-item en `bulkUpdateStockMinimoAction`.

**UI (Approach A)**: Extender `ListaProductosFicha` con Checkbox column + dialog "Aplicar +X% / -X%". Una sola action `bulkAdjustPrecioVentaAction({ productoIds, percent, notes? })`.

**Reason enum**: reusar `CostChangeReason.ADJUSTMENT` con `notes: "Ajuste masivo +X%"`. Sin migration.

**Effort: Bajo** (1-2 días)

### 2. Aplicar plantilla activa a N productos

**Approach A — Reutilizar `aplicarPrecioSugeridoAction` en loop** (server)
- Iterar `productoIds[]`, para cada uno: buscar `plantilla activa` (1 query) → si existe, llamar lógica de `aplicarPrecioSugeridoAction`.
- Pros: Reutilización total. Productos sin plantilla activa se saltean con warning.
- Cons: Mismo N+1 (2 queries por producto: findFirst plantilla + findFirst producto + update + recordCostChange).

**Approach B — Pre-fetch templates + bulk write**
- `findMany` de todas las plantillas activas para los `productoIds[]` (1 query), en memoria calcular, luego batched updates.
- Pros: Menos queries.
- Cons: Más complejo, no resuelve el problema del `recordCostChange` per-row.

**Recommendation: Approach A**. UX clara: "5 productos actualizados, 2 sin plantilla activa".

**UI**: Misma selección + botón "Aplicar plantilla activa". Confirm dialog muestra cuántos productos tienen plantilla activa.

**Reason enum**: reusar `MANUAL_EDIT` con `notes: "Precio sugerido aplicado desde plantilla v{N} (masivo)"` — mismo patrón que la versión single.

**Effort: Bajo** (1-2 días)

### 3. Grid editing de `precioVenta`

**Approach A — Tabla editable con TanStack Table + controlled inputs** (UI)
- Mismo patrón que `BulkStockMinimoManager` pero con `precioVenta` como input numérico. Estado `newPrecioVenta` por fila. Marcar `isModified` si cambió. Botón "Guardar (N)" envía batch.
- Server: nueva action `bulkUpdatePreciosVentaAction({ updates: [{ productoId, precioVenta }] })` con `tenantId` filter.
- Pros: Máxima flexibilidad. Compone naturalmente con los features 1 y 2 (% se puede simular desde el grid; plantilla se puede aplicar al grid).
- Cons: Más UI work (controlled inputs, validación, debounce, undo). Más tests.

**Approach B — react-data-grid / ag-grid** (UI, dependencia nueva)
- Excel-like experience built-in (cell editing, keyboard nav, copy/paste).
- Pros: UX profesional out-of-the-box.
- Cons: **No instalado en el proyecto** (solo `@tanstack/react-table` y `@radix-ui/react-checkbox`). Agregar ~200KB. Inconsistente con resto del codebase. Styling no encaja con shadcn.

**Recommendation: Approach A**. Coherente con `BulkStockMinimoManager` y con todas las otras tablas del proyecto. Es el camino de menor resistencia.

**UI**: Nueva columna `precioVenta` con `<Input type="number">` controlado. Filas modificadas se resaltan (amber-50 como `BulkStockMinimoManager`). Multi-select para aplicar % o plantilla a subset.

**Server action**: mismo patrón per-item con `tenantId` filter en `where: { id, tenantId }`. Validar `precioVenta >= 0`.

**Effort: Medio-Alto** (3-5 días)

---

## Comparación Global

| Approach | Esfuerzo | Riesgo | UX win | Reuso |
|----------|----------|--------|--------|-------|
| 1. % masivo (Approach A) | 1-2 días | Bajo | Medio | 95% |
| 2. Plantilla masiva (Approach A) | 1-2 días | Bajo | Alto (5x workflow actual) | 90% |
| 3. Grid editing (Approach A) | 3-5 días | Medio | Muy alto | 60% |

---

## Recommendation

**Secuencia sugerida**:

1. **Fase 1 (MVP, ~1 semana)**: Sub-features 1 y 2 juntos. Razón: ambas son acciones puntuales que comparten el mismo shell UI (selección + botón). Reusan casi 100% el código existente. Reusan `ListaProductosFicha` extendido con Checkbox.

2. **Fase 2 (~1 semana)**: Sub-feature 3 (grid editing). Reemplaza/mejora el shell UI con la edición inline. Internamente, las acciones 1 y 2 se pueden llamar desde la grid (componer).

**Razón**: el grid editing SUBSUME a las otras dos (un usuario puede escribir 800 manualmente, o aplicar 10%, o aplicar plantilla). Hacerlo último evita rehacer trabajo.

**Implementación mínima viable (Fase 1)**:
- Extender `ListaProductosFicha` con columna Checkbox + estado `selected: Set<string>`.
- Botón flotante (aparece cuando hay selección): "Aplicar %" y "Aplicar plantilla".
- 2 dialogs (input + confirm).
- 2 server actions nuevas en `actions-bulk.ts`.
- 1 page nueva `/busy/ficha-costo/bulk`.
- Sidebar entry + plan gate.

**Estructura de la nueva action** (referencia, NO código):

```ts
// actions-bulk.ts
export const bulkAdjustPrecioVentaAction = withAction(async (input: {
  productoIds: string[]
  percent: number  // ej: 10 = +10%, -15 = -15%
  notes?: string
}, user) => {
  requireTenant(user)
  requireManagerRole(user, 'ajustar precios masivamente')
  requireFeature(user, 'ficha-costo-bulk', 'ajustar precios masivamente')

  // Validar percent, ids[]
  // Iterar: findFirst({ id, tenantId }) → calcular nuevo precio → update + recordCostChange
  // Retornar { updated, errors, results } mismo formato que bulkUpdateStockMinimoAction
  revalidatePath('/busy/ficha-costo')
  revalidatePath('/busy/ficha-costo/bulk')
})
```

---

## Dependencias Faltantes

**Ninguna.** Todo lo necesario ya está instalado:

| Dependencia | Versión | Uso |
|-------------|---------|-----|
| `@tanstack/react-table` | ^8.21.3 | Grid (Fase 2) |
| `@radix-ui/react-checkbox` | ^1.3.1 | Selección en cards |
| `sonner` | ^2.0.3 | Toast feedback |
| `framer-motion` | ^12.31.0 | Animaciones (mismo patrón) |
| `zod` | ^3.24.4 | Validación input |
| `lucide-react` | ^0.508.0 | Iconos (Percent, Tag, Save) |
| `@radix-ui/react-alert-dialog` | ^1.1.14 | Confirm dialogs (ya hay) |

`react-data-grid`, `ag-grid` → **no usar** (no están en el proyecto, romperían consistencia).

---

## Risks

### Críticos (atender en la propuesta)

1. **Multi-tenant safety**: el patrón existente `bulkUpdateStockMinimoAction` no filtra por `tenantId` en el `update`. Para esta feature usar **obligatoriamente** el patrón `bulkUpdateContratoStatusAction` (updateMany con tenantId) o per-item `findFirst({ id, tenantId })` antes del update.

2. **Performance con N=500**: la ficha actual tiene `take: 500` en `listarProductosParaFichaAction`. Si bulk actualiza los 500, son ~2000 queries (read + update + history.findUnique + history.create). Mitigación: aumentar el límite a 200-500 con chunked transaction de 50.

3. **N+1 en `recordCostChange`**: cada llamada hace su propio `findUnique` del producto. Para bulk se podría:
   - Pre-fetchear los productos antes del loop (1 query) y pasar el resultado.
   - Refactorizar `recordCostChange` para aceptar un objeto `producto` opcional y skipear el findUnique.
   - **Recomendación**: refactor mínimo — agregar un parámetro opcional `existingProducto?: Producto` en `recordCostChange` y skipear el findUnique si está presente.

4. **Reason enum**: `CostChangeReason` no tiene un valor para bulk. Opciones:
   - **Recomendado**: reusar `ADJUSTMENT` (para % masivo) y `MANUAL_EDIT` (para plantilla masiva) con `notes` descriptivos. Cero migration.
   - Alternativa: agregar `BULK_ADJUSTMENT`, `BULK_PLANTILLA` al enum → migration.

5. **Rounding**: `precioVenta` es Int, `Math.round(precioVenta * 1.10)` puede dar inconsistencias (e.g. `100 * 1.1 = 110.00000000000001`). Usar `Math.round` consistentemente, igual que `aplicarPrecioSugeridoAction` (línea 406).

### Moderados

6. **Race conditions**: si un manager edita `precioCosto` de un producto en la ficha de costo individual mientras otro corre un bulk, el bulk usa el valor leído en el momento → no hay optimistic locking. Aceptable para el dominio (edición manual, no transaccional). Documentar.

7. **Partial failures**: si 5 de 500 fallan (e.g. constraint violation, producto eliminado), el UX debe mostrar cuáles fallaron. Patrón de `bulkUpdateStockMinimoAction` (results/errors) cubre esto.

8. **Sin plantilla activa**: bulk apply plantilla debe saltear productos sin plantilla y reportarlos. Decidir UX: ¿mostrar warning antes, o ejecutar y reportar al final?

### Menores

9. **Undo**: no hay. El `ProductoCostHistory` permite revertir manualmente vía SQL, pero no hay UI. Documentar como follow-up.

10. **Plan features**: la feature key nueva (`ficha-costo-bulk` o similar) debe existir en el plan registry. Verificar con Arturo qué planes la incluyen.

---

## Ready for Proposal

**SÍ** — esta es una feature bien acotada, con patrones claros a seguir, dependencias presentes, y los riesgos son identificables y mitigables.

**El orquestador debería**:
- Crear el change name (sugerido: `ficha-costo-bulk-price-update` o `feature-4-bulk-price-update`).
- Pasar a la fase `sdd-propose` con la propuesta inicial.
- Decidir si Fase 1 (sin grid) o Fase 1+2 juntas — recomendación: **Fase 1 sola** para mantener el scope manejable y validar el patrón antes del grid editing.

**Preguntas para Arturo antes de la propuesta** (no más de 1-2):
- ¿La feature va al plan "Empresarial" (igual que `productos-stock-masivo`) o a un plan intermedio?
- ¿El Reason enum se queda como está (reusar MANUAL_EDIT/ADJUSTMENT) o prefiere un valor nuevo BULK_* con migration?
