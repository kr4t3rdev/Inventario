import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RecetaProduccion } from '@/app/models/model'
import { formatIngrediente } from '@/lib/utils/unit-converter'

export interface ProductionRecipeDeleteTarget {
  recetaId: string
  nombre: string
}

export interface ProductionOrderConfirmation {
  tipo: 'aprobar' | 'completar' | 'cancelar'
  ordenId: string
  recetaNombre: string
  cantidad: number
}

export interface ProductionDialogsProps {
  recetaVer: RecetaProduccion | null
  recetaEliminar: ProductionRecipeDeleteTarget | null
  confirmacion: ProductionOrderConfirmation | null
  onCloseView: () => void
  onCloseDelete: () => void
  onCloseConfirmation: () => void
  onDeleteRecipe: (recetaId: string) => void
  onConfirmApprove: (ordenId: string) => void
  onConfirmComplete: (ordenId: string) => void
  onConfirmCancel: (ordenId: string) => void
}

/**
 * @description Dialogs auxiliares del módulo de producción para ver receta y confirmar acciones.
 * @param {ProductionDialogsProps} props - Props del componente.
 * @returns {JSX.Element} Conjunto de diálogos auxiliares.
 */
export function ProductionDialogs({
  recetaVer,
  recetaEliminar,
  confirmacion,
  onCloseView,
  onCloseDelete,
  onCloseConfirmation,
  onDeleteRecipe,
  onConfirmApprove,
  onConfirmComplete,
  onConfirmCancel,
}: ProductionDialogsProps): JSX.Element {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'CUP',
    }).format(amount)
  }

  return (
    <>
      <Dialog open={recetaVer !== null} onOpenChange={(open) => { if (!open) onCloseView() }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{recetaVer?.nombre}</DialogTitle>
            <DialogDescription>Detalle completo de la receta de producción</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium">Rendimiento:</span> {recetaVer?.rendimiento} unidad(es)</div>
              <div><span className="font-medium">Producto asociado:</span> {recetaVer?.producto?.nombre || '—'}</div>
              <div><span className="font-medium">Instrucciones:</span> {recetaVer?.instrucciones || 'No especificado'}</div>
              <div><span className="font-medium">Tiempo de prep.:</span> {recetaVer?.tiempoPrep ? `${recetaVer.tiempoPrep} min` : 'No especificado'}</div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Ingredientes</p>
              {recetaVer?.ingredientes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ingredientes definidos</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Desperdicio</TableHead>
                        <TableHead className="text-right">Costo estimado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recetaVer?.ingredientes.map((ing) => (
                        <TableRow key={ing.productoId}>
                          <TableCell>{ing.producto?.nombre}</TableCell>
                          <TableCell>{formatIngrediente(ing.cantidad, ing.unidadSimbolo, '').trim()}</TableCell>
                          <TableCell>{((ing.desperdicio ?? 0) * 100).toFixed(0)}%</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency((ing.producto?.precioCosto ?? 0) * ing.cantidad * (1 + (ing.desperdicio ?? 0)))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-2 border-t text-sm">
              <span className="font-medium">Costo unitario total</span>
              <span className="font-bold">{formatCurrency(recetaVer?.costoUnitario || 0)}</span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onCloseView}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={recetaEliminar !== null} onOpenChange={(open) => { if (!open) onCloseDelete() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar receta</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar la receta <strong>{recetaEliminar?.nombre}</strong>? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCloseDelete}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (recetaEliminar) onDeleteRecipe(recetaEliminar.recetaId) }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmacion !== null} onOpenChange={(open) => { if (!open) onCloseConfirmation() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmacion?.tipo === 'aprobar' && 'Aprobar orden de producción'}
              {confirmacion?.tipo === 'completar' && 'Completar orden de producción'}
              {confirmacion?.tipo === 'cancelar' && 'Cancelar orden de producción'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacion?.tipo === 'aprobar' && (
                <>¿Confirmar aprobación de <strong>{confirmacion.recetaNombre}</strong> (cantidad: {confirmacion.cantidad})? Se reservarán los materiales del inventario.</>
              )}
              {confirmacion?.tipo === 'completar' && (
                <>¿Confirmar que la producción de <strong>{confirmacion?.recetaNombre}</strong> está terminada? Se incrementará el stock del producto terminado.</>
              )}
              {confirmacion?.tipo === 'cancelar' && (
                <>¿Cancelar la orden de <strong>{confirmacion?.recetaNombre}</strong>? Si estaba en proceso, los materiales reservados serán liberados al inventario.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCloseConfirmation}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmacion) return
                if (confirmacion.tipo === 'aprobar') onConfirmApprove(confirmacion.ordenId)
                if (confirmacion.tipo === 'completar') onConfirmComplete(confirmacion.ordenId)
                if (confirmacion.tipo === 'cancelar') onConfirmCancel(confirmacion.ordenId)
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
