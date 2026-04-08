'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * @description Interfaz del registro de historial de costo
 */
interface CostHistoryRecord {
  id: string
  productoId: string
  oldPrecioCosto: number
  newPrecioCosto: number
  oldPrecioVenta: number
  newPrecioVenta: number
  reason: string
  changedBy: string
  changedAt: string
  notes: string | null
}

/**
 * @description Props para CostHistoryTable component
 */
interface CostHistoryTableProps {
  /**
   * ID del producto para cargar historial
   */
  productoId: string
  /**
   * Clase CSS adicional
   */
  className?: string
}

/**
 * @description Mapa de razones de cambio a labels amigables
 */
const REASON_LABELS: Record<string, string> = {
  INITIAL: 'Inicial',
  RESTOCK: 'Restock',
  ADJUSTMENT: 'Ajuste',
  CORRECTION: 'Corrección',
  IMPORT: 'Importación',
  MANUAL_EDIT: 'Edición Manual',
}

/**
 * @description Mapa de razones a colores de badge
 */
const REASON_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  INITIAL: 'default',
  RESTOCK: 'secondary',
  ADJUSTMENT: 'outline',
  CORRECTION: 'destructive',
  IMPORT: 'secondary',
  MANUAL_EDIT: 'outline',
}

/**
 * @description Tabla con historial de cambios de costos del producto
 * Muestra paginación, filtrado por fecha y razón de cambio
 *
 * @param {CostHistoryTableProps} props - Props del componente
 * @returns {JSX.Element} Tabla con historial de costos
 */
