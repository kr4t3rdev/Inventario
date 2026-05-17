"use client"

import { Button } from '@/components/ui/button'
import { deleteUnidadAction } from '@/features/unidades/actions'
import type { ColumnDef } from '@tanstack/react-table'
import { 
  ArrowDown, 
  ArrowUp, 
  ArrowUpDown, 
  Pencil, 
  Plus, 
  Trash2, 
  Scale,
  Sparkles,
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
  AlertDialogContent, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog'
import { LazyMotion, m as motion } from 'framer-motion'
import type { Unidad } from '@/features/unidades'

interface UnidadPageClientProps {
  unidades: Unidad[]
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
      className="h-[500px] w-full flex items-center justify-center bg-muted/30 dark:bg-muted/10 rounded-lg border-2 border-dashed border-muted"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size={40} />
        <span className="text-muted-foreground">Cargando tabla de unidades...</span>
      </div>
    </motion.div>
  )
})

/**
 * @description Componente cliente de la página de unidades.
 * Recibe datos iniciales desde el Server Component.
 *
 * @param {UnidadPageClientProps} props - Datos iniciales de unidades.
 * @returns {JSX.Element} Vista completa de gestión de unidades.
 */
export function UnidadPageClient({ unidades: initialUnidades }: UnidadPageClientProps) {
  const [unidades, setUnidades] = useState<any[]>(initialUnidades)
  const [unidadToDelete, setUnidadToDelete] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  // Sync state when server re-fetches (e.g., after router.refresh())
  useEffect(() => {
    setUnidades(initialUnidades)
  }, [initialUnidades])

  const handleDelete = async () => {
    if (!unidadToDelete) return

    startTransition(async () => {
      const result = await deleteUnidadAction(unidadToDelete)
      if (result.success) {
        toast('La unidad ha sido eliminada exitosamente.')
        router.refresh()
      } else {
        toast(result.error?.message || 'Hubo un error al eliminar la unidad.')
      }
      setUnidadToDelete(null)
    })
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
            className="font-medium"
            whileHover={{ x: 2 }}
            transition={{ duration: 0.2 }}
          >
            {nombre}
          </motion.div>
        )
      }
    },
    {
      accessorKey:'simbolo',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Símbolo
          <ArrowDown className='ml-2 h-4 w-4'/>
        </Button>
      ),
      cell: ({ row }) => {
        const simbolo = row.getValue('simbolo') as string
        return (
          <motion.div
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary font-bold"
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2 }}
          >
            {simbolo}
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
          <div className='max-w-[150px] truncate text-center text-muted-foreground'>
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
        const unidad = row.original as any
        return (
          <div className="flex items-center gap-2">
            <Link href={`/busy/unidad/update/${unidad.unidadId}`}>
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
                onClick={ () => {
                  setUnidadToDelete(unidad.unidadId)
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
                  <Scale className="h-5 w-5 text-white" />
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
                    Unidades
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Gestiona las unidades de medida para tus productos
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
                  <Link href="/busy/unidad/new">
                    <Plus className="h-4 w-4" /> 
                    Nueva Unidad
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
                data={unidades || []}
                searchColumn="nombre"
                searchPlaceholder="Buscar unidades..."
              />
            </motion.div>
          </motion.div>
        </SidebarInset>
      </SidebarProvider>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!unidadToDelete} onOpenChange={(open) => !open && setUnidadToDelete(null)}>
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
              Esta acción no se puede deshacer. Esto eliminará permanentemente la unidad.
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
