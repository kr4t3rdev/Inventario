import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RecipeOutputSelector, type RecipeOutputMode } from '@/components/produccion/recipe-output-selector'
import type { Producto } from '@/generated/prisma'
import { MASS_UNITS, VOLUME_UNITS } from '@/lib/utils/unit-converter'

type RecipeEditorItem = {
  productoId: string
  cantidad: number
  unidadSimbolo: string | null
  desperdicio: number
}

type PreviewRow = {
  blockingMessage: string | null
  normalizationMessage: string | null
}

type RecipeUnitPreview = {
  hasBlockingIssues: boolean
  blockingMessages: string[]
  normalizationMessages: string[]
  rows: Array<{ productoId: string } & PreviewRow>
}

interface RecipeEditorDialogProps {
  open: boolean
  nombreReceta: string
  rendimiento: number | string
  selectedProducto: string
  outputMode: RecipeOutputMode
  createdOutputProductName: string | null
  productosTyped: Producto[] | undefined
  busquedaProductos: string
  nuevoItems: RecipeEditorItem[]
  newRecipePreview: RecipeUnitPreview
  unitOptionNone: string
  noConversionUnits: string[]
  onClose: () => void
  onNombreChange: (value: string) => void
  onRendimientoChange: (value: number | string) => void
  onModeChange: (mode: RecipeOutputMode) => void
  onProductChange: (productId: string) => void
  onCreatedProduct: (product: { id: string; nombre: string }) => void
  onBusquedaChange: (value: string) => void
  onAddItem: (productoId: string) => void
  onUpdateItem: (productoId: string, patch: Partial<RecipeEditorItem>) => void
  onRemoveItem: (productoId: string) => void
  onSubmit: () => void
  onCancel: () => void
}

/**
 * @description Dialog de edición/creación de recetas de producción.
 * @param {RecipeEditorDialogProps} props - Props del componente.
 * @returns {JSX.Element} Dialog de editor de receta.
 */
export function RecipeEditorDialog({
  open,
  nombreReceta,
  rendimiento,
  selectedProducto,
  outputMode,
  createdOutputProductName,
  productosTyped,
  busquedaProductos,
  nuevoItems,
  newRecipePreview,
  unitOptionNone,
  noConversionUnits,
  onClose,
  onNombreChange,
  onRendimientoChange,
  onModeChange,
  onProductChange,
  onCreatedProduct,
  onBusquedaChange,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onSubmit,
  onCancel,
}: RecipeEditorDialogProps): React.JSX.Element {
  const productOptions = productosTyped?.map((product) => ({ id: product.id, nombre: product.nombre })) || []

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Nueva Receta de Producción</DialogTitle>
          <DialogDescription>Define una receta para producir productos del inventario</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4 space-y-6">
          <div className="space-y-4 border-b pb-4">
            <h3 className="font-semibold text-sm">Información General</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nombre">Nombre de la Receta</Label>
                <Input id="nombre" value={nombreReceta} onChange={(e) => onNombreChange(e.target.value)} placeholder="Ej: Refresco Instantáneo 1L" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rendimiento">Rendimiento (unidades)</Label>
                <Input
                  id="rendimiento"
                  type="number"
                  min={1}
                  value={rendimiento}
                  onChange={(e) => {
                    const val = e.target.value
                    onRendimientoChange(val === '' ? '' : Math.max(1, parseInt(val)))
                  }}
                  placeholder="1"
                />
              </div>
            </div>
            <RecipeOutputSelector
              createdProductName={createdOutputProductName}
              onCreatedProduct={onCreatedProduct}
              onModeChange={onModeChange}
              onProductChange={onProductChange}
              products={productOptions}
              selectedMode={outputMode}
              selectedProductId={selectedProducto}
            />
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Agregar Productos a la Receta</h3>
            <div className="grid gap-2">
              <Label htmlFor="busqueda">Buscar Productos</Label>
              <Input
                id="busqueda"
                placeholder="Escribe el nombre del producto..."
                value={busquedaProductos}
                onChange={(e) => onBusquedaChange(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3 bg-muted/30">
              {productosTyped?.filter((p) => !nuevoItems.find((i) => i.productoId === p.id)).length === 0 ? (
                <div className="col-span-2 text-center text-sm text-muted-foreground py-4">
                  {busquedaProductos ? 'No se encontraron productos' : 'Comienza a escribir para buscar...'}
                </div>
              ) : (
                productosTyped?.filter((p) => !nuevoItems.find((i) => i.productoId === p.id)).map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    className="justify-start text-left h-auto py-2 px-3 text-xs"
                    onClick={() => {
                      onAddItem(p.id)
                      onBusquedaChange('')
                    }}
                  >
                    <div className="flex flex-col gap-0.5 w-full">
                      <span className="text-xs font-medium">{p.nombre}</span>
                      <span className="text-xs text-muted-foreground">${p.precioCosto} (Stock: {p.stock})</span>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </div>

          {nuevoItems.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-semibold text-sm">Productos Agregados ({nuevoItems.length})</h3>
              <div className="rounded-md border overflow-x-auto max-h-48 overflow-y-auto">
                <Table className="text-xs">
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow>
                      <TableHead className="text-xs">Producto</TableHead>
                      <TableHead className="text-xs">Cantidad</TableHead>
                      <TableHead className="text-xs">Unidad</TableHead>
                      <TableHead className="text-xs">Desperdicio</TableHead>
                      <TableHead className="text-right text-xs">Quitar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nuevoItems.map((item) => {
                      const prod = productosTyped?.find((p) => p.id === item.productoId)
                      const previewRow = newRecipePreview.rows.find((row) => row.productoId === item.productoId) || {
                        blockingMessage: null,
                        normalizationMessage: null,
                      }
                      return (
                        <TableRow key={item.productoId} className="text-xs">
                          <TableCell className="text-xs whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>{prod?.nombre}</span>
                              {previewRow.blockingMessage && (
                                <span className="text-yellow-600 text-lg" title={previewRow.blockingMessage}>⚠️</span>
                              )}
                              {!previewRow.blockingMessage && previewRow.normalizationMessage && (
                                <span className="text-blue-600 text-lg" title={previewRow.normalizationMessage}>ℹ️</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={item.cantidad}
                              onChange={(e) => onUpdateItem(item.productoId, { cantidad: parseFloat(e.target.value) || 1 })}
                              className="w-20 text-xs h-7"
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            <Select
                              value={item.unidadSimbolo ?? unitOptionNone}
                              onValueChange={(value) => onUpdateItem(item.productoId, { unidadSimbolo: value === unitOptionNone ? null : value })}
                            >
                              <SelectTrigger className="w-24 text-xs h-7">
                                <SelectValue placeholder="Sin unidad" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={unitOptionNone}>Sin unidad</SelectItem>
                                {MASS_UNITS.map((unit) => (
                                  <SelectItem key={`mass-${unit}`} value={unit}>{unit}</SelectItem>
                                ))}
                                {VOLUME_UNITS.map((unit) => (
                                  <SelectItem key={`volume-${unit}`} value={unit}>{unit}</SelectItem>
                                ))}
                                {noConversionUnits.map((unit) => (
                                  <SelectItem key={`plain-${unit}`} value={unit}>{unit}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              type="number"
                              min={0}
                              max={1}
                              step={0.01}
                              value={item.desperdicio}
                              onChange={(e) => onUpdateItem(item.productoId, { desperdicio: parseFloat(e.target.value) || 0 })}
                              className="w-20 text-xs h-7"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveItem(item.productoId)}>
                              <span className="h-3 w-3">×</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t pt-4 shrink-0">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={onSubmit}>Crear Receta</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
