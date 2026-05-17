'use client'

/**
 * @description Componente de contenido para Transferencias (Client Component).
 * Maneja toda la interactividad: listado, eliminación, diálogos de confirmación.
 * Los datos iniciales se reciben como props desde el Server Component (page.tsx).
 * 
 * @param {TransferenciasContentProps} props - Props del componente
 * @returns {JSX.Element} Interfaz de gestión de Transferencias
 */
import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LazyMotion, m as motion } from "framer-motion"
import { Package, PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
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
import { deleteTransferenciaAction } from "@/features/transferencias/actions"
import { TransferenciasTable } from "@/features/transferencias/components/transferencias-table"
import type { Transferencia } from "@/app/models/model"

interface TransferenciasContentProps {
  initialTransferencias: Transferencia[]
  isLoading?: boolean
  error?: any
}

export function TransferenciasContent({ initialTransferencias, isLoading: initialIsLoading, error: initialError }: TransferenciasContentProps) {
  const router = useRouter()
  const [transferencias, setTransferencias] = useState<Transferencia[]>(initialTransferencias)
  const [isLoading, setIsLoading] = useState(initialIsLoading ?? false)
  const [error, setError] = useState(initialError)
  const [isPending, startTransition] = useTransition()

  const [transferenciaToDelete, setTransferenciaToDelete] = useState<string | null>(null)

  useEffect(() => {
    setTransferencias(initialTransferencias)
  }, [initialTransferencias])

  const handleConfirmDelete = async () => {
    if (!transferenciaToDelete) return
    startTransition(async () => {
      const result = await deleteTransferenciaAction(transferenciaToDelete)
      if (result.success) {
        toast.success('Transferencia cancelada exitosamente.')
        router.refresh()
      } else {
        toast.error(result.error?.message ?? 'Error al cancelar')
      }
      setTransferenciaToDelete(null)
    })
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <motion.div 
          className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 max-w-7xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div 
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <div className="flex items-center gap-4">
              <motion.div
                className="w-12 h-12 bg-linear-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20"
                whileHover={{ scale: 1.05, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Package className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                  Transferencias
                </h1>
                <p className="text-muted-foreground text-sm">
                  Gestiona las transferencias de inventario entre almacenes
                </p>
              </div>
            </div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                asChild 
                className="bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg shadow-orange-500/25"
              >
                <Link href="/busy/transferencias/new">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Nueva Transferencia
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <TransferenciasTable 
              transferencias={transferencias}
              isLoading={isLoading}
              error={error}
              onDelete={(id) => setTransferenciaToDelete(id)}
            />
          </motion.div>
        </motion.div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!transferenciaToDelete} onOpenChange={(open) => !open && setTransferenciaToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cancelar transferencia?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción revertirá el stock movido. ¿Está seguro de que desea cancelar esta transferencia?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>No, mantener</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sí, cancelar transferencia
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
  )
}