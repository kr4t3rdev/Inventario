'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, ShoppingCart, Sparkles, Loader2, Eye, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { motion } from 'framer-motion'

import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetComprasProductosQuery, useDeleteCompraProductoMutation } from '@/lib/redux/services/comprasProductosApi'
import type { CompraProducto } from '@/app/models/model'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

/**
 * @description Página de listado de compras de productos.
 * @returns {JSX.Element} Vista con tabla de compras
 */
export default function ComprasProductosPage() {
  const { data, isLoading } = useGetComprasProductosQuery()
  const compras = data?.compras || []
  const [deleteCompra] = useDeleteCompraProductoMutation()
  
  // Estados para los diálogos
  const [selectedCompra, setSelectedCompra] = useState<CompraProducto | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleView = (compra: CompraProducto) => {
    setSelectedCompra(compra)
    setIsViewDialogOpen(true)
  }

  const handleDelete = (compra: CompraProducto) => {
    setSelectedCompra(compra)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedCompra) return
    
    try {
      await deleteCompra(selectedCompra.compraProductoId).unwrap()
      toast.success('Compra eliminada exitosamente')
      setIsDeleteDialogOpen(false)
      setSelectedCompra(null)
    } catch (error) {
      toast.error('Error al eliminar la compra')
    }
  }

  const columns = useMemo<ColumnDef<CompraProducto>[]>(() => ([
    {
      accessorKey: 'fechaCompra',
      header: 'Fecha',
      cell: ({ row }) => {
        const fecha = row.getValue('fechaCompra') as string
        return <span>{new Date(fecha).toLocaleDateString()}</span>
      }
    },
    {
      accessorKey: 'producto',
      header: 'Producto',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.producto?.nombre || 'N/A'}</span>
      )
    },
    {
      accessorKey: 'proveedor',
      header: 'Proveedor',
      cell: ({ row }) => row.original.proveedor?.nombre || 'N/A'
    },
    {
      accessorKey: 'numeroFactura',
      header: 'Factura',
      cell: ({ row }) => row.original.numeroFactura || 'S/N'
    },
    {
      accessorKey: 'tipoOperacion',
      header: 'Tipo',
      cell: ({ row }) => (
        <Badge variant={row.original.tipoOperacion === 'RESTOCK' ? 'default' : 'secondary'}>
          {row.original.tipoOperacion === 'RESTOCK' ? 'Restock' : 'Regular'}
        </Badge>
      )
    },
    {
      accessorKey: 'formaPago',
      header: 'Pago',
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.formaPago === 'PAGO_COMPLETO' ? 'Completo' : 'Parcial'}
        </Badge>
      )
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.estado === 'PAGADA' ? 'default' : 'secondary'}>
          {row.original.estado === 'PAGADA' ? 'Pagada' : 'Pendiente'}
        </Badge>
      )
    },
    {
      accessorKey: 'cantidad',
      header: 'Cantidad',
      cell: ({ row }) => <span className="text-right block">{row.original.cantidad}</span>
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => <span className="text-right block">{row.original.total}</span>
    },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleView(row.original)}
            title="Ver detalles"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Link href={`/busy/compras-productos/${row.original.compraProductoId}/edit`}>
            <Button
              variant="ghost"
              size="icon"
              title="Editar compra"
            >
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
      )
    },
  ]), [])

  if (isLoading) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <motion.div 
              className="flex justify-between items-center mb-6"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-8 w-48" />
              </div>
              <Skeleton className="h-10 w-32" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center justify-center py-12 mb-6">
                <motion.div
                  className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Skeleton className="h-12 w-full" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          <motion.div 
            className="flex justify-between items-center mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <motion.div 
                className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <ShoppingCart className="h-5 w-5 text-white" />
              </motion.div>
              <div className="relative">
                <h1 className="text-2xl font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Compras de Productos
                </h1>
                <motion.div
                  className="absolute -right-4 -top-1"
                  animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                  transition={{ 
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  }}
                >
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                </motion.div>
              </div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button 
                asChild 
                className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              >
                <Link href="/busy/compras-productos/new">
                  <Plus className="mr-2 h-4 w-4" /> Nueva compra
                </Link>
              </Button>
            </motion.div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="border rounded-lg border-dashed dark:border-gray-700"
          >
            <DataTable
              columns={columns}
              data={compras}
              searchColumn="numeroFactura"
              searchPlaceholder="Buscar por factura..."
            />
          </motion.div>
        </div>

        {/* Diálogo para ver detalles */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                    <label className="text-sm font-medium text-muted-foreground">Producto</label>
                    <p className="font-medium">{selectedCompra.producto?.nombre || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Proveedor</label>
                    <p>{selectedCompra.proveedor?.nombre || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Fecha</label>
                    <p>{new Date(selectedCompra.fechaCompra).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Número de Factura</label>
                    <p>{selectedCompra.numeroFactura || 'S/N'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                    <Badge variant={selectedCompra.tipoOperacion === 'RESTOCK' ? 'default' : 'secondary'}>
                      {selectedCompra.tipoOperacion === 'RESTOCK' ? 'Restock' : 'Regular'}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Estado</label>
                    <Badge variant={selectedCompra.estado === 'PAGADA' ? 'default' : 'secondary'}>
                      {selectedCompra.estado === 'PAGADA' ? 'Pagada' : 'Pendiente'}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Cantidad</label>
                    <p>{selectedCompra.cantidad}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Precio Unitario</label>
                    <p>${selectedCompra.precioUnitario}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Total</label>
                    <p className="font-bold text-lg">${selectedCompra.total}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Forma de Pago</label>
                    <p>{selectedCompra.formaPago === 'PAGO_COMPLETO' ? 'Completo' : 'Parcial'}</p>
                  </div>
                </div>
                {selectedCompra.descripcion && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Descripción</label>
                    <p className="text-sm mt-1">{selectedCompra.descripcion}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsViewDialogOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo para confirmar eliminación */}
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
                  <span className="font-medium">Producto:</span> {selectedCompra.producto?.nombre || 'N/A'}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Factura:</span> {selectedCompra.numeroFactura || 'S/N'}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Total:</span> ${selectedCompra.total}
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
      </SidebarInset>
    </SidebarProvider>
  )
}
