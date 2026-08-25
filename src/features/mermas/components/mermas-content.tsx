'use client'

/**
 * @description Componente de contenido para Mermas (Client Component).
 * Maneja toda la interactividad: listado, eliminación, diálogos de confirmación.
 * Los datos iniciales se reciben como props desde el Server Component (page.tsx).
 * 
 * @param {MermasContentProps} props - Props del componente
 * @returns {JSX.Element} Interfaz de gestión de Mermas
 */
import { useState, useTransition } from "react"
import Link from "next/link"
import { LazyMotion, m as motion } from "framer-motion"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { PlusCircle, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteMermaAction } from "@/features/mermas/actions"
import dynamic from "next/dynamic"

const MermasTable = dynamic(() => import('./mermas-table').then(mod => ({ default: mod.MermasTable })))

interface Merma {
  mermaId: string
  productoId: string
  cantidad: number
  motivo: string
  createdAt: string
  producto?: { nombre: string }
}

interface MermasContentProps {
  initialMermas: Merma[]
  isLoading?: boolean
  error?: any
}

export function MermasContent({ initialMermas, isLoading: initialIsLoading, error: initialError }: MermasContentProps) {
  const [mermas, setMermas] = useState<Merma[]>(initialMermas)
  const isLoading = initialIsLoading ?? false
  const error = initialError
  const [isPending, startTransition] = useTransition()

  const [mermaToDelete, setMermaToDelete] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!mermaToDelete) return
    startTransition(async () => {
      const r = await deleteMermaAction(mermaToDelete)
      if (r.success) {
        toast.success("Merma eliminada exitosamente.")
        const ref = await import('@/features/mermas/actions').then(m => m.getMermasAction())
  // @ts-expect-error TODO: fix type for ref.success
        if (ref.success) setMermas(ref.data ?? [])
      } else {
        toast.error(r.error?.message || "Error al eliminar la merma.")
      }
      setMermaToDelete(null)
    })
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          {/* Header */}
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
                className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <AlertTriangle className="h-5 w-5 text-white" />
              </motion.div>
              <div className="relative">
                <h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                  Mermas
                </h1>
              </div>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                asChild 
                className="bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
              >
                <Link href="/busy/mermas/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nueva Merma
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <MermasTable 
  // @ts-expect-error TODO: fix type for mermas prop
              mermas={
              mermas
              }
              isLoading={isLoading}
              error={error}
              onDelete={(id) => setMermaToDelete(id)}
            />
          </motion.div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!mermaToDelete} onOpenChange={(open) => !open && setMermaToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar merma?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. ¿Está seguro de que desea eliminar esta merma?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
  )
}