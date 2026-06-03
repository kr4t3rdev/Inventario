# SDD Proposal: Reporte de Ventas por Grupo

## Executive Summary

Agregar una nueva pantalla de reportes al módulo de Reportes de Inventario (`/busy/reportes`) que muestre las ventas agrupadas por **categoría/subcategoría de producto** con métricas de rentabilidad, rotación y días estimados para vender. Se incluirán gráficos comparativos, exportación y un diseño UI consistente con el estilo actual del proyecto.

## Context

- **App**: Next.js 15, React 19, TypeScript, Prisma, PostgreSQL
- **Ruta**: `GET /busy/reportes/` → tab "General" | "Categoría" | "Ubicación" | "Movimientos" | **"Ventas por Grupo"** (nuevo)
- **Layout**: Sigue el patrón de `reportes-page-client.tsx` (animaciones con framer-motion, glassmorphism, surfaceCardClass)
- **TDD**: Strict mode activo (`openspec/config.yaml`)

## Problem

Actualmente el reporte por categoría (`ReportePorCategoria`) muestra el **valor del inventario** (cuánto vale el stock actual por categoría), pero no hay una vista que responda:

- ¿Qué categorías venden más?
- ¿Cuál es el margen real por grupo de productos?
- ¿Qué tan rápido se vende el inventario de cada categoría?
- ¿Dónde está el mayor retorno vs inversión?

## Proposed Solution

Nueva pestaña dentro de `ReportesInventario` que consuma una Server Action específica (`getVentasPorGrupoAction`) y muestre:

1. **KPI Cards**: Total ingresos, costo, ganancia, margen promedio general
2. **Gráficos**:
   - Barras: Ingresos vs Costo por categoría (comparación lado a lado)
   - Barras: Ganancia neta por categoría
   - Barras: Días estimados para vender stock actual por categoría
   - Pie: Distribución de ingresos por categoría
3. **Tabla detalle**: Cada categoría con métricas completas + indicador visual de rendimiento
4. **Filtros**: Rango de fechas, filtro por categoría específica
5. **Exportación**: PDF y CSV

## Key Metrics

| Métrica | Fórmula | Fuente |
|---------|---------|--------|
| **Unidades Vendidas** | `SUM(vi.cantidad)` | VentaItem |
| **Ingresos Brutos** | `SUM(vi.total)` | VentaItem.total |
| **Costo Total** | `SUM(vi.cantidad * p.precioCosto)` | VentaItem.cantidad × Producto.precioCosto |
| **Ganancia Meta** | IngresosBrutos - CostoTotal | Calculado |
| **Margen %** | `(Ganancia / IngresosBrutos) * 100` | Calculado |
| **Stock Actual** | `SUM(p.stock)` | Producto.stock (filtrado por categoría) |
| **Días para Vender** | `StockActual / (UnidsVendidas / DiasEnPeriodo)` | Calculado. Mide cuántos días tomaría agotar el stock actual al ritmo actual de ventas. |
| **ROI** | `(Ganancia / CostoTotal) * 100` | Calculado |

## Data Source

Se creará una nueva Server Action:

```typescript
// src/features/reportes-financieros/actions-ventas-grupo.ts
'use server';

export const getVentasPorGrupoAction = withAction(
  async (params: {
    fechaInicio?: string;
    fechaFin?: string;
    categoriaId?: string;
  }, user: AuthenticatedUser) => {
    // Query que agrupa VentaItem por Producto.categoriaId
    // y calcula las métricas agregadas
  }
);
```

### Prisma Query Strategy

```sql
SELECT 
  p.categoriaId,
  c.nombre as categoriaNombre,
  COUNT(DISTINCT vi.ventaId) as totalTransacciones,
  SUM(vi.cantidad) as totalUnidadesVendidas,
  SUM(vi.total) as ingresosBrutos,
  SUM(vi.cantidad * p.precioCosto) as costoTotal,
  (SUM(vi.total) - SUM(vi.cantidad * p.precioCosto)) as gananciaMeta,
  MAX(p.stock) as stockActual, -- mismo para todos los items de la categoría
  -- días desde la primera venta en el período hasta el final del período
FROM venta_items vi
JOIN producto p ON vi.productoId = p.id
JOIN categoria c ON p.categoriaId = c.catId
WHERE vi.createdAt BETWEEN fechaInicio AND fechaFin
  AND (categoriaId IS NULL OR p.categoriaId = categoriaId)
GROUP BY p.categoriaId, c.nombre
ORDER BY ingresosBrutos DESC;
```

## Impact Analysis

**Affected modules:**
- `src/features/reportes-financieros/` → new action file + new component
- `src/features/reportes-financieros/components/reportes-inventario.tsx` → add new tab
- `src/features/reportes-financieros/types.ts` → new types for group metrics

**New files:**
- `src/features/reportes-financieros/actions-ventas-grupo.ts` (Server Action)
- `src/features/reportes-financieros/components/reporte-ventas-grupo.tsx` (Component)

**Risks:**
- Prisma raw query may be needed for complex aggregation → fallback to in-memory computation
- Performance with large datasets → add pagination or limit periods
- "Days to sell" is an estimate, not exact → must label clearly

**Non-goals:**
- No real-time updates (same as other reports)
- No WebSocket or push notifications
- No changes to Prisma schema

## Alternatives Considered

1. **Do nothing**: Users have no visibility into category profitability → rejected
2. **Extend ReportePorCategoria**: Would mix inventory valuation with sales metrics → rejected (SRP)
3. **Dedicated API route**: Server Action pattern is preferred for new features → chosen

## Next

→ **Spec** (if approved): Detailed Given/When/Then for data calculations and UI behavior
→ **Design** (if approved): Wireframe, component tree, states
