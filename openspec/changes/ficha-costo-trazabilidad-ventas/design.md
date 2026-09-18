# Design: ficha-costo-trazabilidad-ventas

## Overview

Agregar trazabilidad FIFO completa a la ficha de costo del producto, mostrando el historial de ventas con costo real calculado desde `PurchaseAllocation`, margen por venta, y resumen agregado de rentabilidad. Cierra el ciclo de visibilidad: compras (costo) → composición (CPP) → ventas (ingreso + margen real).

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ficha-costo-view.tsx                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tabs: [Resumen] [Composición] [Historial]            │  │
│  │        [Ventas] ← NEW TAB                            │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  VentasTrazabilidad (client component)         │  │  │
│  │  │  - Estado: page, filtros, data, loading, error │  │  │
│  │  │  - useEffect → getVentasProductoAction         │  │  │
│  │  │  - Render: tabla + resumen + paginación        │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              actions-ventas.ts (Server Action)               │
│  1. requireTenant() + requireFeature()                      │
│  2. Validar producto pertenece al tenant                    │
│  3. Query 1: VentaItem paginados (skip/take)                │
│     - include: venta (fecha, cliente), allocations, producto│
│  4. Query 2: Resumen agregado (SUM cantidad, total)         │
│  5. Calcular costo FIFO por item:                           │
│     - Si tiene allocations → Σ(cantidad * precioUnitario)   │
│     - Si no tiene → fallback a producto.precioCosto         │
│  6. Calcular margen: ingreso - costoFifo                    │
│  7. Retornar: { items, resumen, pagination }                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Prisma ORM                                │
│  - VentaItem (productoId, ventaId, cantidad, precioUnitario)│
│  - Venta (createdAt, clienteId, deletedAt)                  │
│  - Cliente (nombre)                                         │
│  - PurchaseAllocation (ventaItemId, compraDocumentoItemId)  │
│  - CompraDocumentoItem (precioUnitario)                     │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
FichaCostoView (existing)
├── Tabs
│   ├── Resumen (existing)
│   ├── Composición (existing, conditional)
│   ├── Historial de compras (existing)
│   ├── Ventas ← NEW
│   │   └── VentasTrazabilidad ← NEW COMPONENT
│   │       ├── Filters (date range)
│   │       ├── Table
│   │       │   ├── TableHeader
│   │       │   └── TableBody
│   │       │       └── TableRow (per venta)
│   │       │           ├── Fecha
│   │       │           ├── Cliente
│   │       │           ├── Cantidad
│   │       │           ├── Precio Unitario
│   │       │           ├── Ingreso
│   │       │           ├── Costo Real (FIFO)
│   │       │           ├── Margen
│   │       │           └── Margen % (badge color-coded)
│   │       ├── Resumen (aggregated metrics)
│   │       └── Pagination
│   └── Listas de precios (existing)
```

## Data Model

### New Types (in `types.ts`)

```typescript
// ─── Tipos de trazabilidad de ventas ──────────────────────

export interface VentaTrazabilidadItem {
  ventaItemId: string
  ventaId: string
  fecha: string           // ISO string de venta.createdAt
  clienteNombre: string   // 'Cliente genérico' si no hay cliente
  cantidad: number
  precioUnitario: number
  ingreso: number         // VentaItem.total
  costoFifo: number       // calculado desde PurchaseAllocation
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
  pagination: HistorialCostosPagination // reusar tipo existente
}

export interface GetVentasProductoInput {
  productoId: string
  page?: number       // default: 1
  limit?: number      // default: 20, max: 100
  fechaDesde?: string // ISO date string
  fechaHasta?: string // ISO date string
}
```

## API Contract

### Server Action Signature

```typescript
'use server'

import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireTenant, requireFeature } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import type { VentasProductoData, GetVentasProductoInput } from './types'

