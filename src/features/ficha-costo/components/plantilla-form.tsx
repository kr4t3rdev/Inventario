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
import type { PlantillaCosto, PlantillaCostoInput, UpdatePlantillaInput } from '../types'

interface PlantillaFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plantilla?: PlantillaCosto | null
  productoId: string
  onSubmit: (data: PlantillaCostoInput | UpdatePlantillaInput) => void | Promise<void>
  isSubmitting: boolean
}

/**
 * @description Formulario modal para crear o editar una plantilla de
 *   ficha de costo. Valida que el margen esté entre 0 y 1 y que el
 *   nombre no esté vacío.
 */
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
  const [costoMateriales, setCostoMateriales] = useState(
    plantilla?.costoMateriales?.toString() ?? '',
  )
  const [costoManoObra, setCostoManoObra] = useState(
    plantilla?.costoManoObra?.toString() ?? '',
  )
  const [costoIndirectos, setCostoIndirectos] = useState(
    plantilla?.costoIndirectos?.toString() ?? '',
  )
  const [margenObjetivo, setMargenObjetivo] = useState(
    plantilla?.margenObjetivo?.toString() ?? '0.30',
  )
  const [notas, setNotas] = useState(plantilla?.notas ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const nombreTrim = nombre.trim()
    if (!nombreTrim) {
      setError('El nombre es obligatorio')
      return
    }

    const cm = parseFloat(costoMateriales)
    const cmo = parseFloat(costoManoObra)
    const ci = parseFloat(costoIndirectos)
    const mo = parseFloat(margenObjetivo)

    if (Number.isNaN(cm) || Number.isNaN(cmo) || Number.isNaN(ci) || Number.isNaN(mo)) {
      setError('Todos los campos numéricos son obligatorios')
      return
    }
    if (mo <= 0 || mo >= 1) {
      setError('El margen objetivo debe estar entre 0 y 1 (ej: 0.30 = 30%)')
      return
    }

    if (esEdicion && plantilla) {
      onSubmit({
        plantillaId: plantilla.id,
        nombre: nombreTrim,
        costoMateriales: cm,
        costoManoObra: cmo,
        costoIndirectos: ci,
        margenObjetivo: mo,
        notas: notas || undefined,
      })
    } else {
      onSubmit({
        productoId,
        nombre: nombreTrim,
        costoMateriales: cm,
        costoManoObra: cmo,
        costoIndirectos: ci,
        margenObjetivo: mo,
        notas: notas || undefined,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? 'Editar plantilla' : 'Nueva plantilla de costo'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Plantilla estándar 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cm">Materiales</Label>
              <Input
                id="cm"
                type="number"
                step="0.01"
                min="0"
                value={costoMateriales}
                onChange={(e) => setCostoMateriales(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cmo">Mano de obra</Label>
              <Input
                id="cmo"
                type="number"
                step="0.01"
                min="0"
                value={costoManoObra}
                onChange={(e) => setCostoManoObra(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ci">Indirectos</Label>
              <Input
                id="ci"
                type="number"
                step="0.01"
                min="0"
                value={costoIndirectos}
                onChange={(e) => setCostoIndirectos(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mo">Margen objetivo</Label>
              <Input
                id="mo"
                type="number"
                step="0.01"
                min="0.01"
                max="0.99"
                value={margenObjetivo}
                onChange={(e) => setMargenObjetivo(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">Ej: 0.30 = 30%</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones sobre esta versión..."
              rows={3}
            />
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {esEdicion ? 'Guardar cambios' : 'Crear plantilla'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
