# Propuesta: Trazabilidad FIFO en Ventas

## Resumen Ejecutivo

Agregar una pestaña "Ventas" en la ficha de costo que muestre el historial de ventas del producto con trazabilidad FIFO completa: para cada venta, el costo real calculado desde `PurchaseAllocation` (no el `precioCosto` actual), el margen real, y un resumen agregado de rentabilidad. Esto cierra el ciclo de visibilidad: la ficha ya muestra cuánto cuesta el producto (compras) y cuánto vale (CPP), pero no muestra a cuánto se vendió ni con qué margen real.

## Contexto

### Qué hay actualmente
- `PurchaseAllocation`: modelo Prisma que vincula `VentaItem` → `CompraDocumentoItem` con `cantidad` (FIFO). Índices en `ventaItemId`, `compraDocumentoItemId`, `tenantId`.
- `calcularCostoVenta()` en `contabilidad/utils/venta-costo.ts`: función pura que recibe `VentaParaCosto[]` y devuelve costo histórico total. Usa allocations si existen, fallback a `producto.precioCosto` para cobertura parcial o ventas legacy.
- `getRentabilidadCompraAction`: consulta `PurchaseAllocation` desde perspectiva de compra (dado un `compraDocumentoId`, muestra productos vendidos desde esa compra). No sirve para la perspectiva inversa (dado un producto, mostrar sus ventas).
- `historial-costos.tsx`: componente cliente con patrón de tabla paginada + filtros por fecha + resumen agregado. Este es el molde de UI.
- `ficha-costo-view.tsx`: vista con pestañas (Resumen, Composición, Historial de compras, Listas de precios).

### Qué falta
- No existe una Server Action que consulte ventas de un producto con sus allocations.
- No existe un componente UI que muestre ventas con costo FIFO y margen.
- La pestaña "Ventas" no existe en `ficha-costo-view.tsx`.

## Objetivo

Que el usuario pueda ver, desde la ficha de costo de un producto:
1. Cada venta realizada con fecha, cantidad, precio unitario, ingreso total.
2. El costo real de cada venta (calculado FIFO desde `PurchaseAllocation`).
3. El margen real de cada venta (ingreso - costo FIFO) y su porcentaje.
4. Un resumen agregado: total vendido, costo total, margen total, margen promedio.

## Alcance

### In Scope
- Server Action `getVentasProductoAction` con paginación y filtros por fecha.
- Componente cliente `ventas-trazabilidad.tsx` con tabla paginada + resumen.
- Tipos TypeScript en `types.ts` para input/output de la action.
- Nueva pestaña "Ventas" en `ficha-costo-view.tsx`.
- Integración con `calcularCostoVenta()` para el cálculo de costo FIFO.
- Tests unitarios de la Server Action (mock de Prisma).
- Tests de componente para `ventas-trazabilidad.tsx`.
- Re-export desde `actions.ts` y `types.ts` barrel.

### Out of Scope
- Modificar el schema Prisma (no se necesitan migraciones).
- Exportar a PDF las ventas (la pestaña PDF actual solo exporta el resumen).
- Filtros por punto de venta o empleado (se puede agregar después).
- Gráficos de tendencia de ventas.
- Ventas de productos compuestos (solo productos simples en esta iteración).

## Arquitectura Propuesta

### Server Action: `getVentasProductoAction`

**Archivo**: `src/features/ficha-costo/actions-ventas.ts`

**Signature**:
```typescript
export const getVentasProductoAction = withAction(
  async (
    input: GetVentasProductoInput,
    user: AuthenticatedUser,
  ): Promise<VentasProductoData>
)
```

**Input** (`GetVentasProductoInput`):
```typescript
interface GetVentasProductoInput {
  productoId: string
  page?: number       // default: 1
  limit?: number      // default: 20, max: 100
  fechaDesde?: string // ISO date string
  fechaHasta?: string // ISO date string
}
```

**Output** (`VentasProductoData`):
```typescript
interface VentasProductoData {
  items: VentaTrazabilidadItem[]
  resumen: ResumenVentasProducto
  pagination: HistorialCostosPagination // reusar tipo existente
}
```

**Lógica interna**:
1. `requireTenant(user)` + `requireFeature(user, 'productos', 'ver trazabilidad de ventas')`.
2. Verificar producto pertenece al tenant (`producto.findFirst` con `tenantId`).
3. Consultar `VentaItem` paginado con `productoId` filter, incluyendo:
   - `venta`: `{ ventaId, createdAt, total, deletedAt }` (filter `venta.deletedAt: null`)
   - `allocations`: `{ cantidad, compraDocumentoItem: { precioUnitario } }`
   - `producto`: `{ precioCosto }` (para fallback)
