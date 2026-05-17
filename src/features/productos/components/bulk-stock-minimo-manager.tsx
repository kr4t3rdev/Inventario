'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle,
  Package,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { getProductosAction, bulkUpdateStockMinimoAction } from '@/features/productos/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Producto } from '@/app/models/model'

interface ProductoWithStockMinimo extends Producto {
  newStockMinimo?: number
  isModified?: boolean
  isSelected?: boolean
}

interface BulkUpdateProgress {
  isUpdating: boolean
  total: number
  completed: number
  errors: Array<{
    productoId: string
    productoNombre: string
    error: string
  }>
}

function PulseSkeleton({ className }: { className?: string }): React.JSX.Element {
  return (
    <motion.div
      className={`bg-muted rounded ${className}`}
      animate={{ opacity: [0.45, 0.82, 0.45] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

/**
 * @description Gestor para actualizar de forma masiva el stock mínimo de productos.
 * @returns {JSX.Element} Tabla editable con selección y acciones de actualización.
 */
export function BulkStockMinimoManager(): React.JSX.Element {
  const [productos, setProductos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  const fetchProductos = () => {
    getProductosAction().then(r => {
      if (r.success) setProductos(r.data ?? [])
      setIsLoading(false)
    })
  }

  useEffect(() => {
    fetchProductos()
  }, [])

  const [productosState, setProductosState] = useState<ProductoWithStockMinimo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectAll, setSelectAll] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<BulkUpdateProgress>({
    isUpdating: false,
    total: 0,
    completed: 0,
    errors: [],
  })

  useEffect(() => {
    if (!productos) return

    setProductosState(
      productos.map((producto) => ({
        ...producto,
        newStockMinimo: producto.stockMinimo,
        isModified: false,
        isSelected: false,
      }))
    )
  }, [productos])

  const filteredProductos = productosState.filter((producto) => {
    const normalizedTerm = searchTerm.toLowerCase()
    const nombreCategoria = producto.categoria?.nombre?.toLowerCase() || ''
    return (
      producto.nombre.toLowerCase().includes(normalizedTerm) ||
      nombreCategoria.includes(normalizedTerm)
    )
  })

  const selectedProductos = productosState.filter((producto) => producto.isSelected && producto.isModified)
  const hasModifications = productosState.some((producto) => producto.isModified)
  const hasSelections = selectedProductos.length > 0

  const handleStockMinimoChange = (productoId: string, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value, 10)
    if (isNaN(numValue) || numValue < 0) return

    setProductosState((prev) =>
      prev.map((producto) => {
        if (producto.id !== productoId) return producto

        const isModified = numValue !== producto.stockMinimo
        return {
          ...producto,
          newStockMinimo: numValue,
          isModified,
          isSelected: isModified ? producto.isSelected : false,
        }
      })
    )
  }

  const handleProductSelection = (productoId: string, checked: boolean) => {
    setProductosState((prev) =>
      prev.map((producto) => {
        if (producto.id === productoId && producto.isModified) {
          return { ...producto, isSelected: checked }
        }
        return producto
      })
    )
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    setProductosState((prev) =>
      prev.map((producto) => ({
        ...producto,
        isSelected: producto.isModified ? checked : false,
      }))
    )
  }

  const handleBulkUpdate = async () => {
    const updates = selectedProductos.map((producto) => ({
      productoId: producto.id,
      stockMinimo: producto.newStockMinimo || 0,
    }))

    if (updates.length === 0) {
      toast.error('No hay productos seleccionados para actualizar.')
      return
    }

    setUpdateProgress({
      isUpdating: true,
      total: updates.length,
      completed: 0,
      errors: [],
    })

    try {
      setIsUpdating(true)
      const result = await bulkUpdateStockMinimoAction({ updates })
      const data = result.success ? result.data! : { updated: 0, errors: [], results: [] }

      setUpdateProgress({
        isUpdating: false,
        total: updates.length,
        completed: data.updated,
        errors: data.errors.map((error) => ({
          productoId: error.productoId,
          productoNombre:
            productosState.find((producto) => producto.id === error.productoId)?.nombre || 'Desconocido',
          error: error.error,
        })),
      })

      if (result.success) {
        toast.success(`Se actualizaron ${data.updated} productos exitosamente.`)

        setProductosState((prev) =>
          prev.map((producto) => {
            const wasUpdated = data.results.find(
              (entry) => entry.productoId === producto.id && entry.success
            )
            if (!wasUpdated) return producto
            return {
              ...producto,
              stockMinimo: producto.newStockMinimo || 0,
              isModified: false,
              isSelected: false,
            }
          })
        )
        setSelectAll(false)
      } else {
        toast.error(`Se actualizaron ${
  // @ts-expect-error
        result.updated} de ${updates.length
        } productos. Revisa los errores.`)
      }
    } catch (error) {
      console.error('Error in bulk update:', error)
      toast.error('Error al actualizar los productos.')
      setUpdateProgress((prev) => ({ ...prev, isUpdating: false }))
    }
  }

  const handleReset = () => {
    if (!productos) return

    setProductosState(
      productos.map((producto) => ({
        ...producto,
        newStockMinimo: producto.stockMinimo,
        isModified: false,
        isSelected: false,
      }))
    )
    setSelectAll(false)
    setUpdateProgress({
      isUpdating: false,
      total: 0,
      completed: 0,
      errors: [],
    })
  }

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="overflow-hidden border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Cargando gestor de stock mínimo...
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PulseSkeleton className="h-10 w-full" />
            <PulseSkeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="overflow-hidden border-dashed bg-linear-to-br from-primary/[0.05] via-background to-purple-500/[0.08] dark:from-primary/10 dark:to-purple-500/10">
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-3 text-xl">
            <motion.div
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-600 text-white shadow-md"
              whileHover={{ scale: 1.05, rotate: 3 }}
              transition={{ duration: 0.2 }}
            >
              <Settings className="h-5 w-5" />
              <motion.span
                className="absolute -right-1 -top-1"
                animate={{ rotate: 360, scale: [1, 1.15, 1] }}
                transition={{
                  rotate: { duration: 16, repeat: Infinity, ease: 'linear' },
                  scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                }}
              >
                <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
              </motion.span>
            </motion.div>
            Gestión Masiva de Stock Mínimo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ajusta umbrales de inventario para múltiples productos. Un valor en 0 usa el umbral
            por defecto (10 unidades).
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <motion.div
            className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
          >
            <div className="relative flex-1 lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o categoría..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10 transition-all duration-200 focus-visible:ring-primary/30"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => fetchProductos()} disabled={isUpdating} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
                Refrescar
              </Button>

              {hasModifications && (
                <Button variant="outline" onClick={handleReset} disabled={isUpdating}>
                  Resetear cambios
                </Button>
              )}

              <Button
                onClick={handleBulkUpdate}
                disabled={selectedProductos.length === 0 || isUpdating}
                className="min-w-42.5 gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar ({selectedProductos.length})
                  </>
                )}
              </Button>
            </div>
          </motion.div>

          {updateProgress.isUpdating && (
            <motion.div
              className="space-y-2 rounded-lg border border-dashed bg-background/60 p-3"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between text-sm">
                <span>Actualizando productos...</span>
                <span>
                  {updateProgress.completed} / {updateProgress.total}
                </span>
              </div>
              <Progress
                value={(updateProgress.completed / Math.max(updateProgress.total, 1)) * 100}
                className="w-full"
              />
            </motion.div>
          )}

          {updateProgress.errors.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">
                    Errores detectados en {updateProgress.errors.length} producto(s):
                  </p>
                  <div className="text-sm">
                    {updateProgress.errors.slice(0, 3).map((error) => (
                      <p key={error.productoId}>
                        • {error.productoNombre}: {error.error}
                      </p>
                    ))}
                    {updateProgress.errors.length > 3 && (
                      <p>• Y {updateProgress.errors.length - 3} errores más...</p>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <motion.div
            className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              {filteredProductos.length} productos visibles
            </div>
            {hasModifications && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {productosState.filter((producto) => producto.isModified).length} modificados
              </div>
            )}
            {hasSelections && (
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                {selectedProductos.length} seleccionados
              </div>
            )}
          </motion.div>

          <motion.div
            className="overflow-hidden rounded-lg border border-dashed bg-background/70"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.13 }}
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                      disabled={!hasModifications}
                    />
                  </TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-center">Stock actual</TableHead>
                  <TableHead className="text-center">Stock mínimo actual</TableHead>
                  <TableHead className="text-center">Nuevo stock mínimo</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProductos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      {searchTerm
                        ? 'No se encontraron productos para ese criterio.'
                        : 'No hay productos disponibles.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProductos.map((producto) => (
                    <TableRow
                      key={producto.id}
                      className={`transition-colors ${
                        producto.isModified
                          ? 'bg-amber-50/60 hover:bg-amber-100/60 dark:bg-amber-500/10 dark:hover:bg-amber-500/20'
                          : 'hover:bg-muted/40'
                      }`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={producto.isSelected || false}
                          onCheckedChange={(checked) =>
                            handleProductSelection(producto.id, checked as boolean)
                          }
                          disabled={!producto.isModified || isUpdating}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{producto.nombre}</p>
                          {producto.descripcion && (
                            <p className="max-w-[220px] truncate text-sm text-muted-foreground">
                              {producto.descripcion}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{producto.categoria?.nombre || 'Sin categoría'}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            producto.stock > 10
                              ? 'outline'
                              : producto.stock > 0
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {producto.stock} {producto.unidad?.simbolo || ''}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={producto.stockMinimo > 0 ? 'default' : 'secondary'}>
                          {producto.stockMinimo > 0 ? producto.stockMinimo : 'Por defecto (10)'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          value={producto.newStockMinimo || 0}
                          onChange={(event) => handleStockMinimoChange(producto.id, event.target.value)}
                          className="mx-auto w-24 text-center focus-visible:ring-primary/30"
                          disabled={isUpdating}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {producto.isModified ? (
                          <div className="flex justify-center">
                            {producto.isSelected ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Seleccionado
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Modificado
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline">Sin cambios</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </motion.div>

          <div className="space-y-1 text-xs text-muted-foreground">
            <p>• Cambia valores de stock mínimo y selecciona las filas que deseas actualizar.</p>
            <p>• Un valor en 0 usa automáticamente el umbral por defecto de 10 unidades.</p>
            <p>• Las filas modificadas se resaltan para facilitar la revisión antes de guardar.</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
