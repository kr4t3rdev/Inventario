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
import { LazyMotion, m as motion, useReducedMotion } from "framer-motion"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ManagementPageTitle } from "@/components/management-page-title"
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
  const reduceMotion = useReducedMotion()
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
            initial={{ opacity: 0, y: reduceMotion ? 0 : -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.5 }}
          >
            <ManagementPageTitle
              icon={AlertTriangle}
              title="Mermas"
              description="Consulta y administra las mermas de inventario."
            />
            <motion.div
              whileHover={reduceMotion ? undefined : { scale: 1.02 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              <Button
                asChild
                className="bg-primary text-primary-foreground hover:bg-primary/90"
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
            initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : 0.2, duration: reduceMotion ? 0 : 0.5 }}
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
