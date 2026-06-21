# Tasks: ficha-costo-trazabilidad-ventas

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~840 (4 new files + 3 modified) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Work Unit 1: types + action + tests) → PR 2 (Work Unit 2: UI + tests + integration) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Tipos + Server Action + tests (RED→GREEN→REFACTOR) | PR 1 | Base branch; ~430 lines; standalone deliverable |
| 2 | UI component + tests + integration in ficha-costo-view | PR 2 | Depends on PR 1; ~410 lines |
| 3 | Verification: lint, full test suite, final review | (part of PR 2) | No new code; gates merge |

---

## Work Unit 1: Tipos y Server Action (TDD)

### Tarea 1.1: Agregar tipos en `types.ts`
- [ ] Modificar `src/features/ficha-costo/types.ts`
- [ ] Agregar interfaces: `VentaTrazabilidadItem`, `ResumenVentasProducto`, `VentasProductoData`, `GetVentasProductoInput`
- [ ] Reusar `HistorialCostosPagination` para el campo `pagination`
- [ ] JSDoc en español en cada interfaz

### Tarea 1.2: RED — Tests del action
- [ ] Crear `src/features/ficha-costo/__tests__/actions-ventas.test.ts`
- [ ] Mock de Prisma: `producto.findFirst`, `ventaItem.findMany`, `ventaItem.count`, `ventaItem.aggregate`, `purchaseAllocation.findMany`
- [ ] Mock de `withAction` wrapper y helpers de auth (`requireTenant`, `requireFeature`)
- [ ] 10 tests (AAA pattern):
  1. Happy path: 3 ventas con allocations FIFO → `costoFifo` = Σ(cantidad × precioUnitario)
  2. Venta legacy sin allocations → `costoFifo` = `precioCosto * cantidad`, `tieneAllocaciones = false`
  3. Ventas con cliente → `clienteNombre` correcto
  4. Ventas sin cliente → `clienteNombre = 'Cliente genérico'`
  5. Filtro por `fechaDesde` → solo ventas >= fechaDesde
  6. Filtro por `fechaHasta` → solo ventas <= fechaHasta
  7. Paginación: 25 ventas, page 2 limit 10 → 10 items, pagination correcta (page=2, total=25, totalPages=3)
  8. Multi-tenant: producto de otro tenant → `ActionError('Producto no encontrado', 'NOT_FOUND')`
  9. Sin ventas → `items: []`, resumen con todo en 0
  10. Resumen calculado sobre dataset completo (50 ventas, page 1 limit 10 → resumen refleja 50)
- [ ] Correr tests → **DEBEN FALLAR** (archivo `actions-ventas.ts` no existe)

### Tarea 1.3: GREEN — Implementar action
- [ ] Crear `src/features/ficha-costo/actions-ventas.ts`
- [ ] `'use server'` al inicio del archivo
- [ ] Importar `withAction`, `ActionError` de `@/lib/server-actions`
- [ ] Importar `prisma` de `@/lib/prisma`
- [ ] Importar `requireTenant`, `requireFeature` de `@/lib/services/tenant-scope`
- [ ] Implementar `calcularCostoFifoItem()` inline (función privada):
  - Si `allocations.length === 0` → `{ costo: cantidad * precioCostoActual, tieneAllocaciones: false }`
  - Si tiene allocations → Σ(cantidad × precioUnitario) + fallback parcial con `precioCosto`
- [ ] Implementar `getVentasProductoAction` con `withAction`:
  1. `requireTenant(user)` + `requireFeature(user, 'productos', 'ver trazabilidad de ventas')`
  2. Validar `page` (default 1) y `limit` (default 20, max 100)
  3. Verificar producto pertenece al tenant (`producto.findFirst` con `tenantId`) → `NOT_FOUND` si no
  4. Construir `where` con `productoId`, `venta.tenantId`, `venta.deletedAt: null`, filtros de fecha
  5. `Promise.all`: `ventaItem.findMany` (paginado, con select de venta/allocations/producto) + `ventaItem.count` + `ventaItem.aggregate`
  6. Query adicional: `purchaseAllocation.findMany` para costo total del dataset completo
  7. Mapear items: calcular `costoFifo`, `margen`, `margenPorcentaje`, `clienteNombre`
  8. Calcular resumen: `ingresoTotal`, `costoTotal`, `margenTotal`, `margenPromedio`, `cantidadTotalVendida`, `totalVentas`
  9. Retornar `VentasProductoData`
- [ ] JSDoc en español en la función pública
- [ ] Correr tests → **DEBEN PASAR**

### Tarea 1.4: Actualizar barrel `actions.ts`
- [ ] Modificar `src/features/ficha-costo/actions.ts`
- [ ] Agregar `export { getVentasProductoAction } from './actions-ventas'`
- [ ] Agregar tipos `VentaTrazabilidadItem`, `ResumenVentasProducto`, `VentasProductoData`, `GetVentasProductoInput` al block `export type`

### Tarea 1.5: REFACTOR — Code review Work Unit 1
- [ ] Verificar naming: camelCase funciones, PascalCase tipos
- [ ] Verificar JSDoc completos en funciones públicas
- [ ] Verificar queries paralelas con `Promise.all` (3 queries en paralelo + 1 adicional)
- [ ] Verificar límites de paginación (max 100, default 20)
- [ ] Verificar manejo de `null` en `compraDocumentoItem?.precioUnitario`
- [ ] Tests siguen pasando después de refactor