export function CostHistoryTable({
  productoId,
  className = '',
}: CostHistoryTableProps): JSX.Element {
  const [history, setHistory] = useState<CostHistoryRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Filtros
  const [selectedReason, setSelectedReason] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  /**
   * @description Carga el historial de costos
   */
  const loadHistory = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })

      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (selectedReason !== 'all') params.append('reason', selectedReason)

      const response = await fetch(
        `/api/productos/${productoId}/cost-history?${params.toString()}`
      )

      if (!response.ok) {
        setError('No se pudo cargar el historial de costos')
        setHistory([])
        setIsLoading(false)
        return
      }

      const data = await response.json()
      setHistory(data.history || [])
      setTotal(data.total || 0)
      setTotalPages(data.pages || 1)
    } catch (err) {
      console.error('Error loading cost history:', err)
      setError('Error de conexión')
      setHistory([])
    } finally {
      setIsLoading(false)
    }
  }, [productoId, page, limit, startDate, endDate, selectedReason])

  /**
   * @description Recarga cuando cambian los filtros o paginación
   */
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  /**
   * @description Calcula porcentaje de cambio
   */
  const calculateChange = (oldValue: number, newValue: number): string => {
    if (oldValue === 0) {
      return newValue > 0 ? '+∞' : '—'
    }
    const change = ((newValue - oldValue) / oldValue) * 100
    return change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`
  }

  /**
   * @description Limpia los filtros
   */
  const clearFilters = () => {
    setSelectedReason('all')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filtros */}
      <div className='space-y-3'>
        <div className='flex items-center gap-2'>
          <Filter className='h-4 w-4 text-gray-500' />
          <span className='text-sm font-medium'>Filtros</span>
        </div>

        <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
          <Select value={selectedReason} onValueChange={setSelectedReason}>
            <SelectTrigger>
              <SelectValue placeholder='Todas las razones' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todas las razones</SelectItem>
              {Object.entries(REASON_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type='date'
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setPage(1)
            }}
            placeholder='Desde'
            className='text-sm'
          />

          <Input
            type='date'
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              setPage(1)
            }}
            placeholder='Hasta'
            className='text-sm'
          />

          {(selectedReason !== 'all' || startDate || endDate) && (
            <Button
              onClick={clearFilters}
              variant='outline'
              size='sm'
              className='gap-2'
            >
              <X className='h-4 w-4' />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className='rounded-lg border overflow-x-auto'>
        {isLoading && (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-6 w-6 animate-spin text-gray-400' />
          </div>
        )}

        {error && (
          <div className='p-4 text-sm text-red-700 bg-red-50'>
            {error}
          </div>
        )}

        {!isLoading && !error && history.length === 0 && (
          <div className='p-8 text-center text-gray-500'>
            <p>No hay registros de cambios de costo</p>
          </div>
        )}

        {!isLoading && !error && history.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Razón</TableHead>
                <TableHead className='text-right'>Costo Anterior</TableHead>
                <TableHead className='text-right'>Costo Nuevo</TableHead>
                <TableHead className='text-right'>Cambio</TableHead>
                <TableHead className='text-right'>Precio Anterior</TableHead>
                <TableHead className='text-right'>Precio Nuevo</TableHead>
                <TableHead className='text-right'>Cambio</TableHead>
                <TableHead>Cambió por</TableHead>
                <TableHead className='w-32'>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((record) => (
                <TableRow key={record.id} className='hover:bg-gray-50'>
                  <TableCell className='text-sm'>
                    {format(new Date(record.changedAt), 'dd MMM yyyy HH:mm', {
                      locale: es,
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={REASON_VARIANTS[record.reason] || 'outline'}>
                      {REASON_LABELS[record.reason] || record.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-right text-sm'>
                    ${record.oldPrecioCosto.toFixed(2)}
                  </TableCell>
                  <TableCell className='text-right text-sm font-semibold'>
                    ${record.newPrecioCosto.toFixed(2)}
                  </TableCell>
                  <TableCell className='text-right text-sm'>
                    <span
                      className={
                        record.newPrecioCosto > record.oldPrecioCosto
                          ? 'text-red-600'
                          : 'text-green-600'
                      }
                    >
                      {calculateChange(record.oldPrecioCosto, record.newPrecioCosto)}
                    </span>
                  </TableCell>
                  <TableCell className='text-right text-sm'>
                    ${record.oldPrecioVenta.toFixed(2)}
                  </TableCell>
                  <TableCell className='text-right text-sm font-semibold'>
                    ${record.newPrecioVenta.toFixed(2)}
                  </TableCell>
                  <TableCell className='text-right text-sm'>
                    <span
                      className={
                        record.newPrecioVenta > record.oldPrecioVenta
                          ? 'text-red-600'
                          : 'text-green-600'
                      }
                    >
                      {calculateChange(record.oldPrecioVenta, record.newPrecioVenta)}
                    </span>
                  </TableCell>
                  <TableCell className='text-sm'>
                    <code className='text-xs bg-gray-100 px-2 py-1 rounded'>
                      {record.changedBy}
                    </code>
                  </TableCell>
                  <TableCell className='text-xs text-gray-600 max-w-32 truncate'>
                    {record.notes || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Paginación */}
      {!isLoading && !error && history.length > 0 && (
        <div className='flex items-center justify-between py-4'>
          <div className='text-sm text-gray-600'>
            Mostrando {(page - 1) * limit + 1} a {Math.min(page * limit, total)} de{' '}
            {total} registros
          </div>

          <div className='flex items-center gap-2'>
            <Select value={limit.toString()} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className='w-24'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='10'>10</SelectItem>
                <SelectItem value='20'>20</SelectItem>
                <SelectItem value='50'>50</SelectItem>
                <SelectItem value='100'>100</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              variant='outline'
              size='sm'
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>

            <div className='flex gap-1'>
              {pages.slice(Math.max(0, page - 3), Math.min(pages.length, page + 2)).map((p) => (
                <Button
                  key={p}
                  onClick={() => setPage(p)}
                  variant={p === page ? 'default' : 'outline'}
                  size='sm'
                  className='w-8'
                >
                  {p}
                </Button>
              ))}
            </div>

            <Button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
              variant='outline'
              size='sm'
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
