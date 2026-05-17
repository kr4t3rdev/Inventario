"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Move, Folder, ArrowRight, Loader2 } from "lucide-react"
import { getCategoriasAction, updateCategoriaAction } from "@/features/categorias/actions"
import type { Categoria } from "@/app/models/model"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

interface CategoryMoveDialogProps {
  open: boolean
  onClose: () => void
  categoryId?: string
}

// Loading spinner component
function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <motion.div
      className="border-2 border-primary border-t-transparent rounded-full"
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

/**
 * @description Diálogo para mover una categoría a otro padre.
 * Usa Server Actions (getCategoriasAction / updateCategoriaAction)
 * en lugar de RTK Query.
 *
 * @param {CategoryMoveDialogProps} props - Props del diálogo.
 * @returns {JSX.Element} Diálogo de mover categoría.
 */
export function CategoryMoveDialog({ open, onClose, categoryId }: CategoryMoveDialogProps) {
  const [selectedParentId, setSelectedParentId] = useState<string>("none")
  const [loading, setLoading] = useState(false)

  // Fetch all categories via Server Action
  const [categories, setCategories] = useState<Categoria[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  useEffect(() => {
    if (!open) return

    getCategoriasAction().then(result => {
      if (result.success) {
        setCategories((result.data ?? []) as unknown as Categoria[])
      }
      setIsLoadingCategories(false)
    })
  }, [open])

  // Find the category being moved from the list
  const categoryToMove = categories.find((cat: Categoria) => cat.catId === categoryId)

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && categoryToMove) {
      setSelectedParentId(categoryToMove.parentId || "none")
    } else if (!open) {
      setSelectedParentId("none")
    }
  }, [open, categoryToMove])

  // Filter available parent categories
  const getAvailableParents = (): Categoria[] => {
    if (!categoryToMove || !categories) return []

    return categories.filter((cat: Categoria) => {
      // Exclude the category itself
      if (cat.catId === categoryToMove.catId) return false
      
      // Exclude its own subcategories to prevent circular references
      if (cat.parentId === categoryToMove.catId) return false
      
      // Only show parent categories (categories without parentId) for simplicity
      return !cat.parentId
    })
  }

  const availableParents = getAvailableParents()

  // Validate the move client-side
  const validation = (() => {
    const errors: string[] = []

    if (!categoryToMove) {
      errors.push("No se pudo cargar la información de la categoría")
      return { isValid: false, errors }
    }

    const currentParentId = categoryToMove.parentId || "none"
    if (selectedParentId === currentParentId) {
      errors.push("La categoría ya está en la ubicación seleccionada")
    }

    if (selectedParentId === categoryToMove.catId) {
      errors.push("Una categoría no puede ser padre de sí misma")
    }

    return { isValid: errors.length === 0, errors }
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!categoryId || !categoryToMove) {
      toast.error("Error: No se pudo identificar la categoría a mover")
      return
    }

    if (!validation.isValid) {
      validation.errors.forEach(error => toast.error(error))
      return
    }

    setLoading(true)

    try {
      const result = await updateCategoriaAction({
        catId: categoryId,
        parentId: selectedParentId === "none" ? null : selectedParentId,
      })

      if (!result.success) {
        throw new Error(result.error?.message || "Error al mover la categoría")
      }

      const parentName = selectedParentId && selectedParentId !== "none"
        ? categories.find(c => c.catId === selectedParentId)?.nombre 
        : "categoría principal"

      toast.success(`Categoría "${categoryToMove.nombre}" movida a "${parentName}" exitosamente`)
      onClose()
    } catch (error) {
      console.error("Error moving category:", error)
      toast.error("Error al mover la categoría")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader className="p-6 pb-4 border-b bg-linear-to-r from-primary/5 to-purple-600/5">
            <div className="flex items-center gap-3">
              <motion.div 
                className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              >
                <Move className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <DialogTitle className="text-xl">
                  Mover Categoría
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Selecciona la nueva ubicación para la categoría en la jerarquía.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {isLoadingCategories ? (
              <motion.div 
                className="py-8 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex flex-col items-center gap-3">
                  <LoadingSpinner size={32} />
                  <span className="text-muted-foreground">Cargando información de la categoría...</span>
                </div>
              </motion.div>
            ) : !categoryToMove ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6"
              >
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No se pudo cargar la información de la categoría.
                  </AlertDescription>
                </Alert>
              </motion.div>
            ) : (
              <motion.form 
                onSubmit={handleSubmit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="space-y-6 p-6">
                  {/* Current Category Info */}
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <Label className="text-muted-foreground">Categoría a mover:</Label>
                    <motion.div 
                      className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-dashed"
                      whileHover={{ scale: 1.01 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Folder className="h-4 w-4 text-primary" />
                      <span className="font-medium">{categoryToMove.nombre}</span>
                      {categoryToMove.descripcion && (
                        <span className="text-sm text-muted-foreground">
                          ({categoryToMove.descripcion})
                        </span>
                      )}
                    </motion.div>
                    {categoryToMove.parentId && (
                      <motion.p 
                        className="text-sm text-muted-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        Ubicación actual: <span className="font-medium">{categories.find(c => c.catId === categoryToMove.parentId)?.nombre || "Desconocida"}</span>
                      </motion.p>
                    )}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                  >
                    <Separator />
                  </motion.div>

                  {/* Parent Selection */}
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Label htmlFor="parent-select">Nueva ubicación:</Label>
                    <Select
                      value={selectedParentId}
                      onValueChange={setSelectedParentId}
                    >
                      <SelectTrigger id="parent-select" className="w-full">
                        <SelectValue placeholder="Seleccionar categoría padre (o dejar como principal)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-primary" />
                            Categoría principal (sin padre)
                          </div>
                        </SelectItem>
                        {availableParents.map((parent: Categoria, index) => (
                          <motion.div
                            key={parent.catId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 + index * 0.05 }}
                          >
                            <SelectItem value={parent.catId}>
                              <div className="flex items-center gap-2">
                                <Folder className="h-4 w-4 text-muted-foreground" />
                                {parent.nombre}
                                {parent.descripcion && (
                                  <span className="text-muted-foreground">
                                    ({parent.descripcion})
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          </motion.div>
                        ))}
                      </SelectContent>
                    </Select>
                  </motion.div>

                  {/* Validation Errors */}
                  <AnimatePresence>
                    {!validation.isValid && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                      >
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <ul className="list-disc list-inside space-y-1">
                              {validation.errors.map((error, index) => (
                                <li key={`${error}-${index}`}>{error}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Preview */}
                  <AnimatePresence>
                    {validation.isValid && selectedParentId !== (categoryToMove.parentId || "none") && (
                      <motion.div 
                        className="space-y-2"
                        initial={{ opacity: 0, y: 10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                      >
                        <Label className="text-muted-foreground">Vista previa:</Label>
                        <motion.div 
                          className="p-3 bg-accent/30 rounded-lg border border-accent"
                          whileHover={{ scale: 1.01 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="flex items-center gap-2 text-sm">
                            {selectedParentId && selectedParentId !== "none" ? (
                              <>
                                <Folder className="h-4 w-4 text-primary" />
                                <span className="font-medium">{categories.find(c => c.catId === selectedParentId)?.nombre}</span>
                                <motion.div
                                  animate={{ x: [0, 5, 0] }}
                                  transition={{ duration: 1, repeat: Infinity }}
                                >
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </motion.div>
                                <Badge variant="outline" className="bg-white">{categoryToMove.nombre}</Badge>
                              </>
                            ) : (
                              <>
                                <Folder className="h-4 w-4 text-primary" />
                                <Badge variant="outline" className="bg-white">{categoryToMove.nombre}</Badge>
                                <span className="text-muted-foreground text-xs">(categoría principal)</span>
                              </>
                            )}
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <DialogFooter className="p-6 pt-2">
                  <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading || !validation.isValid}
                    className="gap-2"
                  >
                    {loading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Loader2 className="h-4 w-4" />
                        </motion.div>
                        Moviendo...
                      </>
                    ) : (
                      <>
                        <Move className="h-4 w-4" />
                        Mover Categoría
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
