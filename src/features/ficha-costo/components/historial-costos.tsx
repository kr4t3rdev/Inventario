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
  CheckCircle2,
  AlertTriangle,
  Info,
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
import { getHistorialReconciliadoAction } from '../actions-reconciliacion'
import type {
  HistorialReconciliadoData,
  EstadoCPP,
} from '../types'

interface HistorialCostosProps {
  productoId: string
  className?: string
}

const LIMIT = 20

function bannerEstadoCPP(estado: EstadoCPP) {
  if (estado === 'CALCULADO') {
    return {
      icono: <CheckCircle2 className="h-4 w-4" />,
      clase: 'border-green-200 bg-green-50 text-green-800',
      texto: 'CPP calculado',
    }
  }
  if (estado === 'CON_ADVERTENCIAS') {
    return {
      icono: <AlertTriangle className="h-4 w-4" />,
      clase: 'border-yellow-200 bg-yellow-50 text-yellow-800',
      texto: 'CPP calculado con advertencias',
    }
  }
  return {
    icono: <Info className="h-4 w-4" />,
    clase: 'border-gray-200 bg-gray-50 text-gray-800',
    texto: 'Sin datos en la ventana CPP',
  }
}

/**
 * @description Tabla paginada de líneas de compra del producto con
 *   reconciliación contra el cálculo del CPP: cada fila muestra si está
 *   en la ventana de 12 meses y el gasto proporcional asignado. Incluye
 *   además un resumen por proveedor (calculado sobre el set completo
 *   en ventana) y un banner con el estado del CPP.
 */
export function HistorialCostos({ productoId, className }: HistorialCostosProps) {
  const [page, setPage] = useState(1)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [data, setData] = useState<HistorialReconciliadoData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      const res = await getHistorialReconciliadoAction({
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
  const mostrarGasto = data?.items.some((it) => it.gastoProporcional > 0) ?? false

  function clearFilters() {
    startTransition(() => {
      setFechaDesde('')
      setFechaHasta('')
      setPage(1)
    })
  }

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {/* Banner de estado CPP */}
      {data && (
        <div
          role={data.estadoCPP === 'SIN_DATOS' ? 'alert' : 'status'}
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            bannerEstadoCPP(data.estadoCPP).clase
          }`}
        >
          {bannerEstadoCPP(data.estadoCPP).icono}
          <div className="flex-1">
            <div className="font-medium">
              {bannerEstadoCPP(data.estadoCPP).texto}
            </div>
            {data.advertencias.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-xs">
                {data.advertencias.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
          </div>
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

      {/* Tabla de items */}
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
                {mostrarGasto && (
                  <TableHead className="text-right">Gasto prop.</TableHead>
                )}
                <TableHead>En CPP</TableHead>
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
                  {mostrarGasto && (
                    <TableCell className="text-right">
                      {it.gastoProporcional > 0
                        ? it.gastoProporcional.toFixed(2)
                        : '—'}
                    </TableCell>
                  )}
                  <TableCell>
                    {it.enVentanaCPP ? (
                      <Badge variant="default" className="bg-green-600">
                        En CPP
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-500">
                        Fuera de ventana
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Paginación */}
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

      {/* Resumen por proveedor */}
      {data && data.proveedores.length > 0 && (
        <div className="space-y-2 pt-4">
          <div>
            <h3 className="text-sm font-medium">Resumen por proveedor</h3>
            <p className="text-muted-foreground text-xs">
              Calculado sobre todas las compras en la ventana CPP (no solo la
              página actual).
            </p>
          </div>
          <div className="rounded-lg border">
            <Table aria-label="Resumen de compras por proveedor">
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Cantidad total</TableHead>
                  <TableHead className="text-right">Monto total</TableHead>
                  <TableHead className="text-right">Participación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.proveedores.map((p) => (
                  <TableRow key={p.proveedorId}>
                    <TableCell>{p.proveedorNombre}</TableCell>
                    <TableCell className="text-right">{p.cantidadItems}</TableCell>
                    <TableCell className="text-right">{p.cantidadTotal}</TableCell>
                    <TableCell className="text-right">
                      {p.montoTotal.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.participacionPorcentaje.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
