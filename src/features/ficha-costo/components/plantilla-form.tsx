'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Calculator } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { PlantillaCosto, LineItem, CategoriaCosto } from '../types'
import {
  CATEGORIAS_COSTO,
  lineItemTotal,
  calcularTotalLineItems,
  calcularTotalesPorCategoria,
} from '../types'
import { calcularPrecioSugerido } from '../lib/template-calc'

interface PlantillaFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plantilla?: PlantillaCosto | null
  productoId: string
  onSubmit: (data: any) => void | Promise<void>
  isSubmitting: boolean
}

let lineItemCounter = 0
function newLineItem(categoria: CategoriaCosto = 'materiales'): LineItem {
  lineItemCounter += 1
  return {
    id: `new_${lineItemCounter}_${Date.now()}`,
    concepto: '',
    descripcion: '',
    cantidad: 1,
    costoUnitario: 0,
    categoria,
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function PlantillaForm({
  open,
  onOpenChange,
  plantilla,
  productoId,
  onSubmit,
  isSubmitting,
}: PlantillaFormProps) {
  const esEdicion = Boolean(plantilla)
  const [nombre, setNombre] = useState(plantilla?.nombre ?? '')
  const [lineItems, setLineItems] = useState<LineItem[]>(
    plantilla?.lineItems?.length
      ? plantilla.lineItems
      : plantilla
        ? [
            { id: 'legacy_mat', concepto: 'Materiales', cantidad: 1, costoUnitario: plantilla.costoMateriales, categoria: 'materiales' as CategoriaCosto },
            { id: 'legacy_mo', concepto: 'Mano de obra', cantidad: 1, costoUnitario: plantilla.costoManoObra, categoria: 'mano-obra' as CategoriaCosto },
            { id: 'legacy_ind', concepto: 'Costos indirectos', cantidad: 1, costoUnitario: plantilla.costoIndirectos, categoria: 'indirectos' as CategoriaCosto },
          ].filter(i => i.costoUnitario > 0)
        : [newLineItem('materiales')],
  )
  const [margenObjetivo, setMargenObjetivo] = useState(
    plantilla?.margenObjetivo?.toString() ?? '0.30',
  )
  const [notas, setNotas] = useState(plantilla?.userNotes ?? '')
  const [error, setError] = useState<string | null>(null)

  const costeTotal = calcularTotalLineItems(lineItems)
  const parsedMargenObjetivo = Number.parseFloat(margenObjetivo)
  const margenObjetivoPreview =
    Number.isFinite(parsedMargenObjetivo) &&
    parsedMargenObjetivo > 0 &&
    parsedMargenObjetivo < 1
      ? parsedMargenObjetivo
      : 0.3
  const precioSugerido = calcularPrecioSugerido(costeTotal, margenObjetivoPreview)
  const catTotales = calcularTotalesPorCategoria(lineItems)

  function addItem() {
    setLineItems([...lineItems, newLineItem('materiales')])
  }

  function removeItem(id: string) {
    setLineItems(lineItems.filter((i) => i.id !== id))
  }

  function updateItem(id: string, field: keyof LineItem, value: any) {
    setLineItems(
      lineItems.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const nombreTrim = nombre.trim()
    if (!nombreTrim) {
      setError('El nombre es obligatorio')
      return
    }

    // Validate line items
    const validItems = lineItems.filter((i) => i.concepto.trim() && i.costoUnitario > 0)
    if (validItems.length === 0) {
      setError('Agregá al menos un concepto con costo unitario > 0')
      return
    }

    const mo = parseFloat(margenObjetivo)
    if (Number.isNaN(mo) || mo <= 0 || mo >= 1) {
      setError('El margen objetivo debe estar entre 0 y 1 (ej: 0.30 = 30%)')
      return
    }

    if (esEdicion && plantilla) {
      onSubmit({
        plantillaId: plantilla.id,
        nombre: nombreTrim,
        margenObjetivo: mo,
        notas: notas || undefined,
        lineItems: validItems,
      })
    } else {
      onSubmit({
        productoId,
        nombre: nombreTrim,
        margenObjetivo: mo,
        notas: notas || undefined,
        lineItems: validItems,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? 'Editar Ficha de Costo' : 'Nueva Ficha de Costo'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto max-h-[calc(90vh-10rem)] pr-2">
          {/* Nombre */}
          <div className="grid gap-2">
            <Label htmlFor="nombre">Nombre de la ficha *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Ficha de costo estándar"
            />
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                Detalle de costos
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar concepto
              </Button>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Concepto</TableHead>
                    <TableHead className="w-[140px]">Categoría</TableHead>
                    <TableHead className="w-[60px] text-right">Cant.</TableHead>
                    <TableHead className="w-[100px] text-right">Costo unit.</TableHead>
                    <TableHead className="w-[100px] text-right">Total</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          value={item.concepto}
                          onChange={(e) => updateItem(item.id, 'concepto', e.target.value)}
                          placeholder="Ej: Harina, Transporte..."
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.categoria}
                          onValueChange={(v) => updateItem(item.id, 'categoria', v)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIAS_COSTO.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.cantidad}
                          onChange={(e) => updateItem(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.costoUnitario || ''}
                          onChange={(e) => updateItem(item.id, 'costoUnitario', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {fmt(lineItemTotal(item))}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-500"
                          onClick={() => removeItem(item.id)}
                          disabled={lineItems.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Resumen de costos por categoría */}
          {lineItems.some(i => i.costoUnitario > 0) && (
            <div className="bg-muted/30 rounded-lg border p-4 space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Resumen por categoría
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIAS_COSTO.filter(c => (catTotales[c.value] ?? 0) > 0).map((cat) => (
                  <div key={cat.value} className="flex justify-between text-sm px-2 py-1 rounded bg-background">
                    <span className="text-muted-foreground">{cat.label}:</span>
                    <span className="font-medium">${fmt(catTotales[cat.value])}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                <span>Costo total:</span>
                <span>${fmt(costeTotal)}</span>
              </div>
            </div>
          )}

          {/* Margen y precio sugerido */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="margen">Margen objetivo</Label>
              <div className="relative">
                <Input
                  id="margen"
                  type="number"
                  min="0.01"
                  max="0.99"
                  step="0.01"
                  value={margenObjetivo}
                  onChange={(e) => setMargenObjetivo(e.target.value)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  %
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Ej: 0.30 = 30% de margen sobre precio de venta
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Precio de venta sugerido</Label>
              <div className="text-2xl font-bold text-emerald-600">
                ${fmt(precioSugerido)}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Calculado como costo / (1 - margen). Con {(
                  margenObjetivoPreview * 100
                ).toFixed(0)}
                % de margen objetivo.
              </p>
            </div>
          </div>

          {/* Notas */}
          <div className="grid gap-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas opcionales sobre esta ficha de costo..."
              rows={2}
            />
          </div>

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 rounded-lg border border-rose-200 p-3">
              {error}
            </div>
          )}

          <DialogFooter className="border-t pt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear ficha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
