'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Percent, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  bulkApplyPercentageAction,
  bulkApplyTemplateAction,
} from '@/features/ficha-costo/actions-bulk'
import type { BulkPriceResponse, BulkPriceError } from '@/features/ficha-costo/actions-bulk'

interface BulkPriceManagerProps {
  productoIds: string[]
}

/**
 * @description Componente cliente para actualización masiva de precios.
 *   Permite seleccionar productos y aplicar un porcentaje de ajuste o
 *   una plantilla de costos a todos ellos de una vez.
 */
export function BulkPriceManager({ productoIds }: BulkPriceManagerProps) {
  const router = useRouter()
  const [percentageDialogOpen, setPercentageDialogOpen] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [percentage, setPercentage] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<BulkPriceResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleApplyPercentage() {
    if (!percentage || isNaN(Number(percentage))) {
      setError('Porcentaje inválido')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await bulkApplyPercentageAction({
        porcentaje: Number(percentage),
        productoIds,
      })

      if (res.success) {
        setResult(res.data)
        setPercentageDialogOpen(false)
        setPercentage('')
      } else {
        setError(res.error?.message || 'Error aplicando porcentaje')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleApplyTemplate() {
    if (!templateId) {
      setError('Debe seleccionar una plantilla')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await bulkApplyTemplateAction({
        plantillaId: templateId,
        productoIds,
      })

      if (res.success) {
        setResult(res.data)
        setTemplateDialogOpen(false)
        setTemplateId('')
      } else {
        setError(res.error?.message || 'Error aplicando plantilla')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetResult() {
    setResult(null)
    router.refresh()
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-6">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Operación completada</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Actualizados</div>
                  <div className="text-2xl font-bold text-green-600">{result.updated}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Saltados</div>
                  <div className="text-2xl font-bold text-yellow-600">{result.skipped.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Errores</div>
                  <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h4 className="font-semibold mb-2 text-red-900">Errores detallados</h4>
            <ul className="space-y-1 text-sm text-red-800">
              {result.errors.map((err: BulkPriceError, idx: number) => (
                <li key={idx}>
                  <span className="font-mono">{err.productoId}</span>: {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button onClick={resetResult}>Cerrar y volver</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            Cerrar
          </Button>
        </div>
      )}

      <div className="rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Actualizar {productoIds.length} productos</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Seleccione el tipo de actualización masiva que desea aplicar.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-start gap-2"
            onClick={() => setPercentageDialogOpen(true)}
            disabled={isSubmitting}
          >
            <Percent className="h-6 w-6" />
            <div className="text-left">
              <div className="font-semibold">Ajuste porcentual</div>
              <div className="text-xs text-muted-foreground">
                Aplicar +X% o -X% a todos los productos seleccionados
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-start gap-2"
            onClick={() => setTemplateDialogOpen(true)}
            disabled={isSubmitting}
          >
            <FileText className="h-6 w-6" />
            <div className="text-left">
              <div className="font-semibold">Aplicar plantilla</div>
              <div className="text-xs text-muted-foreground">
                Usar el precio sugerido de una plantilla de costos
              </div>
            </div>
          </Button>
        </div>
      </div>

      {/* Dialog: Ajuste porcentual */}
      <Dialog open={percentageDialogOpen} onOpenChange={setPercentageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste porcentual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="percentage">Porcentaje (%)</Label>
              <Input
                id="percentage"
                type="number"
                step="0.01"
                placeholder="Ej: 10 para +10%, -5 para -5%"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Valores positivos aumentan el precio, negativos lo disminuyen.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPercentageDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleApplyPercentage} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aplicar a {productoIds.length} productos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Aplicar plantilla */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar plantilla de costos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateId">ID de plantilla</Label>
              <Input
                id="templateId"
                type="text"
                placeholder="ID de la plantilla activa"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Ingrese el ID de la plantilla de costos que desea aplicar.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTemplateDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleApplyTemplate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aplicar a {productoIds.length} productos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
