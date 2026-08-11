'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { CompraServicio } from '@/app/models/model'
import { getComprasServiciosAction } from '@/features/compras-servicios/actions'

function formatCurrency(value: number, currency?: string | null): string {
  if (!currency) return `${value.toLocaleString('es-AR')} (sin moneda)`

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * @description Tabla reutilizable para mostrar servicios recibidos.
 * @returns {JSX.Element} Tabla de servicios recibidos.
 */
export function ServiciosRecibidosTable(): React.JSX.Element {
  const [servicios, setServicios] = useState<CompraServicio[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getComprasServiciosAction().then(r => {
      if (r.success) setServicios((r.data ?? []) as CompraServicio[])
      setIsLoading(false)
    }).catch(() => {
      setError('Error al cargar los servicios recibidos')
      setIsLoading(false)
    })
  }, [])

  const columns = useMemo<ColumnDef<CompraServicio>[]>(
    () => [
      {
        accessorKey: 'servicio',
        header: 'Servicio',
        cell: ({ row }) => row.original.servicio?.nombre ?? 'Sin nombre',
      },
      {
        accessorKey: 'proveedor',
        header: 'Proveedor',
        cell: ({ row }) => row.original.proveedor?.nombre ?? 'Sin proveedor',
      },
      {
        accessorKey: 'cantidad',
        header: 'Cantidad',
      },
      {
        accessorKey: 'costoUnitario',
        header: 'Costo Unitario',
        cell: ({ row }) => formatCurrency(row.original.costoUnitario, row.original.moneda),
      },
      {
        accessorKey: 'total',
        header: 'Total',
        cell: ({ row }) => formatCurrency(row.original.total, row.original.moneda),
      },
      {
        accessorKey: 'moneda',
        header: 'Moneda',
        cell: ({ row }) => row.original.moneda ?? 'Sin snapshot',
      },
      {
        accessorKey: 'formaPago',
        header: 'Forma de Pago',
        cell: ({ row }) =>
          row.original.formaPago === 'PAGO_COMPLETO' ? 'Pago Completo' : 'Pago Parcial',
      },
      {
        accessorKey: 'estado',
        header: 'Estado',
        cell: ({ row }) => (
          <Badge variant={row.original.estado === 'PAGADA' ? 'default' : 'secondary'}>
            {row.original.estado === 'PAGADA' ? 'Pagada' : 'Pendiente'}
          </Badge>
        ),
      },
      {
        accessorKey: 'fechaServicio',
        header: 'Fecha Servicio',
        cell: ({ row }) => new Date(row.original.fechaServicio).toLocaleDateString('es-AR'),
      },
    ],
    []
  )

  if (isLoading) {
    return (
      <div className='space-y-3'>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className='h-12 w-full' />
        ))}
      </div>
    )
  }

  if (error) {
    return <div className='rounded-md border p-6 text-center text-red-600'>Error al cargar los servicios recibidos</div>
  }

  return <DataTable columns={columns} data={servicios} searchColumn='servicio' searchPlaceholder='Buscar servicio...' />
}
