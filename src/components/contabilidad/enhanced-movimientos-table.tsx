'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EnhancedDataTable } from './enhanced-data-table'
import { ExportDialog } from './export-dialog'
import { FilterConfig, FilterOptions } from '@/hooks/use-table-filters'
import { useCuentasBancariasCache, useMonedasCache } from '@/hooks/use-cache'
import { TrendingUp, TrendingDown, ArrowRightLeft, Download } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Movimiento {
  id: string
  fecha: Date
  tipo: 'venta' | 'servicio' | 'gasto' | 'ajuste' | 'transferencia'
  descripcion: string
  monto: number
  moneda: string
  cuenta: string
  nombreCuenta: string
  saldo: number
  usuario: string
  montoOriginal?: number
  monedaOriginal?: string
  tasaCambio?: number
  observaciones?: string
}

interface EnhancedMovimientosTableProps {
  movimientos: Movimiento[]
  loading?: boolean
  onExport?: (tipo: 'csv' | 'pdf') => void
  onRefresh?: () => void
}

export function EnhancedMovimientosTable({
  movimientos,
  loading = false,
  onExport,
  onRefresh
}: EnhancedMovimientosTableProps) {
  const { data: cuentas } = useCuentasBancariasCache()
  const { data: monedas } = useMonedasCache()

  // Filter options for the table
  const filterOptions: FilterOptions = useMemo(() => ({
    currencies: monedas?.map((m: any) => ({ value: m.codigo, label: `${m.codigo} - ${m.nombre}` })) || [
      { value: 'CUP', label: 'CUP - Peso Cubano' },
      { value: 'USD', label: 'USD - Dólar Americano' },
      { value: 'EUR', label: 'EUR - Euro' }
    ],
    accounts: cuentas?.map((c: any) => ({
      value: c.cuentaId,
      label: `${c.nombreBanco} - ${c.numeroCuenta}`
    })) || [],
    paymentTypes: [],
    statuses: [
      { value: 'venta', label: 'Ventas' },
      { value: 'servicio', label: 'Servicios' },
      { value: 'gasto', label: 'Gastos' },
      { value: 'ajuste', label: 'Ajustes' },
      { value: 'transferencia', label: 'Transferencias' }
    ]
  }), [cuentas, monedas])

  // Filter function
  const filterFn = (movimiento: Movimiento, filters: FilterConfig) => {
    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      const searchableText = [
        movimiento.descripcion,
        movimiento.nombreCuenta,
        movimiento.usuario,
        movimiento.observaciones || ''
      ].join(' ').toLowerCase()

      if (!searchableText.includes(searchTerm)) {
        return false
      }
    }

    // Date range filter
    if (filters.dateRange.from && movimiento.fecha < filters.dateRange.from) {
      return false
    }
    if (filters.dateRange.to && movimiento.fecha > filters.dateRange.to) {
      return false
    }

    // Currency filter
    if (filters.currency && movimiento.moneda !== filters.currency) {
      return false
    }

    // Account filter
    if (filters.account && movimiento.cuenta !== filters.account) {
      return false
    }

    // Status (tipo) filter
    if (filters.status && movimiento.tipo !== filters.status) {
      return false
    }

    return true
  }

  // Table columns
  const columns = [
    {
      key: 'fecha',
      header: 'Fecha',
      cell: (movimiento: Movimiento) => (
        <div className="text-sm">
          {format(movimiento.fecha, 'dd/MM/yyyy')}
          <div className="text-xs text-muted-foreground">
            {format(movimiento.fecha, 'HH:mm')}
          </div>
        </div>
      )
    },
    {
      key: 'cuenta',
      header: 'Cuenta',
      cell: (movimiento: Movimiento) => (
        <div>
          <p className="font-medium text-sm">{movimiento.nombreCuenta}</p>
          <p className="text-xs text-muted-foreground">
            {movimiento.cuenta}
          </p>
        </div>
      )
    },
    {
      key: 'tipo',
      header: 'Tipo',
      cell: (movimiento: Movimiento) => {
        const getTypeConfig = (tipo: string) => {
          switch (tipo) {
            case 'venta':
            case 'servicio':
              return {
                color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                icon: <TrendingUp className="h-3 w-3" />,
                label: tipo === 'venta' ? 'Venta' : 'Servicio'
              }
            case 'gasto':
              return {
                color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                icon: <TrendingDown className="h-3 w-3" />,
                label: 'Gasto'
              }
            case 'transferencia':
              return {
                color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                icon: <ArrowRightLeft className="h-3 w-3" />,
                label: 'Transferencia'
              }
            case 'ajuste':
              return {
                color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
                icon: <ArrowRightLeft className="h-3 w-3" />,
                label: 'Ajuste'
              }
            default:
              return {
                color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
                icon: <ArrowRightLeft className="h-3 w-3" />,
                label: tipo
              }
          }
        }

        const config = getTypeConfig(movimiento.tipo)
        return (
          <Badge className={config.color}>
            <span className="flex items-center gap-1">
              {config.icon}
              {config.label}
            </span>
          </Badge>
        )
      }
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      cell: (movimiento: Movimiento) => (
        <div>
          <p className="font-medium text-sm">{movimiento.descripcion}</p>
          {movimiento.observaciones && (
            <p className="text-xs text-muted-foreground mt-1">
              {movimiento.observaciones}
            </p>
          )}
        </div>
      )
    },
    {
      key: 'moneda',
      header: 'Moneda',
      cell: (movimiento: Movimiento) => (
        <div className="space-y-1">
          <Badge variant="outline" className="text-xs">
            {movimiento.monedaOriginal || movimiento.moneda}
          </Badge>
          {movimiento.tasaCambio && movimiento.monedaOriginal !== 'CUP' && (
            <div className="text-xs text-muted-foreground">
              Tasa: {movimiento.tasaCambio.toFixed(4)}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'monto',
      header: 'Monto',
      cell: (movimiento: Movimiento) => {
        const isPositive = ['venta', 'servicio'].includes(movimiento.tipo) ||
          (movimiento.tipo === 'ajuste' && movimiento.monto > 0) ||
          (movimiento.tipo === 'transferencia' && movimiento.monto > 0)

        return (
          <div className="text-right">
            {movimiento.montoOriginal && movimiento.monedaOriginal && movimiento.monedaOriginal !== 'CUP' && (
              <div className="text-xs text-muted-foreground">
                {movimiento.montoOriginal.toLocaleString()} {movimiento.monedaOriginal}
              </div>
            )}
            <div className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{movimiento.monto.toLocaleString()} CUP
            </div>
          </div>
        )
      }
    },
    {
      key: 'saldo',
      header: 'Saldo',
      cell: (movimiento: Movimiento) => (
        <div className="text-right font-medium">
          {movimiento.saldo.toLocaleString()} CUP
        </div>
      )
    },
    {
      key: 'usuario',
      header: 'Usuario',
      cell: (movimiento: Movimiento) => (
        <div className="text-sm text-muted-foreground">
          {movimiento.usuario}
        </div>
      )
    }
  ]

  return (
    <EnhancedDataTable
      data={movimientos}
      columns={columns}
      title="Movimientos Bancarios"
      description="Historial completo de transacciones y movimientos"
      filterOptions={filterOptions}
      filterFn={filterFn}
      onRefresh={onRefresh}
      loading={loading}
      emptyMessage="No se encontraron movimientos"
      actions={
        onExport && (
          <ExportDialog
            tipoReporte="movimientos"
            onExport={async (config) => {
              // Adapter function to bridge the interface gap
              onExport(config.formato)
            }}
          />
        )
      }
    />
  )
}