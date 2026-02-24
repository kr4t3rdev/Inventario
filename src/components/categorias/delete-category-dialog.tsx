"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDeleteCategoriaMutation } from "@/lib/redux/services/categoriasApi"
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
import { useCategoryValidation } from "@/hooks/use-category-validation"
import { motion, AnimatePresence } from "framer-motion"

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

export function DeleteCategoryDialog({
  category,
  open,
  onOpenChange,
  onSuccess,
}: DeleteCategoryDialogProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteCategory] = useDeleteCategoriaMutation()
  const { validateDeletion, isLoading: isValidating } = useCategoryValidation()
  const [deletionCheck, setDeletionCheck] = useState<{
    canDelete: boolean
    reason?: string
    hasProducts?: boolean
    hasSubcategories?: boolean
    productCount?: number
    subcategoryCount?: number
  } | null>(null)

  // Check if category can be deleted when dialog opens
  useEffect(() => {
    const checkDeletion = async () => {
      if (!open) return
      
      try {
        const result = validateDeletion(category.catId)
        setDeletionCheck({
          canDelete: result.isValid,
          reason: result.error,
          hasProducts: false,
          hasSubcategories: false,
          productCount: 0,
          subcategoryCount: 0
        })
        setDeleteError(result.isValid ? null : result.error || null)
      } catch (error) {
        console.error('Error checking category deletion:', error)
        setDeleteError('Error al verificar si la categoría puede ser eliminada')
      }
    }
    
    checkDeletion()
  }, [open, category.catId, validateDeletion])

  const handleDelete = async () => {
    if (!deletionCheck?.canDelete) return
    
    setIsDeleting(true)
    setDeleteError(null)
    
    try {
      await deleteCategory(category.catId).unwrap()
      
      toast.success(`La categoría "${category.nombre}" ha sido eliminada correctamente.`)
      
      // Close dialog, refresh the page, and call success callback
      onOpenChange(false)
      router.refresh()
      onSuccess?.()
      
    } catch (error: any) {
      console.error("Error al eliminar la categoría:", error)
      
      let errorMessage = "Ocurrió un error al eliminar la categoría. Por favor, intente nuevamente."
      
      if (error?.data?.message) {
        errorMessage = error.data.message
      } else if (error?.status === 400) {
        if (error.data?.includes("subcategorías")) {
          errorMessage = "No se puede eliminar una categoría que tiene subcategorías. Elimine primero las subcategorías."
        } else if (error.data?.includes("productos")) {
          errorMessage = "No se puede eliminar una categoría que contiene productos. Mueva o elimine los productos primero."
        }
      }
      
      setDeleteError(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  const isLoading = isDeleting || isValidating
  const canDelete = deletionCheck?.canDelete === true
  const hasProducts = deletionCheck?.hasProducts || false
  const hasSubcategories = deletionCheck?.hasSubcategories || false
  const productCount = deletionCheck?.productCount || 0
  const subcategoryCount = deletionCheck?.subcategoryCount || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-destructive/5 to-orange-600/5">
            <div className="flex items-center gap-3">
              <motion.div 
                className="w-10 h-10 bg-gradient-to-br from-destructive to-orange-600 rounded-xl flex items-center justify-center shadow-lg"
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
            <AnimatePresence mode="wait">
              {isLoading && !deleteError && (
                <motion.div 
                  className="flex items-center justify-center py-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="h-6 w-6 text-muted-foreground" />
                  </motion.div>
                  <span className="ml-2 text-sm text-muted-foreground">
                    Verificando categoría...
                  </span>
                </motion.div>
              )}

              {deleteError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
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

              {!isLoading && canDelete && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Alert variant="destructive" className="text-left">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>¡Atención!</AlertTitle>
                    <AlertDescription className="mt-1">
                      Esta acción no se puede deshacer. La categoría será eliminada permanentemente.
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}

              {!isLoading && hasProducts && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Alert variant="destructive" className="text-left">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Productos encontrados</AlertTitle>
                    <AlertDescription className="mt-1">
                      Esta categoría contiene {productCount} producto(s). Al eliminarla, estos productos quedarán sin categoría.
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}

              {!isLoading && hasSubcategories && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Alert variant="destructive" className="text-left">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Subcategorías encontradas</AlertTitle>
                    <AlertDescription className="mt-1">
                      Esta categoría tiene {subcategoryCount} subcategoría(s). Al eliminarla, todas las subcategorías también serán eliminadas.
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <DialogFooter className="p-6 pt-2">
            <DialogClose asChild>
              <Button 
                type="button"
                variant="outline"
                disabled={isLoading}
              >
                Cancelar
              </Button>
            </DialogClose>
            
            <Button 
              type="button"
              variant="destructive" 
              onClick={handleDelete}
              disabled={isLoading || !canDelete}
            >
              {isLoading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="mr-2"
                  >
                    <Loader2 className="h-4 w-4" />
                  </motion.div>
                  {isDeleting ? 'Eliminando...' : 'Verificando...'}
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