/**
 * @description Devuelve el historial paginado de ventas del producto con
 *   trazabilidad FIFO completa: costo real calculado desde PurchaseAllocation,
 *   margen por venta, y resumen agregado de rentabilidad.
 *   Filtros opcionales por rango de fechas. Límite por defecto: 20.
 *   Excluye ventas soft-deleted (deletedAt: null).
 */
export const getVentasProductoAction = withAction(
  async (
    input: GetVentasProductoInput,
    user: AuthenticatedUser,
  ): Promise<VentasProductoData> => {
    // ... implementation
  }
)
```

### Input Validation

```typescript
const page = input.page && input.page > 0 ? input.page : 1
const limit = input.limit && input.limit > 0 && input.limit <= 100 
  ? input.limit 
  : 20
const skip = (page - 1) * limit
```

### Error Handling

- **Producto no encontrado**: `ActionError('Producto no encontrado', 'NOT_FOUND')` (opaco, no revela existencia)
- **Sin autenticación**: `withAction` wrapper rechaza automáticamente
- **Sin permisos**: `requireFeature` lanza error si no tiene acceso

## FIFO Cost Calculation

### Algorithm

```typescript
/**
 * Calcula el costo FIFO de un VentaItem desde sus PurchaseAllocation.
 * 
 * @param allocations - PurchaseAllocation del VentaItem con compraDocumentoItem
 * @param cantidadVenta - Cantidad vendida en el VentaItem
 * @param precioCostoActual - precioCosto actual del producto (fallback)
 * @returns { costo: number, tieneAllocaciones: boolean }
 */
function calcularCostoFifoItem(
  allocations: Array<{ cantidad: number; compraDocumentoItem: { precioUnitario: number } | null }>,
  cantidadVenta: number,
  precioCostoActual: number
): { costo: number; tieneAllocaciones: boolean } {
  if (!allocations || allocations.length === 0) {
    // Legacy: sin allocations → fallback a precioCosto actual
    return {
      costo: cantidadVenta * precioCostoActual,
      tieneAllocaciones: false,
    }
  }

  // Calcular costo desde allocations FIFO
  const allocatedQty = allocations.reduce((sum, a) => sum + a.cantidad, 0)
  const allocatedCost = allocations.reduce(
    (sum, a) => sum + a.cantidad * (a.compraDocumentoItem?.precioUnitario ?? 0),
    0
  )

  // Si las allocations no cubren toda la cantidad, completar con precioCosto
  const remaining = Math.max(0, cantidadVenta - allocatedQty)
  const fallbackCost = remaining * precioCostoActual

  return {
    costo: allocatedCost + fallbackCost,
    tieneAllocaciones: true,
  }
}
```

### Decision: Inline vs. Reusar `calcularCostoVenta()`

**Decisión**: Implementar función inline `calcularCostoFifoItem()` en `actions-ventas.ts`.

**Razonamiento**:
- `calcularCostoVenta()` en `contabilidad/utils/venta-costo.ts` está diseñada para el Estado de Resultados (agregado de múltiples ventas).
- Necesitamos el costo **por VentaItem individual**, no el total.
- La función inline es más simple (un item a la vez) y más performante (sin overhead de construir `VentaParaCosto[]`).
- Mantiene la misma lógica FIFO pero adaptada al caso de uso de trazabilidad.

**Tradeoff**: Duplicación parcial de lógica, pero cada función tiene responsabilidad clara y contextos diferentes.

## Query Strategy

### Three Queries in Parallel

```typescript
const where = {
  productoId: input.productoId,
  venta: {
    tenantId,
    deletedAt: null,
    ...(input.fechaDesde && { createdAt: { gte: new Date(input.fechaDesde) } }),
    ...(input.fechaHasta && { createdAt: { lte: new Date(input.fechaHasta) } }),
  },
}

