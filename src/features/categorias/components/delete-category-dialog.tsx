"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { deleteCategoriaAction } from "@/features/categorias/actions"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2, AlertTriangle, Trash2 } from "lucide-react"
import { LazyMotion, m as motion } from "framer-motion"

interface DeleteCategoryDialogProps {
  category: {
    catId: string
    nombre: string
    hasChildren?: boolean
    productCount?: number
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * @description Diálogo de confirmación para eliminar una categoría.
 * Usa deleteCategoriaAction (Server Action) en lugar de RTK Query.
 *
 * @param {DeleteCategoryDialogProps} props - Props del diálogo.
 * @returns {JSX.Element} Diálogo de confirmación.
 */
export function DeleteCategoryDialog({
  category,
  open,
  onOpenChange,
  onSuccess,
}: DeleteCategoryDialogProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const result = await deleteCategoriaAction(category.catId)

      if (result.success) {
        toast.success(`La categoría "${category.nombre}" ha sido eliminada correctamente.`)
        onOpenChange(false)
        router.refresh()
        onSuccess?.()
      } else {
        const errorMessage = result.error?.message || "Ocurrió un error al eliminar la categoría."
        setDeleteError(errorMessage)
      }
    } catch (error: any) {
      console.error("Error al eliminar la categoría:", error)
      setDeleteError("Ocurrió un error al eliminar la categoría. Por favor, intente nuevamente.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader className="p-6 pb-4 border-b bg-linear-to-r from-destructive/5 to-orange-600/5">
            <div className="flex items-center gap-3">
              <motion.div 
                className="w-10 h-10 bg-linear-to-br from-destructive to-orange-600 rounded-xl flex items-center justify-center shadow-lg"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              >
                <Trash2 className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <DialogTitle className="text-xl">
                  Eliminar categoría
                </DialogTitle>
                <DialogDescription className="mt-1">
                  ¿Está seguro de que desea eliminar <span className="font-semibold text-destructive">{category.nombre}</span>?
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-6 space-y-4">
            <Alert variant="destructive" className="text-left">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>¡Atención!</AlertTitle>
              <AlertDescription className="mt-1">
                Esta acción no se puede deshacer. La categoría será eliminada permanentemente.
              </AlertDescription>
            </Alert>

            {deleteError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Alert variant="destructive" className="text-left">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No se puede eliminar</AlertTitle>
                  <AlertDescription className="mt-1">
                    {deleteError}
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </div>
          
          <DialogFooter className="p-6 pt-2">
            <DialogClose asChild>
              <Button 
                type="button"
                variant="outline"
                disabled={isDeleting}
              >
                Cancelar
              </Button>
            </DialogClose>
            
            <Button 
              type="button"
              variant="destructive" 
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="mr-2"
                  >
                    <Loader2 className="h-4 w-4" />
                  </motion.div>
                  Eliminando...
                </>
              ) : (
                'Eliminar permanentemente'
              )}
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
