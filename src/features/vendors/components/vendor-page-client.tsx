"use client"

import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import type { ColumnDef } from "@tanstack/react-table"
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
import { deleteVendorAction } from "@/features/vendors"
import Link from "next/link"
import { toast } from "sonner"
import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"

interface VendorPageClientProps {
  vendors: any[]
}

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

/**
 * @description Componente cliente de la página de proveedores.
 * Recibe datos iniciales desde el Server Component.
 *
 * @param {VendorPageClientProps} props - Datos iniciales de proveedores.
 * @returns {JSX.Element} Vista completa de gestión de proveedores.
 */
export function VendorPageClient({ vendors: initialVendors }: VendorPageClientProps) {
  const [vendors, setVendors] = useState<any[]>(initialVendors)
  const [vendorToDelete, setVendorToDelete] = useState<string | null>(null)
  const [vendorToView, setVendorToView] = useState<any>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  // Sync state when server re-fetches (e.g., after router.refresh())
  useEffect(() => {
    setVendors(initialVendors)
  }, [initialVendors])

  const handleDelete = async () => {
    if (!vendorToDelete) return
    startTransition(async () => {
      const r = await deleteVendorAction(vendorToDelete)
      if (r.success) {
        toast("El proveedor ha sido eliminado exitosamente.")
        router.refresh()
      } else {
        toast(r.error?.message || "Hubo un error al eliminar el proveedor.")
      }
      setVendorToDelete(null)
    })
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
                onClick={() => setVendorToDelete(vendor.vendorId)}
              >
                <Trash2 className='h-4 w-4'/>
              </Button>
            </motion.div>
          </div>
        )
      }
    }
  ]

  return (
    <>
      <SidebarProvider>           
        <SidebarInset>              
          <div className="container mx-auto py-4">
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
                    Gestiona los proveedores de tu inventario
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
                <Button 
                  asChild 
                  className="gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                >
                  <Link href="/busy/vendor/new">
                    <Plus className="h-4 w-4" /> 
                    Nuevo Proveedor
                  </Link>
                </Button>
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
                searchPlaceholder="Buscar proveedores..."
              />
            </motion.div>
          </div>
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

      {/* View Detail Dialog */}
      <Dialog open={!!vendorToView} onOpenChange={(open) => !open && setVendorToView(null)}>
        <DialogContent className="sm:max-w-[500px]">
          {vendorToView && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {vendorToView.nombre}
                </DialogTitle>
                <DialogDescription>
                  Detalles del proveedor
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {vendorToView.vendorCode && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">Código</span>
                    <Badge variant="secondary" className="font-mono">{vendorToView.vendorCode}</Badge>
                  </div>
                )}
                {vendorToView.direccion && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">Dirección</span>
                    <span className="text-sm font-medium">{vendorToView.direccion}</span>
                  </div>
                )}
                {vendorToView.telefono && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">Teléfono</span>
                    <span className="text-sm font-medium">{vendorToView.telefono}</span>
                  </div>
                )}
                {vendorToView.contacto && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">Contacto</span>
                    <span className="text-sm font-medium">{vendorToView.contacto}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
