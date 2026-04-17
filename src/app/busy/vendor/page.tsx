'use client'

import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { ColumnDef } from "@tanstack/react-table"
import { 
  ArrowUp, 
  ArrowUpDown, 
  Eye, 
  Pencil, 
  Plus, 
  Trash2,
  Building2,
  Sparkles,
  AlertCircle,
  FileText
} from "lucide-react"
import { useDeleteVendorMutation, useGetVendorsQuery } from "@/lib/redux/services/vendorsApi"
import Link from "next/link"
import { toast } from "sonner"
import { useState } from "react"
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { motion, AnimatePresence } from "framer-motion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

// Loading spinner component
function LoadingSpinner({ size = 32 }: { size?: number }) {
  return (
    <motion.div
      className="border-4 border-primary border-t-transparent rounded-full"
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  )
}

// Pulse skeleton
function PulseSkeleton({ className }: { className?: string }) {
  return (
    <motion.div
      className={`bg-muted rounded ${className}`}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  )
}

const Vendor = () => {

  const {data:vendors, isLoading, error} = useGetVendorsQuery()
  const [ vendorToDelete, setVendorToDelete ] = useState<string | null>(null)
  const [ vendorToView, setVendorToView ] = useState<any>(null)
  const [ deleteVendor ] = useDeleteVendorMutation()

  const handleDelete = async () => {
    if (!vendorToDelete) return
    try {          
      await deleteVendor(vendorToDelete).unwrap()
      toast('El proveedor ha sido eliminado exitosamente.')
    } catch (error) {
      toast('Hubo un error al eliminar el proveedor.')
    } finally {
      setVendorToDelete(null)
    }
  }

  const columns: ColumnDef<unknown>[] = [
    {
      accessorKey: 'logo',
      header: 'Logo',
      cell: ({ row }) => {
        const vendor = row.original as { logo?: string | null; nombre: string }
        return (
          <div className="flex items-center justify-center w-12 h-12">
            {vendor.logo ? (
              <motion.img
                src={vendor.logo}
                alt={`Logo de ${vendor.nombre}`}
                className="w-10 h-10 object-contain rounded"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                whileHover={{ scale: 1.1 }}
              />
            ) : (
              <motion.div 
                className="w-10 h-10 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground"
                whileHover={{ scale: 1.05 }}
              >
                <Building2 className="h-5 w-5" />
              </motion.div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'nombre',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Nombre
          <ArrowUp className='ml-2 h-4 w-4'/>
        </Button>
      ),
      cell: ({ row }) => {
        const nombre = row.getValue('nombre') as string
        return (
          <motion.div 
            className="flex items-center gap-2 font-medium"
            whileHover={{ x: 2 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
            >
              <Building2 className="h-4 w-4 text-primary" />
            </motion.div>
            {nombre}
          </motion.div>
        )
      }
    },
    {
      accessorKey: 'contratos',
      header: 'Contrato',
      cell: ({ row }) => {
        const vendor = row.original as { contratos?: { numeroContrato: string }[] }
        const contratos = vendor.contratos || []
        if (contratos.length === 0) {
          return <span className="text-muted-foreground text-sm">Sin contrato</span>
        }
        return (
          <div className="flex flex-col gap-1">
            {contratos.map((contrato, index) => (
              <motion.span 
                key={index} 
                className="text-sm font-medium"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {contrato.numeroContrato}
                </Badge>
              </motion.span>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey:'createdAt',
      header: ({column}) => (
        <Button variant='ghost' onClick={ () => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Fecha de creación
          <ArrowUpDown className='ml-2 h-4 w-4'/>
        </Button>
      ),
      cell: ({row}) => {
        const date = new Date(row.getValue('createdAt'))
        return (
          <div className="text-muted-foreground">
            {date.toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </div>
        )
      },
    },
    {
      header: 'Acciones',
      id:'actions',
      cell:({ row }) => {
        const vendor = row.original as any
        return (
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Button 
                variant='outline' 
                className='h-8 w-8 p-0 cursor-pointer' 
                onClick={() => setVendorToView(vendor)}
              >
                <Eye className='h-4 w-4'/>
              </Button>
            </motion.div>
            <Link href={`/busy/vendor/update/${vendor.vendorId}`}>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Button variant='outline' className='h-8 w-8 p-0 cursor-pointer'>
                  <Pencil className='h-4 w-4'/>
                </Button>
              </motion.div>
            </Link>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Button 
                variant='outline' 
                className='h-8 w-8 p-0 cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive' 
                onClick={() => {
                  setVendorToDelete(vendor.vendorId)
                }}
              >
                <Trash2 className='h-4 w-4'/>
              </Button>
            </motion.div>
          </div>
        )
      }
    }
  ]

  if (isLoading) {
    return (
      <SidebarProvider>           
        <SidebarInset>              
          <div className="container mx-auto py-4">
            <motion.div 
              className="flex justify-between items-center mb-4"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2">
                <PulseSkeleton className="h-10 w-10 rounded-xl" />
                <PulseSkeleton className="h-8 w-48" />
              </div>
              <PulseSkeleton className="h-10 w-32" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="h-[500px] w-full flex items-center justify-center bg-muted/30 dark:bg-muted/10 rounded-lg border-2 border-dashed">
                <div className="flex flex-col items-center gap-3">
                  <LoadingSpinner size={40} />
                  <span className="text-muted-foreground">Cargando proveedores...</span>
                </div>
              </div>
            </motion.div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (error) {
    return (
      <SidebarProvider>           
        <SidebarInset>              
          <motion.div 
            className="container mx-auto py-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Alert variant="destructive" className="max-w-lg">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>Error al cargar proveedores</AlertTitle>
                <AlertDescription>
                  No se pudieron cargar los proveedores. Por favor, intenta nuevamente.
                </AlertDescription>
              </Alert>
            </motion.div>
          </motion.div>
        </SidebarInset>
      </SidebarProvider>
    )
  }  

  return (
    <>
      <SidebarProvider>          
        <SidebarInset>            
          <motion.div 
            className="container mx-auto py-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Header Section */}
            <motion.div 
              className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <div className="flex items-center gap-3">
                <motion.div 
                  className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg relative"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Building2 className="h-5 w-5 text-white" />
                  <motion.div
                    animate={{ 
                      rotate: 360,
                      scale: [1, 1.2, 1]
                    }}
                    transition={{ 
                      rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                      scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                    }}
                    className="absolute -top-1 -right-1"
                  >
                    <Sparkles className="h-4 w-4 text-yellow-400" />
                  </motion.div>
                </motion.div>
                <div>
                  <h1 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Proveedores
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Gestiona los proveedores de tu negocio
                  </p>
                </div>
              </div>
              
              <motion.div 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Link href="/busy/vendor/new">
                  <Button className="gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
                    <Plus className="h-4 w-4" /> 
                    Nuevo Proveedor
                  </Button>
                </Link>
              </motion.div>
            </motion.div>

            {/* Data Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <DataTable
                columns={columns}
                data={vendors || []}
                searchColumn="nombre"
                searchPlaceholder="Buscar proveedor..."
              />
            </motion.div>
          </motion.div>
        </SidebarInset>
      </SidebarProvider>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!vendorToDelete} onOpenChange={(open) => !open && setVendorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <AlertCircle className="h-5 w-5 text-destructive" />
              </motion.div>
              ¿Está seguro?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el proveedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Vendor Dialog */}
      <Dialog open={!!vendorToView} onOpenChange={(open) => !open && setVendorToView(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Detalles del Proveedor
            </DialogTitle>
            <DialogDescription>
              Información completa del proveedor
            </DialogDescription>
          </DialogHeader>
          {vendorToView && (
            <motion.div 
              className="grid grid-cols-1 gap-4 mt-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-4">
                {vendorToView.logo ? (
                  <motion.img
                    src={vendorToView.logo}
                    alt={`Logo de ${vendorToView.nombre}`}
                    className="w-16 h-16 object-contain rounded"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  />
                ) : (
                  <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold">{vendorToView.nombre}</h3>
                  <p className="text-sm text-muted-foreground">ID: {vendorToView.vendorId}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {vendorToView.direccion && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Dirección</p>
                    <p>{vendorToView.direccion}</p>
                  </div>
                )}
                {vendorToView.telefono && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Teléfono</p>
                    <p>{vendorToView.telefono}</p>
                  </div>
                )}
                {vendorToView.contacto && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Persona de Contacto</p>
                    <p>{vendorToView.contacto}</p>
                  </div>
                )}
                {vendorToView.cuentaCUP && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cuenta CUP</p>
                    <p>{vendorToView.cuentaCUP}</p>
                  </div>
                )}
                {vendorToView.cuentaUSD && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cuenta USD</p>
                    <p>{vendorToView.cuentaUSD}</p>
                  </div>
                )}
              </div>
              {vendorToView.contratos && vendorToView.contratos.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground">Contratos</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {vendorToView.contratos.map((contrato: any, index: number) => (
                      <motion.span 
                        key={index} 
                        className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-sm"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        {contrato.numeroContrato}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-muted-foreground">Fecha de Creación</p>
                <p>{new Date(vendorToView.createdAt).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</p>
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )  
}

export default Vendor