4. Para cada `VentaItem`, construir `VentaParaCosto` con un solo item y llamar `calcularCostoVenta([ventaParaCosto])` para obtener el costo FIFO de esa línea.
5. Calcular margen: `ingreso - costoFIFO`, porcentaje: `(margen / ingreso) * 100`.
6. Calcular resumen sobre el total de registros (no solo la página actual) usando una query agregada o acumulando en el mismo query.

**Query pattern** (pseudo-código Prisma):
```typescript
const where = {
  productoId: input.productoId,
  venta: {
    tenantId,
    deletedAt: null,
    ...(fechaDesde && { createdAt: { gte: new Date(fechaDesde) } }),
    ...(fechaHasta && { createdAt: { lte: new Date(fechaHasta) } }),
  },
}

const [items, total] = await Promise.all([
  prisma.ventaItem.findMany({
    where,
    orderBy: { venta: { createdAt: 'desc' } },
    skip, take: limit,
    select: {
      id: true,
      cantidad: true,
      precioUnitario: true,
      total: true,
      producto: { select: { precioCosto: true } },
      venta: {
        select: {
          ventaId: true,
          createdAt: true,
          total: true,
        },
      },
      allocations: {
        select: {
          cantidad: true,
          compraDocumentoItem: { select: { precioUnitario: true } },
        },
      },
    },
  }),
  prisma.ventaItem.count({ where }),
])
```

### Componente UI: `ventas-trazabilidad.tsx`

**Archivo**: `src/features/ficha-costo/components/ventas-trazabilidad.tsx`

**Props**:
```typescript
interface VentasTrazabilidadProps {
  productoId: string
  className?: string
}
```

**Comportamiento**:
- Estado local: `page`, `fechaDesde`, `fechaHasta`, `data`, `isLoading`, `error`.
- `useEffect` para cargar datos al montar y cuando cambian filtros/página (mismo patrón que `historial-costos.tsx`).
- Tabla con columnas: Fecha | Cantidad | Precio Unitario | Ingreso | Costo FIFO | Margen | Margen %.
- Badge de margen: verde si > 20%, amarillo si 0-20%, rojo si < 0 (pérdida).
- Sección de resumen al final: total vendido (cantidad), ingreso total, costo total, margen total, margen promedio.
- Paginación con botones anterior/siguiente (replicar patrón de `historial-costos.tsx`).
- Filtros por rango de fechas (replicar patrón de `historial-costos.tsx`).
- Estados: loading (spinner), error (alert), vacío (mensaje).

### Tipos TypeScript (en `types.ts`)

```typescript
// ─── Tipos de trazabilidad de ventas ──────────────────────

export interface VentaTrazabilidadItem {
  ventaItemId: string
  ventaId: string
  fecha: string           // ISO string de venta.createdAt
  cantidad: number
  precioUnitario: number
  ingreso: number         // VentaItem.total
  costoFifo: number       // calculado por calcularCostoVenta()
  margen: number          // ingreso - costoFifo
  margenPorcentaje: number // (margen / ingreso) * 100
  tieneAllocaciones: boolean // false → se usó fallback a precioCosto
}

export interface ResumenVentasProducto {
  cantidadTotalVendida: number
  ingresoTotal: number
  costoTotal: number
  margenTotal: number
  margenPromedio: number  // (margenTotal / ingresoTotal) * 100
  totalVentas: number     // count de VentaItems
}

export interface VentasProductoData {
  items: VentaTrazabilidadItem[]
  resumen: ResumenVentasProducto
  pagination: HistorialCostosPagination
}

export interface GetVentasProductoInput {
  productoId: string
  page?: number
  limit?: number
  fechaDesde?: string
  fechaHasta?: string
}
```

### Reuso de Código Existente

| Código existente | Cómo se integra |
|---|---|
| `calcularCostoVenta()` | Se llama por cada `VentaItem` con un `VentaParaCosto` de un solo item para obtener el costo FIFO individual. Esto permite mostrar el costo por línea de venta. |
| Patrón `historial-costos.tsx` | Se replica: `useEffect` + paginación + filtros por fecha + tabla con `Table`/`TableBody`/`TableCell` + paginación con `ChevronLeft`/`ChevronRight` + sección de resumen. |
| `withAction` wrapper | Misma pattern que `actions-historial.ts`: auth automática, `requireTenant`, `requireFeature`, retorno `{ success, data }`. |
| `HistorialCostosPagination` | Se reusa directamente para la paginación de ventas. |
| `requireFeature('productos', ...)` | Mismo feature flag que historial de costos. |

### Integración en `ficha-costo-view.tsx`