const [ventaItems, total, resumenData] = await Promise.all([
  // Query 1: VentaItem paginados con relaciones
  prisma.ventaItem.findMany({
    where,
    orderBy: { venta: { createdAt: 'desc' } },
    skip,
    take: limit,
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
          clienteId: true,
          cliente: { select: { nombre: true } },
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
  
  // Query 2: Count total para paginación
  prisma.ventaItem.count({ where }),
  
  // Query 3: Resumen agregado sobre TODO el dataset filtrado
  prisma.ventaItem.aggregate({
    where,
    _sum: {
      cantidad: true,
      total: true, // ingreso total
    },
  }),
])
```

### Post-Processing

```typescript
// Calcular costo FIFO por item
const items: VentaTrazabilidadItem[] = ventaItems.map((vi) => {
  const { costo: costoFifo, tieneAllocaciones } = calcularCostoFifoItem(
    vi.allocations,
    vi.cantidad,
    vi.producto.precioCosto
  )
  
  const ingreso = vi.total
  const margen = ingreso - costoFifo
  const margenPorcentaje = ingreso > 0 ? (margen / ingreso) * 100 : 0
  
  return {
    ventaItemId: vi.id,
    ventaId: vi.venta.ventaId,
    fecha: vi.venta.createdAt.toISOString(),
    clienteNombre: vi.venta.cliente?.nombre ?? 'Cliente genérico',
    cantidad: vi.cantidad,
    precioUnitario: vi.precioUnitario,
    ingreso,
    costoFifo,
    margen,
    margenPorcentaje,
    tieneAllocaciones,
  }
})

// Calcular costo total desde allocations (no disponible en aggregate)
// Necesitamos una 4ta query para obtener el costo total real
const allAllocations = await prisma.purchaseAllocation.findMany({
  where: {
    ventaItem: {
      productoId: input.productoId,
      venta: {
        tenantId,
        deletedAt: null,
        ...(input.fechaDesde && { createdAt: { gte: new Date(input.fechaDesde) } }),
        ...(input.fechaHasta && { createdAt: { lte: new Date(input.fechaHasta) } }),
      },
    },
  },
  select: {
    cantidad: true,
    compraDocumentoItem: { select: { precioUnitario: true } },
  },
})

const costoTotal = allAllocations.reduce(
  (sum, a) => sum + a.cantidad * (a.compraDocumentoItem?.precioUnitario ?? 0),
  0
)

// Para items legacy sin allocations, necesitamos contar cuántos hay
// y estimar su costo (limitación: usamos precioCosto actual)
const legacyItemsCount = items.filter(i => !i.tieneAllocaciones).length
const legacyCostEstimate = items
  .filter(i => !i.tieneAllocaciones)
  .reduce((sum, i) => sum + i.costoFifo, 0)

const costoTotalFinal = costoTotal + legacyCostEstimate
const ingresoTotal = resumenData._sum.total ?? 0
const margenTotal = ingresoTotal - costoTotalFinal
const margenPromedio = ingresoTotal > 0 ? (margenTotal / ingresoTotal) * 100 : 0

return {
  items,
  resumen: {
    cantidadTotalVendida: resumenData._sum.cantidad ?? 0,
    ingresoTotal,
    costoTotal: costoTotalFinal,
    margenTotal,
    margenPromedio,
    totalVentas: total,
  },
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  },
}
```

### Performance Considerations

- **4 queries en total**: 3 en paralelo (ventaItems, count, aggregate) + 1 adicional para costo total.
- **Índices existentes**: `VentaItem.productoId`, `Venta[tenantId, createdAt]`, `PurchaseAllocation[ventaItemId]`.
- **N+1 evitado**: allocations se traen inline con `select` en el query de VentaItem.
- **Tradeoff**: La 4ta query para costo total es necesaria porque `aggregate` no puede calcular costos FIFO. Para datasets muy grandes (>10k ventas), considerar cacheo o materialización.

## UI Changes

### Visual Direction

**Concept**: "Financial Dashboard" — denso, informativo, semáforo de rentabilidad.

**Paleta de colores**:
- **Verde** (`bg-green-600`): Margen > 20% (saludable)
- **Amarillo** (`bg-yellow-500`): Margen 0-20% (advertencia)
- **Rojo** (`bg-red-600`): Margen < 0% (pérdida)
- **Gris** (`bg-gray-400`): Legacy (sin allocations FIFO)

**Tipografía**:
- Mantener sistema actual (Tailwind defaults)
- Números: `font-mono` para alineación en tablas
- Monto negativos: `text-red-600` con prefijo `-`

**Layout**:
- Tabla densa con bordes sutiles (`border-gray-200`)
- Resumen sticky al final (siempre visible al hacer scroll)
- Filtros compactos en la parte superior
- Paginación minimalista (solo anterior/siguiente)

**Animaciones**:
- Transición suave en cambios de página (`transition-opacity`)
- Skeleton loader durante fetch inicial
- Fade-in en filas de tabla (staggered, 50ms delay)

### Component Structure

```typescript
'use client'

import { useEffect, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Loader2, Filter, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getVentasProductoAction } from '../actions-ventas'
import type { VentasProductoData } from '../types'

interface VentasTrazabilidadProps {
  productoId: string
  className?: string
}

const LIMIT = 20

/**
 * @description Tabla paginada de ventas del producto con trazabilidad FIFO:
 *   costo real calculado desde PurchaseAllocation, margen por venta,
 *   y resumen agregado de rentabilidad. Incluye filtros por rango de fechas.
 */
export function VentasTrazabilidad({ productoId, className }: VentasTrazabilidadProps) {
  const [page, setPage] = useState(1)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [data, setData] = useState<VentasProductoData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      const res = await getVentasProductoAction({
        productoId,
        page,
        limit: LIMIT,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
      })
      if (cancelled) return
      if (!res.success) {
        setError(res.error?.message ?? 'Error desconocido')
        setData(null)
      } else {
        setData(res.data)
      }
      setIsLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [productoId, page, fechaDesde, fechaHasta])

  const totalPages = data?.pagination.totalPages ?? 1
  const filtersActive = Boolean(fechaDesde || fechaHasta)

  function clearFilters() {
    startTransition(() => {
      setFechaDesde('')
      setFechaHasta('')
      setPage(1)
    })
  }

  function getMarginBadgeClass(margenPorcentaje: number): string {
    if (margenPorcentaje > 20) return 'bg-green-600 text-white'
    if (margenPorcentaje >= 0) return 'bg-yellow-500 text-white'
    return 'bg-red-600 text-white'
  }

  function formatCurrency(value: number): string {
    return `$${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {/* Filtros */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-500" aria-hidden="true" />
        <span className="text-sm font-medium">Filtros</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Input
          type="date"
          value={fechaDesde}
          aria-label="Fecha desde"
          onChange={(e) => {
            setFechaDesde(e.target.value)
            setPage(1)
          }}
        />
        <Input
          type="date"
          value={fechaHasta}
          aria-label="Fecha hasta"
          onChange={(e) => {
            setFechaHasta(e.target.value)
            setPage(1)
          }}
        />
        {filtersActive && (
          <Button onClick={clearFilters} variant="outline" size="sm" className="gap-2">
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && data && data.items.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">No hay ventas registradas para este producto</p>
        </div>
      )}

      {/* Tabla */}
      {!isLoading && !error && data && data.items.length > 0 && (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-right">Ingreso</TableHead>
                  <TableHead className="text-right">Costo Real</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead className="text-right">Margen %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.ventaItemId}>
                    <TableCell>{format(new Date(item.fecha), 'PP', { locale: es })}</TableCell>
                    <TableCell>{item.clienteNombre}</TableCell>
                    <TableCell className="text-right font-mono">{item.cantidad}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.precioUnitario)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.ingreso)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.costoFifo)}
                      {!item.tieneAllocaciones && (
                        <span className="ml-1 text-xs text-gray-400" title="Costo estimado (sin allocations FIFO)">*</span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${item.margen < 0 ? 'text-red-600' : ''}`}>
                      {formatCurrency(item.margen)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={getMarginBadgeClass(item.margenPorcentaje)}>
                        {item.margenPorcentaje.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Resumen */}
          <div className="rounded-lg border bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold">Resumen de Rentabilidad</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <div>
                <div className="text-xs text-gray-600">Total vendido</div>
                <div className="text-lg font-semibold font-mono">{data.resumen.cantidadTotalVendida}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Ingreso total</div>
                <div className="text-lg font-semibold font-mono">{formatCurrency(data.resumen.ingresoTotal)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Costo total</div>
                <div className="text-lg font-semibold font-mono">{formatCurrency(data.resumen.costoTotal)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Margen total</div>
                <div className={`text-lg font-semibold font-mono ${data.resumen.margenTotal < 0 ? 'text-red-600' : ''}`}>
                  {formatCurrency(data.resumen.margenTotal)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Margen promedio</div>
                <div className="text-lg font-semibold font-mono">
                  {data.resumen.margenPromedio.toFixed(1)}%
                </div>
              </div>
            </div>
            {data.items.some(i => !i.tieneAllocaciones) && (
              <p className="mt-3 text-xs text-gray-500">
                * Incluye ventas con costo estimado (sin trazabilidad FIFO completa)
              </p>
            )}
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Página {data.pagination.page} de {totalPages} · {data.pagination.total} ventas
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

### Integration in `ficha-costo-view.tsx`

```typescript
// Agregar import
import { VentasTrazabilidad } from './ventas-trazabilidad'

// Agregar TabsTrigger después de "Historial de compras"
<TabsTrigger value="historial">Historial de compras</TabsTrigger>
<TabsTrigger value="ventas">Ventas</TabsTrigger>
<TabsTrigger value="listas">Listas de precios</TabsTrigger>

// Agregar TabsContent después de "historial"
<TabsContent value="ventas" className="mt-4">
  <VentasTrazabilidad productoId={data.producto.id} />
</TabsContent>
```

## Test Strategy

### Server Action Tests (`actions-ventas.test.ts`)

**Coverage**: 10+ tests

```typescript
describe('getVentasProductoAction', () => {
  // Happy path
  test('returns sales with FIFO cost calculated from allocations', async () => {
    // Mock: VentaItem con 2 allocations
    // Assert: costoFifo = Σ(cantidad * precioUnitario)
  })

  test('handles legacy sales without allocations', async () => {
    // Mock: VentaItem sin allocations
    // Assert: costoFifo = producto.precioCosto * cantidad, tieneAllocaciones = false
  })

  test('resolves client name or defaults to "Cliente genérico"', async () => {
    // Mock: Venta con cliente y Venta sin cliente
    // Assert: clienteNombre correcto en ambos casos
  })

  // Pagination
  test('paginates results with default limit 20', async () => {
    // Mock: 25 VentaItems
    // Assert: page 1 returns 20 items, pagination.total = 25
  })

  test('caps limit at 100', async () => {
    // Mock: input.limit = 200
    // Assert: pagination.limit = 100
  })

  // Filters
  test('filters by date range', async () => {
    // Mock: ventas en diferentes fechas
    // Assert: solo retorna ventas dentro del rango
  })

  // Multi-tenant
  test('rejects product from different tenant', async () => {
    // Mock: producto con tenantId diferente
    // Assert: throws ActionError('Producto no encontrado', 'NOT_FOUND')
  })

  // Soft-delete
  test('excludes soft-deleted sales', async () => {
    // Mock: VentaItem con venta.deletedAt != null
    // Assert: no aparece en resultados
  })

  // Empty state
  test('returns empty result for product with no sales', async () => {
    // Mock: 0 VentaItems
    // Assert: items = [], resumen con todos los valores en 0
  })

  // Aggregated summary
  test('calculates summary over all matching sales, not just current page', async () => {
    // Mock: 50 ventas, page 1 limit 10
    // Assert: resumen refleja las 50 ventas
  })

  // Ordering
  test('returns sales ordered by createdAt desc', async () => {
    // Mock: ventas en diferentes fechas
    // Assert: items[0] es la más reciente
  })
})
```

### Component Tests (`ventas-trazabilidad.test.tsx`)

**Coverage**: 5+ tests

```typescript
describe('VentasTrazabilidad', () => {
  test('renders table with sales data', async () => {
    // Mock: getVentasProductoAction retorna 3 ventas
    // Assert: tabla muestra 3 filas con datos correctos
  })

  test('displays margin badge with correct color', async () => {
    // Mock: venta con margen 35%, 12%, -5%
    // Assert: badges con colores verde, amarillo, rojo
  })

  test('shows legacy indicator for sales without allocations', async () => {
    // Mock: venta con tieneAllocaciones = false
    // Assert: muestra asterisco o badge "Legacy"
  })

  test('displays empty state when no sales', async () => {
    // Mock: items = []
    // Assert: muestra "No hay ventas registradas para este producto"
  })

  test('resets page to 1 when filters change', async () => {
    // Mock: usuario cambia fechaDesde
    // Assert: se llama action con page = 1
  })

  test('disables pagination buttons appropriately', async () => {
    // Mock: page 1 of 5
    // Assert: botón anterior deshabilitado, siguiente habilitado
  })

  test('formats currency and percentage correctly', async () => {
    // Mock: ingreso = 1500.50, margenPorcentaje = 34.68
    // Assert: muestra "$1,500.50" y "34.68%"
  })
})
```

### Mocking Strategy

```typescript
// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: { findFirst: vi.fn() },
    ventaItem: { 
      findMany: vi.fn(), 
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    purchaseAllocation: { findMany: vi.fn() },
  },
}))

// Mock Server Action en tests de componente
vi.mock('../actions-ventas', () => ({
  getVentasProductoAction: vi.fn(),
}))
```

## Decisions Resolved

### 1. Integración con `calcularCostoVenta()`

**Decisión**: Implementar función inline `calcularCostoFifoItem()` en lugar de reusar `calcularCostoVenta()`.

**Justificación**:
- `calcularCostoVenta()` está diseñada para el Estado de Resultados (agregado de múltiples ventas).
- Necesitamos costo **por VentaItem individual**, no total.
- Función inline es más simple y performante para este caso de uso.
- Mantiene la misma lógica FIFO pero adaptada al contexto de trazabilidad.

**Tradeoff**: Duplicación parcial de lógica, pero cada función tiene responsabilidad clara.

### 2. Query Strategy

**Decisión**: 4 queries en total (3 en paralelo + 1 adicional para costo total).

**Justificación**:
- Query 1: VentaItem paginados con relaciones (venta, allocations, producto).
- Query 2: Count para paginación.
- Query 3: Aggregate para resumen de cantidades e ingresos.
- Query 4: PurchaseAllocation de TODO el dataset filtrado para calcular costo total real.

**Tradeoff**: 4 queries por request, pero todas optimizadas con índices existentes. Para datasets >10k ventas, considerar cacheo.

### 3. Fallback para Ventas Legacy

**Decisión**: Sí a ambos — fallback a `precioCosto` y badge "Legacy" en UI.

**Justificación**:
- Ventas anteriores a la migración FIFO no tienen `PurchaseAllocation`.
- Fallback a `precioCosto` actual es la mejor aproximación disponible.
- Indicador visual (asterisco + nota al pie) informa al usuario que el costo es estimado.
- Transparente sin ser intrusivo.

### 4. Resumen de Rentabilidad

**Decisión**: Calcular sobre todo el dataset filtrado, no solo la página actual.

**Justificación**:
- Consistencia: el resumen no cambia al navegar entre páginas.
- Precisión: refleja la realidad completa del producto.
- Implementación: query adicional `aggregate` sobre todos los VentaItem filtrados.

**Tradeoff**: Query adicional, pero necesario para consistencia.

### 5. Estructura de Archivos

**Decisión**: Seguir patrón existente del módulo ficha-costo.

```
src/features/ficha-costo/
├── actions-ventas.ts              ← NEW: Server Action
├── components/
│   └── ventas-trazabilidad.tsx    ← NEW: Componente UI
├── __tests__/
│   ├── actions-ventas.test.ts     ← NEW: Tests action
│   └── ventas-trazabilidad.test.tsx ← NEW: Tests UI
├── types.ts                       ← MODIFY: Agregar tipos nuevos
├── actions.ts                     ← MODIFY: Re-export
└── components/
    └── ficha-costo-view.tsx       ← MODIFY: Agregar pestaña
```

### 6. Interfaz TypeScript

**Decisión**: Usar tipos definidos en el proposal (ver sección Data Model).

**Justificación**:
- Consistencia con tipos existentes del módulo.
- Reusar `HistorialCostosPagination` para paginación.
- Tipos puros (sin dependencias de Prisma/Next.js) para reusabilidad en tests.

### 7. Algoritmo de Cálculo FIFO

**Decisión**: Implementar `calcularCostoFifoItem()` inline (ver sección FIFO Cost Calculation).

**Justificación**:
- Claridad: función dedicada con responsabilidad única.
- Performance: sin overhead de construir estructuras complejas.
- Mantenibilidad: lógica FIFO aislada y testeable.

### 8. Estrategia de Testing

**Decisión**: TDD strict con 10+ tests para action, 5+ tests para UI.

**Justificación**:
- Coverage completo de escenarios críticos (FIFO, legacy, multi-tenant, paginación).
- Mock de Prisma para tests de action (rápidos, aislados).
- Mock de Server Action para tests de componente (enfocados en UI).

### 9. Riesgos Técnicos

**Decisión**: Mitigar con documentación y fallbacks.

**Riesgos**:
- **Performance**: 4 queries por request. Mitigación: índices existentes, considerar cacheo para datasets grandes.
- **Ventas legacy**: sin allocations, fallback a `precioCosto`. Mitigación: indicador visual claro.
- **Consistencia**: si se borra una venta, las allocations se borran en cascade. No hay problema.

## Risks & Mitigations

| Riesgo | Likelihood | Impact | Mitigación |
|--------|------------|--------|------------|
| Performance: 4 queries por request | Medium | Medium | Índices existentes en `VentaItem.productoId`, `Venta[tenantId, createdAt]`, `PurchaseAllocation[ventaItemId]`. Para datasets >10k ventas, considerar cacheo o materialización de costos. |
| Ventas legacy sin `PurchaseAllocation` | High | Low | Fallback a `producto.precioCosto` + indicador visual (asterisco + nota al pie). Documentar limitación. |
| Costo total estimado para ventas legacy | Medium | Medium | Nota al pie en resumen: "Incluye ventas con costo estimado (sin trazabilidad FIFO completa)". Transparente sin ser intrusivo. |
| Query 4 lenta para datasets grandes | Low | High | Monitorear performance. Si >1s, considerar indexación adicional o materialización. |
| Inconsistencia si se borra venta después de calcular costo | Low | Low | Cascade delete en `VentaItem` y `PurchaseAllocation`. No hay problema de consistencia. |

## Migration Plan

### Fase 1: Tipos y Server Action (Días 1-2)

1. **Agregar tipos en `types.ts`**:
   - `VentaTrazabilidadItem`
   - `ResumenVentasProducto`
   - `VentasProductoData`
   - `GetVentasProductoInput`

2. **Crear `actions-ventas.ts`**:
   - Implementar `getVentasProductoAction` con `withAction` wrapper.
   - Implementar `calcularCostoFifoItem()` inline.
   - Queries: VentaItem paginados, count, aggregate, PurchaseAllocation para costo total.
   - Manejo de errores: `ActionError` para producto no encontrado.

3. **Re-export en `actions.ts`**:
   - Agregar `export { getVentasProductoAction } from './actions-ventas'`
   - Agregar types al export block.

4. **Tests de Server Action** (`actions-ventas.test.ts`):
   - 10+ tests cubriendo happy path, paginación, multi-tenant, legacy, filtros, empty state.
   - Mock de Prisma.

### Fase 2: Componente UI (Días 3-4)

5. **Crear `ventas-trazabilidad.tsx`**:
   - Componente cliente con estado local (page, filtros, data, loading, error).
   - `useEffect` para cargar datos al montar y cuando cambian filtros/página.
   - Tabla con columnas: Fecha, Cliente, Cantidad, Precio Unit., Ingreso, Costo Real, Margen, Margen %.
   - Badge de margen con colores semáforo (verde/amarillo/rojo).
   - Indicador de legacy (asterisco + nota al pie).
   - Sección de resumen con métricas agregadas.
   - Paginación con botones anterior/siguiente.
   - Filtros por rango de fechas.
   - Estados: loading (spinner), error (alert), vacío (mensaje).

6. **Modificar `ficha-costo-view.tsx`**:
   - Agregar import de `VentasTrazabilidad`.
   - Agregar `<TabsTrigger value="ventas">Ventas</TabsTrigger>` después de "Historial de compras".
   - Agregar `<TabsContent value="ventas">` con `<VentasTrazabilidad productoId={data.producto.id} />`.

7. **Tests de componente** (`ventas-trazabilidad.test.tsx`):
   - 5+ tests cubriendo tabla, resumen, filtros, empty state, paginación.
   - Mock de `getVentasProductoAction`.

### Fase 3: Integración y QA (Día 5)

8. **Pruebas manuales**:
   - Verificar pestaña "Ventas" aparece en ficha de costo.
   - Verificar tabla muestra datos correctos.
   - Verificar filtros por fecha funcionan.
   - Verificar paginación funciona.
   - Verificar resumen se mantiene consistente al cambiar página.
   - Verificar indicador de legacy aparece para ventas sin allocations.
   - Verificar multi-tenant: producto de otro tenant retorna NOT_FOUND.

9. **Pruebas de regresión**:
   - Ejecutar `pnpm test` para verificar que los 84 tests existentes siguen pasando.
   - Ejecutar `pnpm run build` para verificar que no hay errores de compilación.

10. **Documentación**:
    - Actualizar README del módulo ficha-costo con nueva funcionalidad.
    - Documentar limitación de ventas legacy en comentarios del código.

## Out of Scope

- **Modificar el schema Prisma**: No se necesitan migraciones. Se usan modelos existentes (`VentaItem`, `PurchaseAllocation`, `Venta`, `Cliente`).
- **Exportar a PDF las ventas**: La pestaña PDF actual solo exporta el resumen de la ficha. No se extiende en esta iteración.
- **Filtros por punto de venta o empleado**: Se puede agregar en iteraciones futuras si hay demanda.
- **Gráficos de tendencia de ventas**: Fuera del alcance de esta iteración. Enfocarse en tabla y resumen.
- **Ventas de productos compuestos**: Solo productos simples en esta iteración. Productos compuestos requieren desglose de componentes.
- **Cacheo de costos FIFO**: Para datasets muy grandes (>10k ventas), considerar materialización. Fuera del alcance inicial.
- **Edición de ventas desde la ficha**: Solo lectura. Edición de ventas se hace desde el módulo de ventas.
