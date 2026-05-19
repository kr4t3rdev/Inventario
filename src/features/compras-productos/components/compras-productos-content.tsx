'use client'

import { useMemo, useState, useTransition, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Plus, ShoppingCart, Sparkles, Eye, Pencil, Trash2, Package, Loader2, Search } from 'lucide-react'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { LazyMotion, m as motion } from 'framer-motion'

import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getComprasProductosAction, deleteCompraProductoAction } from '@/features/compras-productos/actions'
import type { CompraDocumento } from '@/app/models/model'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface ComprasProductosContentProps {
  initialCompras: CompraDocumento[]
  initialPagination: { page: number; limit: number; total: number; totalPages: number } | null
}

export function ComprasProductosContent({ initialCompras, initialPagination }: ComprasProductosContentProps) {
  const [compras, setCompras] = useState<any[]>(initialCompras)
  const [totalPages, setTotalPages] = useState(initialPagination?.totalPages ?? 1)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [selectedCompra, setSelectedCompra] = useState<any>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback((page: number, limit: number, searchTerm: string) => {
    startTransition(async () => {
      const r = await getComprasProductosAction({ page, limit, search: searchTerm || undefined })
      if (r.success && r.data) {
        setCompras(r.data.compras ?? [])
        setTotalPages(r.data.pagination?.totalPages ?? 1)
      }
    })
  }, [])

  const handleSearch = (value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPagination(prev => ({ ...prev, pageIndex: 0 }))
      fetchData(1, pagination.pageSize, value)
    }, 400)
  }

  const handlePaginationChange = (updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    setPagination(next)
    fetchData(next.pageIndex + 1, next.pageSize, search)
  }

  const handleView = (compra: any) => {
    setSelectedCompra(compra)
    setIsViewDialogOpen(true)
  }

  const handleDelete = (compra: any) => {
    setSelectedCompra(compra)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedCompra) return
    startTransition(async () => {
      const r = await deleteCompraProductoAction(selectedCompra.compraDocumentoId)
      if (r.success) {
        toast.success('Compra eliminada exitosamente')
        const ref = await getComprasProductosAction({ page: pagination.pageIndex + 1, limit: pagination.pageSize, search: search || undefined })
        if (ref.success) {
          setCompras(ref.data?.compras ?? [])
          setTotalPages(ref.data?.pagination?.totalPages ?? 1)
        }
      } else {
        toast.error(r.error?.message || 'Error al eliminar la compra')
      }
      setIsDeleteDialogOpen(false)
      setSelectedCompra(null)
    })
  }

  const columns = useMemo<ColumnDef<CompraDocumento>[]>(() => ([
    {
      accessorKey: 'fechaCompra',
      header: 'Fecha',
      cell: ({ row }) => (
        <span>{new Date(row.getValue('fechaCompra') as string).toLocaleDateString()}</span>
      ),
    },
    {
      accessorKey: 'proveedor',
      header: 'Proveedor',
      cell: ({ row }) => row.original.proveedor?.nombre || 'N/A',
    },
    {
      accessorKey: 'numeroFactura',
      header: 'Factura',
      cell: ({ row }) => row.original.numeroFactura || 'S/N',
    },
    {
      id: 'productos',
      header: 'Productos',
      cell: ({ row }) => {
        const items = row.original.items || []
        const count = items.length
        if (count === 0) return <span className="text-muted-foreground">Sin items</span>
        if (count === 1) {
          return <span className="font-medium">{items[0].producto?.nombre || 'N/A'}</span>
        }
        return (
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{items[0].producto?.nombre || 'N/A'}</span>
            <span className="text-muted-foreground text-xs">+{count - 1} más</span>
          </div>
        )
      },
    },
    {
      id: 'cantidadTotal',
      header: 'Cant.',
      cell: ({ row }) => {
        const items = row.original.items || []
        const total = items.reduce((sum, item) => sum + item.cantidad, 0)
        return <span className="text-right block">{total}</span>
      },
    },
    {
      accessorKey: 'tipoOperacion',
      header: 'Tipo',
      cell: ({ row }) => (
        <Badge variant={row.original.tipoOperacion === 'RESTOCK' ? 'default' : 'secondary'}>
          {row.original.tipoOperacion === 'RESTOCK' ? 'Restock' : 'Regular'}
        </Badge>
      ),
    },
    {
      accessorKey: 'formaPago',
      header: 'Pago',
      cell: ({ row }) => {
        const fp = row.original.formaPago
        const label = fp === 'PAGO_COMPLETO' ? 'Completo' : fp === 'PAGO_PARCIAL' ? 'Parcial' : 'Anticipo'
        return <Badge variant="outline">{label}</Badge>
      },
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
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => <span className="text-right block font-medium">${row.original.total.toLocaleString()}</span>,
    },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleView(row.original)} title="Ver detalles">
            <Eye className="h-4 w-4" />
          </Button>
          <Link href={`/busy/compras-productos/${row.original.compraDocumentoId}/edit`}>
            <Button variant="ghost" size="icon" title="Editar compra">
              <Pencil className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row.original)}
            title="Eliminar compra"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]), [])

  return (
    <div className="container mx-auto py-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
            <ShoppingCart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
              Compras de Productos
            </h1>
          </div>
          {isPending && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </div>
        <Button
          asChild
          className="bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90"
        >
          <Link href="/busy/compras-productos/new">
            <Plus className="mr-2 h-4 w-4" /> Nueva compra
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por factura, proveedor o producto..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="border rounded-lg border-dashed dark:border-gray-700"
      >
        <DataTable
          columns={columns}
          data={compras}
          pageCount={totalPages}
          pagination={pagination}
          onPaginationChange={handlePaginationChange}
        />
      </motion.div>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de la Compra</DialogTitle>
            <DialogDescription>
              Información completa de la compra seleccionada
            </DialogDescription>
          </DialogHeader>
          {selectedCompra && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Proveedor</span>
                  <p className="font-medium">{selectedCompra.proveedor?.nombre || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Fecha</span>
                  <p>{new Date(selectedCompra.fechaCompra).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Número de Factura</span>
                  <p>{selectedCompra.numeroFactura || 'S/N'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Tipo</span>
                  <Badge variant={selectedCompra.tipoOperacion === 'RESTOCK' ? 'default' : 'secondary'}>
                    {selectedCompra.tipoOperacion === 'RESTOCK' ? 'Restock' : 'Regular'}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Estado</span>
                  <Badge variant={selectedCompra.estado === 'PAGADA' ? 'default' : 'secondary'}>
                    {selectedCompra.estado === 'PAGADA' ? 'Pagada' : 'Pendiente'}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Forma de Pago</span>
                  <p>{selectedCompra.formaPago === 'PAGO_COMPLETO' ? 'Completo' : selectedCompra.formaPago === 'PAGO_PARCIAL' ? 'Parcial' : 'Anticipo'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Total</span>
                  <p className="font-bold text-lg">${selectedCompra.total.toLocaleString()}</p>
                </div>
              </div>

              {selectedCompra.descripcion && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Descripción</span>
                  <p className="text-sm mt-1">{selectedCompra.descripcion}</p>
                </div>
              )}

              {selectedCompra.items && selectedCompra.items.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Productos ({selectedCompra.items.length})
                  </label>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Producto</th>
                          <th className="text-right p-2 font-medium">Cant.</th>
                          <th className="text-right p-2 font-medium">Costo Unit.</th>
                          <th className="text-right p-2 font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCompra.items.map((item: any) => (
                          <tr key={item.compraDocumentoItemId} className="border-t">
                            <td className="p-2 font-medium">{item.producto?.nombre || 'N/A'}</td>
                            <td className="p-2 text-right">{item.cantidad}</td>
                            <td className="p-2 text-right">${item.precioUnitario.toLocaleString()}</td>
                            <td className="p-2 text-right font-medium">${item.totalLinea.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar esta compra? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {selectedCompra && (
            <div className="py-4">
              <p className="text-sm">
                <span className="font-medium">Proveedor:</span> {selectedCompra.proveedor?.nombre || 'N/A'}
              </p>
              <p className="text-sm">
                <span className="font-medium">Factura:</span> {selectedCompra.numeroFactura || 'S/N'}
              </p>
              <p className="text-sm">
                <span className="font-medium">Productos:</span> {selectedCompra.items?.length || 0}
              </p>
              <p className="text-sm">
                <span className="font-medium">Total:</span> ${selectedCompra.total.toLocaleString()}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
