'use client'

import { useState, ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CostHistoryTable } from './cost-history-table'
import { TrendingUp } from 'lucide-react'

/**
 * @description Props para CostHistoryDialog
 */
interface CostHistoryDialogProps {
  /**
   * ID del producto
   */
  productoId: string
  /**
   * Nombre del producto
   */
  productoNombre: string
  /**
   * Trigger button o elemento personalizado
   */
  trigger?: ReactNode
}

/**
 * @description Diálogo modal para ver el historial de cambios de costos del producto
 * @param {CostHistoryDialogProps} props - Props del componente
 * @returns {JSX.Element} Dialog con tabla de historial
 */
export function CostHistoryDialog({
  productoId,
  productoNombre,
  trigger,
}: CostHistoryDialogProps): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/50 px-3 py-2 text-sm hover:bg-muted/50">
            <TrendingUp className="h-4 w-4" />
            Historial de costos
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Historial de cambios de costos</DialogTitle>
          <DialogDescription>
            Registro completo de cambios en precios de costo y venta para{' '}
            <strong>{productoNombre}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <CostHistoryTable productoId={productoId} className="w-full" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
