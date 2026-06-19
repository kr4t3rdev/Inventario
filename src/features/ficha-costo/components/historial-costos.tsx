'use client'

import { useEffect, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Loader2, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getHistorialCostosAction, type HistorialCostosData } from '../actions'

interface HistorialCostosProps {
  productoId: string
  className?: string
}

const LIMIT = 20

/**
 * @description Tabla paginada de líneas de compra del producto con filtros
 *   por rango de fechas. Carga datos vía Server Action.
 */
export function HistorialCostos({ productoId, className }: HistorialCostosProps) {
  const [page, setPage] = useState(1)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [data, setData] = useState<HistorialCostosData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      const res = await getHistorialCostosAction({
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
            No hay registros de compra para este producto
          </div>
        )}

        {!isLoading && !error && data && data.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio unitario</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((it) => (
                <TableRow key={it.compraDocumentoItemId}>
                  <TableCell>{format(new Date(it.fecha), 'PP', { locale: es })}</TableCell>
                  <TableCell>{it.proveedor}</TableCell>
                  <TableCell>{it.numeroFactura || '—'}</TableCell>
                  <TableCell className="text-right">{it.cantidad}</TableCell>
                  <TableCell className="text-right">{it.precioUnitario}</TableCell>
                  <TableCell className="text-right">{it.totalLinea}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {data && data.pagination.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {data.pagination.page} de {totalPages} · {data.pagination.total} registros
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
