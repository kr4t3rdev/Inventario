'use client'

/**
 * @description Componente de contenido para Elementos de Gastos (Client Component).
 * Maneja toda la interactividad: estados, efectos, tablas, diálogos de confirmación.
 * Los datos iniciales se reciben como props desde el Server Component.
 * 
 * @param {GastoElementosContentProps} props - Props del componente
 * @returns {JSX.Element} Interfaz de gestión de Elementos de Gastos
 */
import dynamic from "next/dynamic"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { deleteGastoElementoAction } from "@/features/gastosDE/actions"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUp, ArrowLeft, Layers, Plus, Trash2, Pencil, AlertCircle } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { LazyMotion, m as motion } from "framer-motion"
import Link from "next/link"

const DataTable = dynamic(() => import('@/components/data-table').then(mod => ({ default: mod.DataTable })))

interface GastoElemento {
  elementoId: string
  nombre: string
  descripcion: string | null
  isActive: boolean
  _count: {
    gastosDE: number
  }
}

interface GastoConceptoInfo {
  conceptoId: string
  nombre: string
}

interface GastoElementosContentProps {
  initialConcepto: GastoConceptoInfo | null
  initialElementos: GastoElemento[]
  conceptoId: string
}

export function GastoElementosContent({ initialConcepto, initialElementos, conceptoId }: GastoElementosContentProps) {
  const [elementos, setElementos] = useState<GastoElemento[]>(initialElementos)
  const [concepto] = useState<GastoConceptoInfo | null>(initialConcepto)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [elementoToDelete, setElementoToDelete] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!elementoToDelete) return
    startTransition(async () => {
      const r = await deleteGastoElementoAction(elementoToDelete)
      if (r.success) {
        toast.success(r.data?.message || "Eliminado")
        const ref = await import('@/features/gastosDE/actions').then(m => m.getGastoElementosAction(conceptoId))
        if (ref.success) setElementos(ref.data ?? [])
      } else {
        toast.error(r.error?.message || "Error al eliminar")
      }
      setElementoToDelete(null)
    })
  }

  const columns: ColumnDef<unknown>[] = [
    {
      accessorKey: 'nombre',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Elemento de Gasto
          <ArrowUp className='ml-2 h-4 w-4' />
        </Button>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => {
        const desc = (row.original as GastoElemento).descripcion
        return <div className="max-w-[300px] truncate text-muted-foreground">{desc || "—"}</div>
      },
    },
    {
      accessorKey: '_count.gastosDE',
      header: 'Gastos',
      cell: ({ row }) => {
        const count = (row.original as GastoElemento)._count?.gastosDE || 0
        return <Badge variant="outline">{count}</Badge>
      },
    },
    {
      accessorKey: 'isActive',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Estado
          <ArrowUp className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const isActive = (row.original as GastoElemento).isActive
        return isActive ? (
          <Badge className="bg-green-600 text-white">Activo</Badge>
        ) : (
          <Badge className="bg-gray-600 text-white">Inactivo</Badge>
        )
      },
    },
    {
      header: 'Acciones',
      id: 'actions',
      cell: ({ row }) => {
        const elemento = row.original as GastoElemento
        return (
          <div className="flex items-center gap-2">
            <Link href={`/busy/gastosDE/conceptos/${conceptoId}/elementos/update/${elemento.elementoId}`}>
              <Button variant='outline' className='h-8 w-8 p-0 cursor-pointer'>
                <Pencil className='h-4 w-4' />
              </Button>
            </Link>
            <Button
              onClick={() => setElementoToDelete(elemento.elementoId)}
              variant='outline'
              className='h-8 w-8 p-0 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors'
            >
              <Trash2 className='h-4 w-4' />
            </Button>
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
            <div className="flex items-center gap-3 mb-6">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-8 w-48" />
            </div>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (!concepto) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <p className="text-muted-foreground">Concepto no encontrado.</p>
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
            <motion.div className="flex items-center gap-3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Button variant="ghost" asChild className="gap-2">
                <Link href="/busy/gastosDE/conceptos">
                  <ArrowLeft className="h-4 w-4" /> Conceptos
                </Link>
              </Button>
              <motion.div
                className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Layers className="h-5 w-5 text-white" />
              </motion.div>
              <div className="relative">
                <h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                  Elementos: {concepto.nombre}
                </h1>
              </div>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Button asChild className="bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-500/90 hover:to-red-600/90">
                <Link href={`/busy/gastosDE/conceptos/${conceptoId}/elementos/new`}>
                  <Plus className="mr-2 h-4 w-4" /> Nuevo Elemento
                </Link>
              </Button>
            </motion.div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <DataTable
              columns={columns}
              data={elementos || []}
              searchColumn="nombre"
              searchPlaceholder="Buscar elementos de gastos..."
            />
          </motion.div>
        </div>
      </SidebarInset>

      <AlertDialog open={!!elementoToDelete} onOpenChange={(open) => !open && setElementoToDelete(null)}>
        <AlertDialogContent className="border-dashed">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              ¿Está seguro?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el elemento. Los gastos asociados quedarán sin elemento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}