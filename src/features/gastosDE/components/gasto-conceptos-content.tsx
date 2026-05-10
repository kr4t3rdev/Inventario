'use client'

/**
 * @description Componente de contenido para Conceptos de Gastos (Client Component).
 * Maneja toda la interactividad: estados, efectos, tablas, diálogos de confirmación.
 * Los datos iniciales se reciben como props desde el Server Component (conceptos/page.tsx).
 * 
 * @param {GastoConceptosContentProps} props - Props del componente
 * @returns {JSX.Element} Interfaz de gestión de Conceptos de Gastos
 */
import dynamic from "next/dynamic"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { deleteGastoConceptoAction } from "@/features/gastosDE/actions"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUp, FolderOpen, Plus, Trash2, Pencil, Layers, Sparkles, Loader2, AlertCircle } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import Link from "next/link"

const DataTable = dynamic(() => import('@/components/data-table').then(mod => ({ default: mod.DataTable })))

interface GastoConcepto {
  conceptoId: string
  nombre: string
  descripcion: string | null
  isActive: boolean
  _count: {
    elementos: number
    gastosDE: number
  }
  elementos?: { elementoId: string; nombre: string }[]
}

interface GastoConceptosContentProps {
  initialConceptos: GastoConcepto[]
}

export function GastoConceptosContent({ initialConceptos }: GastoConceptosContentProps) {
  const [conceptos, setConceptos] = useState<GastoConcepto[]>(initialConceptos)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [conceptoToDelete, setConceptoToDelete] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!conceptoToDelete) return
    startTransition(async () => {
      const r = await deleteGastoConceptoAction(conceptoToDelete)
      if (r.success) {
        toast.success(r.data?.message || "Eliminado")
        const ref = await import('@/features/gastosDE/actions').then(m => m.getGastoConceptosAction({}))
        if (ref.success) setConceptos(ref.data ?? [])
      } else {
        toast.error(r.error?.message || "Error al eliminar")
      }
      setConceptoToDelete(null)
    })
  }

  const columns: ColumnDef<unknown>[] = [
    {
      accessorKey: 'nombre',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Concepto de Gasto
          <ArrowUp className='ml-2 h-4 w-4' />
        </Button>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => {
        const desc = (row.original as GastoConcepto).descripcion
        return <div className="max-w-[300px] truncate text-muted-foreground">{desc || "—"}</div>
      },
    },
    {
      accessorKey: '_count.elementos',
      header: 'Elementos',
      cell: ({ row }) => {
        const concepto = row.original as GastoConcepto
        const count = concepto._count?.elementos || 0
        return <Badge variant="secondary">{count}</Badge>
      },
    },
    {
      accessorKey: '_count.gastosDE',
      header: 'Gastos',
      cell: ({ row }) => {
        const concepto = row.original as GastoConcepto
        const count = concepto._count?.gastosDE || 0
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
        const isActive = (row.original as GastoConcepto).isActive
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
        const concepto = row.original as GastoConcepto
        return (
          <div className="flex items-center gap-2">
            <Link href={`/busy/gastosDE/conceptos/${concepto.conceptoId}/elementos`}>
              <Button variant='outline' className='h-8 px-3 cursor-pointer' title="Ver elementos">
                <Layers className='h-3.5 w-3.5 mr-1' /> Elementos
              </Button>
            </Link>
            <Link href={`/busy/gastosDE/conceptos/update/${concepto.conceptoId}`}>
              <Button variant='outline' className='h-8 w-8 p-0 cursor-pointer'>
                <Pencil className='h-4 w-4' />
              </Button>
            </Link>
            <Button
              onClick={() => setConceptoToDelete(concepto.conceptoId)}
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
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
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
              <motion.div
                className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <FolderOpen className="h-5 w-5 text-white" />
              </motion.div>
              <div className="relative">
                <h1 className="text-2xl font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Conceptos de Gastos
                </h1>
                <motion.div className="absolute -right-4 -top-1" animate={{ rotate: 360, scale: [1, 1.2, 1] }} transition={{ rotate: { duration: 20, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}>
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                </motion.div>
              </div>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Button asChild className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
                <Link href="/busy/gastosDE/conceptos/new">
                  <Plus className="mr-2 h-4 w-4" /> Nuevo Concepto
                </Link>
              </Button>
            </motion.div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <DataTable
              columns={columns}
              data={conceptos || []}
              searchColumn="nombre"
              searchPlaceholder="Buscar conceptos de gastos..."
            />
          </motion.div>
        </div>
      </SidebarInset>

      <AlertDialog open={!!conceptoToDelete} onOpenChange={(open) => !open && setConceptoToDelete(null)}>
        <AlertDialogContent className="border-dashed">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              ¿Está seguro?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conceptos?.find(c => c.conceptoToDelete === conceptoToDelete)?._count?.gastosDE > 0
                ? "Este concepto tiene gastos asociados. Será desactivado en lugar de eliminado."
                : "Esta acción eliminará el concepto y todos sus elementos. Los gastos asociados quedarán sin concepto."}
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