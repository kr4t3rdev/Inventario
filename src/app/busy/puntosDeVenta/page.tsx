'use client'

import { Button } from '@/components/ui/button'
import { ColumnDef } from '@tanstack/react-table'
import { 
  ArrowDown, 
  ArrowUp, 
  ArrowUpDown, 
  Pencil, 
  Plus, 
  Trash2,
  Store,
  MapPin,
  Sparkles,
  AlertCircle
} from 'lucide-react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import dynamic from 'next/dynamic'

import { getPuntosDeVentaAction, deletePuntoDeVentaAction } from '@/features/puntos-venta'
import { useEffect, useState, useTransition } from 'react'
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
import { motion, AnimatePresence } from 'framer-motion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

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

// Lazy load DataTable with loading animation
const DataTable = dynamic(() => import('@/components/data-table').then(mod => ({default:mod.DataTable})), {
  loading: () => (
    <motion.div 
      className="h-[500px] w-full flex items-center justify-center bg-muted/30 dark:bg-muted/10 rounded-lg border-2 border-dashed border-muted"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size={40} />
        <span className="text-muted-foreground">Cargando tabla de puntos de venta...</span>
      </div>
    </motion.div>
  )
})

export default function PuntoDeVenta() {
  const [pv, setPV] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => { async function f() { setIsLoading(true); const r=await getPuntosDeVentaAction(); if(r.success) setPV(r.data??[]); setIsLoading(false); } f(); }, [])

  const [deletePuntoDeVenta] = useState<string | null>(null) as any
  const [ puntoDeVentaToDelete, setPuntoDeVentaToDelete ] = useState<string | null>(null)

  const handleDeletePuntoVenta = async () => {
    if(!puntoDeVentaToDelete) return
    startTransition(async () => {
      const r=await deletePuntoDeVentaAction(puntoDeVentaToDelete)
      if(r.success) { toast('El punto de venta ha sido eliminado exitosamente.'); const ref=await getPuntosDeVentaAction(); if(ref.success) setPV(ref.data??[]) }
      else toast(r.error?.message||'Hubo un error al eliminar el punto de venta.')
      setPuntoDeVentaToDelete(null)
    })
  }
  }

  const columns: ColumnDef<unknown>[] = [
    {
      accessorKey:'nombre',
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
      accessorKey:'ubicacion',
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
            className="flex items-center gap-2 text-muted-foreground"
            whileHover={{ x: 2 }}
            transition={{ duration: 0.2 }}
          >
            <MapPin className="h-4 w-4" />
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
        const ptoVenta = row.original as any

        return (
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant='outline'
                className='h-8 w-8 p-0 cursor-pointer'
                asChild
              >
                <Link href={`/busy/puntosDeVenta/update/${ptoVenta.pvId}`}>
                  <Pencil className='h-4 w-4'/>
                </Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant='outline'
                className='h-8 w-8 p-0 cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive'
                onClick={() => {
                  setPuntoDeVentaToDelete(ptoVenta.pvId)
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
                  <span className="text-muted-foreground">Cargando puntos de venta...</span>
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
                <AlertTitle>Error al cargar puntos de venta</AlertTitle>
                <AlertDescription>
                  No se pudieron cargar los puntos de venta. Por favor, intenta nuevamente.
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
                  <Store className="h-5 w-5 text-white" />
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
                <Link href='/busy/puntosDeVenta/new'>
                  <Button className="gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
                    <Plus className='h-4 w-4' />
                    Nuevo Punto de Venta
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
                data={pv}
                searchColumn="nombre"
                searchPlaceholder="Buscar punto de venta..."
              />
            </motion.div>
          </motion.div>
        </SidebarInset>
      </SidebarProvider>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!puntoDeVentaToDelete} onOpenChange={(open) => !open && setPuntoDeVentaToDelete(null)}>
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
              onClick={handleDeletePuntoVenta} 
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