Agregar nueva pestaña después de "Historial de compras":
```tsx
<TabsTrigger value="ventas">Ventas</TabsTrigger>
// ...
<TabsContent value="ventas" className="mt-4">
  <VentasTrazabilidad productoId={data.producto.id} />
</TabsContent>
```

## Consideraciones Técnicas

### Performance
- **Paginación**: `findMany` con `skip/take` + `count` en paralelo (`Promise.all`). Default 20 items por página.
- **Índices existentes**: `VentaItem` tiene índice en `productoId` (FK). `Venta` tiene índice en `[tenantId, createdAt]`. `PurchaseAllocation` tiene índice en `ventaItemId`. Las queries están cubiertas.
- **N+1 avoidance**: las allocations se traen inline con `select` en el mismo query de `VentaItem`, no en queries separadas.
- **Resumen**: para el resumen agregado se puede calcular en la misma query contando todos los registros (no solo la página). Alternativa: query separado de agregación si el dataset es muy grande.

### Ventas legacy (sin VentaItems)
- El modelo `Venta` legacy tiene `productoId` y `cantidad` directos en la venta, sin `VentaItem`.
- **Decisión**: en esta iteración solo mostrar ventas con `VentaItem` (modelo nuevo). Las ventas legacy sin items se excluyen con un filter `items: { some: { productoId } }` o se incluyen con costo = `precioCosto * cantidad` como fallback.
- **Mitigación**: documentar en la UI que las ventas antiguas pueden no mostrar costo FIFO.

### Soft-delete
- Filtrar `venta.deletedAt: null` en la query principal.
- `VentaItem` no tiene `deletedAt` propio; hereda el de `Venta`.

### Autorización
- `requireTenant(user)`: multi-tenant estricto.
- `requireFeature(user, 'productos', 'ver trazabilidad de ventas')`: mismo feature que historial.
- Producto de otro tenant → `ActionError('Producto no encontrado', 'NOT_FOUND')` (opaco).

## Criterios de Aceptación

- [ ] La pestaña "Ventas" aparece en la ficha de costo entre "Historial de compras" y "Listas de precios".
- [ ] La tabla muestra fecha, cantidad, precio unitario, ingreso, costo FIFO, margen y margen % para cada venta.
- [ ] El costo FIFO se calcula usando `PurchaseAllocation` vía `calcularCostoVenta()`.
- [ ] Las ventas sin allocations muestran costo basado en `precioCosto` actual (fallback) con flag `tieneAllocaciones: false`.
- [ ] El resumen muestra: total vendido, ingreso total, costo total, margen total, margen promedio.
- [ ] La paginación funciona con 20 items por página.
- [ ] Los filtros por rango de fechas funcionan y resetean la página a 1.
- [ ] Solo se muestran ventas no soft-deleted (`venta.deletedAt: null`).
- [ ] Multi-tenant: producto de otro tenant retorna NOT_FOUND opaco.
- [ ] Tests unitarios de la Server Action pasan (mock de Prisma).
- [ ] Tests de componente pasan (Testing Library).
- [ ] Los 84 tests existentes siguen pasando (no regressions).

## Riesgos

| Riesgo | Likelihood | Mitigación |
|---|---|---|
| Ventas legacy sin `VentaItem` no muestran costo FIFO real | Medium | Fallback a `precioCosto` + flag `tieneAllocaciones: false` en UI. Documentar limitación. |
| Query lento con muchos allocations por VentaItem | Low | Los allocations se traen inline con `select`. Si hay > 10 allocations por item, sigue siendo rápido por los índices. |
| Resumen calculado solo sobre la página actual (no el total) | Medium | Calcular resumen con query separado de agregación o acumular en un segundo query sin paginación. |
| `calcularCostoVenta()` espera `VentaParaCosto[]` y se llama con un solo elemento por vez | Low | La función ya soporta arrays de cualquier tamaño. Se adapta el input a la estructura esperada. |

## Rollback Plan

La feature es aditiva (nueva pestaña, nueva action, nuevo componente). No modifica código existente más allá de:
1. Agregar un `<TabsTrigger>` y `<TabsContent>` en `ficha-costo-view.tsx`.
2. Agregar re-exports en `actions.ts` y barrel de tipos.

**Rollback**: revertir el commit. No hay migraciones de BD ni cambios en actions existentes.

## Dependencias

- `PurchaseAllocation` (modelo Prisma existente) — sin cambios.
- `calcularCostoVenta()` en `contabilidad/utils/venta-costo.ts` — sin cambios, solo consumo.
- `withAction` wrapper en `lib/server-actions` — sin cambios.
- `historial-costos.tsx` — referencia de patrón, sin cambios.
- `types.ts` del módulo ficha-costo — se extiende con nuevos tipos.
