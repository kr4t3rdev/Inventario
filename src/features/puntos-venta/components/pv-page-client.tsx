"use client"

import { Button } from '@/components/ui/button'
import type { ColumnDef } from '@tanstack/react-table'
import { 
  ArrowDown, 
  ArrowUp, 
  ArrowUpDown, 
  Pencil, 
  Plus, 
  Trash2,
  Store,
  MapPin,
  AlertCircle
} from 'lucide-react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import dynamic from 'next/dynamic'
import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog'
import { LazyMotion, m as motion } from 'framer-motion'
import { deletePuntoDeVentaAction } from '@/features/puntos-venta'

interface PvPageClientProps {
  puntosDeVenta: any[]
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

// Lazy load DataTable with loading animation
const DataTable = dynamic(() => import('@/components/data-table').then(mod => ({default:mod.DataTable})), {
  loading: () => (
    <motion.div 
      className="h-[500px] w-full flex items-center justify-center bg-muted/30 dark:bg-muted/10 rounded-lg border-2 border-dashed"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size={40} />
        <span className="text-muted-foreground">Cargando puntos de venta...</span>
      </div>
    </motion.div>
  )
})

/**
 * @description Componente cliente de la página de puntos de venta.
 * Recibe datos iniciales desde el Server Component.
 *
 * @param {PvPageClientProps} props - Datos iniciales.
 * @returns {JSX.Element} Vista completa de gestión de puntos de venta.
 */
export function PvPageClient({ puntosDeVenta: initialData }: PvPageClientProps) {
  const [puntosDeVenta, setPuntosDeVenta] = useState<any[]>(initialData)
  const [pvToDelete, setPvToDelete] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  // Sync state when server re-fetches
  useEffect(() => {
    setPuntosDeVenta(initialData)
  }, [initialData])

  const handleDelete = async () => {
    if (!pvToDelete) return

    startTransition(async () => {
      const result = await deletePuntoDeVentaAction(pvToDelete)
      if (result.success) {
        toast('El punto de venta ha sido eliminado exitosamente.')
        router.refresh()
      } else {
        toast(result.error?.message || 'Hubo un error al eliminar el punto de venta.')
      }
      setPvToDelete(null)
    })
  }

  const columns: ColumnDef<unknown>[] = [
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
              <Store className="h-4 w-4 text-primary" />
            </motion.div>
            {nombre}
          </motion.div>
        )
      }
    },
    {
      accessorKey: 'ubicacion',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Ubicación
          <ArrowDown className='ml-2 h-4 w-4'/>
        </Button>
      ),
      cell: ({ row }) => {
        const ubicacion = row.getValue('ubicacion') as string
        return (
          <motion.div 
            className="flex items-center gap-2"
            whileHover={{ x: 2 }}
            transition={{ duration: 0.2 }}
          >
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {ubicacion}
          </motion.div>
        )
      }
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
        const pv = row.original as any
        return (
          <div className="flex items-center gap-2">
            <Link href={`/busy/puntosDeVenta/update/${pv.pvId}`}>
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
                onClick={() => setPvToDelete(pv.pvId)}
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
                  <Store className="h-5 w-5 text-white" />

                </motion.div>
                <div>
                  <h1 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Puntos de Venta
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Gestiona los puntos de venta de tu negocio
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
                  <Link href="/busy/puntosDeVenta/new">
                    <Plus className="h-4 w-4" /> 
                    Nuevo Punto de Venta
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
                data={puntosDeVenta || []}
                searchColumn="nombre"
                searchPlaceholder="Buscar puntos de venta..."
              />
            </motion.div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!pvToDelete} onOpenChange={(open) => !open && setPvToDelete(null)}>
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
              Esta acción no se puede deshacer. Esto eliminará permanentemente el punto de venta.
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
    </>
  )
}
