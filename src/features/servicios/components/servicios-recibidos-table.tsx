'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'

import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { CompraServicio } from '@/app/models/model'
import { useGetComprasServiciosQuery } from '@/lib/redux/services/comprasServiciosApi'

/**
 * @description Tabla reutilizable para mostrar servicios recibidos.
 * @returns {JSX.Element} Tabla de servicios recibidos.
 */
export function ServiciosRecibidosTable(): JSX.Element {
  const { data: servicios = [], isLoading, error } = useGetComprasServiciosQuery()

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
        cell: ({ row }) => `$${row.original.costoUnitario.toLocaleString('es-AR')}`,
      },
      {
        accessorKey: 'total',
        header: 'Total',
        cell: ({ row }) => `$${row.original.total.toLocaleString('es-AR')}`,
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
      {
        id: 'acciones',
        header: 'Acciones',
        cell: ({ row }) => (
          <Button variant='ghost' size='sm' disabled>
            <Trash2 className='h-4 w-4 text-red-600' />
          </Button>
        ),
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