---

## Work Unit 2: UI (TDD)

### Tarea 2.1: RED — Tests UI
- [ ] Crear `src/features/ficha-costo/__tests__/ventas-trazabilidad.test.tsx`
- [ ] Mock de `getVentasProductoAction` desde `../actions-ventas`
- [ ] 5 tests (AAA pattern):
  1. Renderiza tabla con 3 ventas → 3 filas con datos correctos (fecha, cliente, cantidad, precios)
  2. Renderiza resumen de rentabilidad → muestra total vendido, ingreso, costo, margen, margen promedio
  3. Empty state: `items: []` → muestra "No hay ventas registradas para este producto"
  4. Filtros de fecha → al cambiar `fechaDesde`, se llama action con `page: 1` y nuevo filtro
  5. Badge de margen: verde >20%, amarillo 0-20%, rojo <0% → verificar clases CSS del Badge
- [ ] Correr tests → **DEBEN FALLAR** (componente no existe)

### Tarea 2.2: GREEN — Implementar UI
- [ ] Crear `src/features/ficha-costo/components/ventas-trazabilidad.tsx`
- [ ] `'use client'` al inicio del archivo
- [ ] Props: `{ productoId: string; className?: string }`
- [ ] Estado local: `page`, `fechaDesde`, `fechaHasta`, `data`, `isLoading`, `error`
- [ ] `useEffect` para cargar datos al montar y cuando cambian filtros/página (patrón `historial-costos.tsx`)
- [ ] Filtros: 2 inputs `type="date"` con `aria-label`, botón "Limpiar" con icono X
- [ ] Tabla con columnas: Fecha | Cliente | Cantidad | Precio Unit. | Ingreso | Costo Real | Margen | Margen %
- [ ] Números con `font-mono`, montos formateados con `toLocaleString('es-ES')`
- [ ] Badge de margen con colores semáforo: `bg-green-600` (>20%), `bg-yellow-500` (0-20%), `bg-red-600` (<0%)
- [ ] Indicador de legacy: asterisco `*` + tooltip "Costo estimado (sin allocations FIFO)"
- [ ] Sección de resumen: grid con 5 métricas (total vendido, ingreso, costo, margen, margen promedio)
- [ ] Nota al pie si hay items legacy: "Incluye ventas con costo estimado"
- [ ] Paginación: botones ChevronLeft/ChevronRight con `aria-label`, disabled en extremos
- [ ] Loading state: spinner con `Loader2` + `role="status"`
- [ ] Error state: alert con `role="alert"` + icono `AlertCircle`
- [ ] Empty state: mensaje centrado con borde dashed
- [ ] JSDoc en español en el componente
- [ ] Correr tests → **DEBEN PASAR**

### Tarea 2.3: Integrar en `ficha-costo-view.tsx`
- [ ] Modificar `src/features/ficha-costo/components/ficha-costo-view.tsx`
- [ ] Agregar import: `import { VentasTrazabilidad } from './ventas-trazabilidad'`
- [ ] Agregar `<TabsTrigger value="ventas">Ventas</TabsTrigger>` después de "Historial de compras" (línea 56)
- [ ] Agregar `<TabsContent value="ventas" className="mt-4"><VentasTrazabilidad productoId={data.producto.id} /></TabsContent>` después de TabsContent "historial" (línea 72)
- [ ] Verificar que tests existentes (`ficha-costo-view.test.tsx`) siguen pasando

### Tarea 2.4: REFACTOR — Code review Work Unit 2
- [ ] Accesibilidad: `aria-label` en inputs de fecha, botones de paginación, `role="alert"` en error, `role="status"` en loading
- [ ] Verificar que tests existentes siguen pasando (`pnpm test:run src/features/ficha-costo`)
- [ ] Verificar que no hay imports sin usar
- [ ] Verificar consistencia de patrones con `historial-costos.tsx`

---

## Work Unit 3: Verificación Final

### Tarea 3.1: Lint
- [ ] Correr `pnpm run lint` → debe pasar sin errores
- [ ] Corregir cualquier warning de ESLint

### Tarea 3.2: Tests completos
- [ ] Correr `pnpm test:run src/features/ficha-costo` → todos deben pasar
- [ ] Verificar que los tests existentes (84+) siguen pasando sin regressions
- [ ] Verificar coverage: nuevos tests cubren escenarios críticos (FIFO, legacy, multi-tenant, paginación, filtros)

### Tarea 3.3: Code review final
- [ ] Revisar diff completo (`git diff`)
- [ ] Verificar que no hay código deprecado o console.log de debug
- [ ] Verificar JSDoc completos en todas las funciones públicas
- [ ] Verificar que no se modificó el schema Prisma
- [ ] Verificar que no hay cambios en archivos fuera del módulo `ficha-costo`

### Tarea 3.4: Commit
- [ ] Stage todos los cambios del módulo `ficha-costo`
- [ ] Commit message:
  ```
  feat(ficha-costo): trazabilidad FIFO en ventas

  - Nueva action getVentasProductoAction con cálculo de costo real FIFO
  - Componente VentasTrazabilidad con tabla, resumen y filtros
  - Integración en pestaña "Ventas" de ficha-costo-view
  - Fallback a precioCosto para ventas legacy sin allocations
  - 10 tests del action + 5 tests UI
  - Cero cambios de schema
  ```
