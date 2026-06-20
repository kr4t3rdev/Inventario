'use client'

import { useEffect, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
  X,
  TrendingUp,
} from 'lucide-react'
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
  precioCosto: number
  className?: string
}

const LIMIT = 20

function getMargenBadgeColor(margen: number): string {
  if (margen > 20) return 'bg-green-600'
  if (margen >= 0) return 'bg-yellow-600'
  return 'bg-red-600'
}

/**
 * @description Componente de trazabilidad FIFO en ventas. Muestra una tabla
 *   paginada de ventas del producto con costo real calculado desde
 *   PurchaseAllocation, margen real, y resumen de rentabilidad. Incluye
 *   filtros de fecha e indicador visual para ventas legacy (sin allocations).
 */
export function VentasTrazabilidad({
  productoId,
  precioCosto,
  className,
}: VentasTrazabilidadProps) {
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
    return () => {
      cancelled = true
    }
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

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {/* Resumen de rentabilidad */}
      {data && data.resumen.cantidadVentas > 0 && (
        <div className="bg-muted/40 rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <h3 className="text-sm font-medium">Resumen de rentabilidad</h3>
          </div>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Total vendido</dt>
              <dd className="text-lg font-semibold">{data.resumen.totalVendido}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Costo total</dt>
              <dd className="text-lg font-semibold">{data.resumen.costoTotal.toFixed(0)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Margen promedio</dt>
              <dd className="text-lg font-semibold">
                {data.resumen.margenPromedio.toFixed(1)}%
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Cantidad ventas</dt>
              <dd className="text-lg font-semibold">{data.resumen.cantidadVentas}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <Filter className="text-muted-foreground h-4 w-4" aria-hidden="true" />
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

      {/* Tabla de ventas */}
      <div className="rounded-lg border overflow-x-auto">
        {isLoading && (
          <div
            className="flex items-center justify-center py-8"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {error && (
          <div role="alert" className="text-destructive bg-card p-4 text-sm">
            {error}
          </div>
        )}

        {!isLoading && !error && data && data.items.length === 0 && (
          <div className="text-muted-foreground p-8 text-center text-sm">
            No hay ventas registradas para este producto
          </div>
        )}

        {!isLoading && !error && data && data.items.length > 0 && (
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((it) => (
                <TableRow key={it.ventaItemId}>
                  <TableCell>{format(new Date(it.fecha), 'PP', { locale: es })}</TableCell>
                  <TableCell>
                    {it.clienteNombre}
                    {it.esLegacy && <span className="text-muted-foreground ml-1 text-xs">*</span>}
                  </TableCell>
                  <TableCell className="text-right">{it.cantidad}</TableCell>
                  <TableCell className="text-right">{it.precioUnitario}</TableCell>
                  <TableCell className="text-right">{it.ingresoTotal}</TableCell>
                  <TableCell className="text-right">
                    {it.costoReal.toFixed(0)}
                    {it.esLegacy && <span className="text-muted-foreground ml-1 text-xs">(est.)</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className={getMargenBadgeColor(it.margenReal)}>
                      {it.margenReal.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Nota al pie para ventas legacy */}
      {data && data.items.some((it) => it.esLegacy) && (
        <p className="text-muted-foreground text-xs">
          * Ventas legacy: costo estimado usando precioCosto del producto (sin trazabilidad FIFO).
        </p>
      )}

      {/* Paginación */}
      {data && data.pagination.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
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
      )}
    </div>
  )
}
