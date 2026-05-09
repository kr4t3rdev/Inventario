# Design: Migrar Dashboard a Server-First (Phase 2)

## Technical Approach

La solución correcta NO es “hacer todo server” ciegamente. El dashboard tiene dos responsabilidades distintas:

1. **Datos y composición** → ideal para servidor
2. **motion/charts interactivos** → ideal para client islands chicas

Por eso la arquitectura objetivo será:

- `page.tsx` como **server wrapper** que obtiene `dashboardStats`
- `DashboardShell` opcional como **client component** para `framer-motion` de layout/header si sigue siendo necesario
- widgets presentacionales server donde no haya interactividad real
- charts aislados como client components recibiendo props serializables

## Architecture Decisions

### Decision: El shell sidebar pertenece solo al layout

**Choice**: `src/app/busy/layout.tsx` sigue siendo el único owner de `SidebarProvider` + `SidebarInset`.

**Alternatives considered**:
- dejar providers anidados en la page
- mover ownership del sidebar al dashboard

**Rationale**: el layout ya expone el contexto real consumido por `AppSidebar2` y `SiteHeader`; duplicarlo crea contexto y `<main>` anidados sin beneficio.

### Decision: Server wrapper + client islands

**Choice**: usar server-first en el route level, con client boundaries solo para charts y motion que lo requieran.

**Alternatives considered**:
- página completamente client
- página completamente server sin motion/charts interactivos

**Rationale**: el dashboard es mayormente lectura, pero `recharts` y parte de `framer-motion` siguen necesitando cliente.

### Decision: Single fetch orchestration

**Choice**: leer `getDashboardStatsAction()` una vez en el wrapper/server layer y distribuir slices de datos por props.

**Alternatives considered**:
- que cada widget lea la action
- volver a una capa HTTP/RTK Query por widget

**Rationale**: elimina waterfalls, reduce queries duplicadas y simplifica testing.

### Decision: Widgets bajo feature folder

**Choice**: ubicar todos los widgets en `src/features/dashboard/components/`.

**Rationale**: respeta la arquitectura feature-based del repo y evita seguir mezclando widgets de dominio con componentes globales.

## Target Component Boundaries

### Server / Presentational
- `section-cards.tsx`
- `top-products-table.tsx`
- `transferencias-stats.tsx`
- `stock-bajo-table.tsx`

### Client Islands
- `chart-area-interactive.tsx`
- `stock-distribution-chart.tsx`
- `dashboard-shell.tsx` (solo si hace falta conservar motion del page wrapper)

## Data Flow

```text
src/app/busy/layout.tsx
  -> provee SidebarProvider + SidebarInset + SiteHeader + AuthProvider

src/app/busy/dashboard/page.tsx (server)
  -> await getDashboardStatsAction({})
  -> valida { success, data, error }
  -> prepara props serializables
  -> renderiza DashboardShell (client opcional)
      -> widgets server/client según boundary
```

## Current Verified Data Contract

El wrapper debe trabajar con el shape REAL actual de `getDashboardStatsAction()`:

```ts
{
  totalProductos: number
  totalAlmacenes: number
  totalPuntosVenta: number
  totalVentas: number
  totalMermas: number
  totalTransferencias: number
  totalIngresos: number
  totalGastosMermas: number
  totalBeneficio: number
  valorTotalInventario: number
  datosPorMes: Array<...>
  datosPorSemana: Array<...>
  ventasDiarias: {...}
  productosMasVendidos: Array<...>
  productosStockBajo: Array<...>
  distribucionStock: Array<...>
  transferenciasStats: {...}
}
```

No se debe spec-ear `ventasData`, `ventaItemsData`, `productosDataRaw` como contrato público porque HOY no salen de la action.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/busy/dashboard/page.tsx` | Modify | server wrapper; elimina shell duplicado |
| `src/features/dashboard/components/section-cards.tsx` | Create | widget server/presentational |
| `src/features/dashboard/components/top-products-table.tsx` | Create | widget server/presentational |
| `src/features/dashboard/components/transferencias-stats.tsx` | Create | widget server/presentational |
| `src/features/dashboard/components/stock-bajo-table.tsx` | Create | widget server/presentational migrado |
| `src/features/dashboard/components/chart-area-interactive.tsx` | Create | chart client island |
| `src/features/dashboard/components/stock-distribution-chart.tsx` | Create | chart client island |
| `src/features/dashboard/components/dashboard-shell.tsx` | Create/Optional | shell client para motion si se necesita |
| `src/features/dashboard/components/index.ts` | Create | barrel export |

## Interfaces / Contracts

```ts
interface DashboardPageData {
  totalProductos: number
  totalAlmacenes: number
  totalPuntosVenta: number
  totalVentas: number
  totalMermas: number
  totalTransferencias: number
  totalIngresos: number
  totalGastosMermas: number
  totalBeneficio: number
  valorTotalInventario: number
  datosPorMes: DashboardMonthPoint[]
  datosPorSemana: DashboardMonthPoint[]
  ventasDiarias: DashboardDailySummary
  productosMasVendidos: DashboardTopProduct[]
  productosStockBajo: DashboardLowStockProduct[]
  distribucionStock: DashboardStockDistribution[]
  transferenciasStats: DashboardTransferStats
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | prop rendering de widgets server | Testing Library con fixtures |
| Unit | client chart islands | Testing Library + mock de recharts |
| Unit | page wrapper success/error states | mock de `getDashboardStatsAction()` |
| Integration | layout sin shell duplicado | render de page dentro de layout |
| Regression | imports legacy eliminados | grep / typecheck |

## Migration / Rollout

1. Corregir shell duplicado del page
2. Crear widgets feature-based con props
3. Migrar `stock-bajo-table`
4. Conectar page wrapper server-first
5. Preservar/extraer motion en client shell solo si hace falta
6. Verificar typecheck/lint/tests

## Open Questions

- ¿Conviene extraer una función server pura compartida desde `actions.ts` para no depender de la action wrapper dentro del page?
- ¿`datosPorSemana` debe seguir expuesto si hoy replica `datosPorMes`?
- ¿queremos sorting interactivo client-side en `top-products-table` o lo simplificamos a tabla server-rendered?
