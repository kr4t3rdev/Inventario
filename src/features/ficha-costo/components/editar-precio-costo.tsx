'use client'

import { useState, useTransition } from 'react'
import { Pencil, Loader2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { updatePrecioCostoAction } from '../actions'

interface EditarPrecioCostoProps {
  productoId: string
  precioCostoInicial: number
  onUpdated?: (nuevo: number) => void
}

/**
 * @description Botón que abre un mini-form para editar el `precioCosto`
 *   del producto. Solo el rol manager puede persistir el cambio (la
 *   server action valida el rol y registra el cambio en
 *   `ProductoCostHistory`).
 */
export function EditarPrecioCosto({
  productoId,
  precioCostoInicial,
  onUpdated,
}: EditarPrecioCostoProps) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(String(precioCostoInicial))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function iniciarEdicion() {
    setValor(String(precioCostoInicial))
    setError(null)
    setEditando(true)
  }

  function cancelar() {
    setEditando(false)
    setError(null)
  }

  function guardar() {
    setError(null)
    const n = Number(valor)
    if (!Number.isFinite(n) || n < 0) {
      setError('El precio de costo debe ser un número ≥ 0')
      return
    }
    if (n === precioCostoInicial) {
      setEditando(false)
      return
    }
    startTransition(async () => {
      const res = await updatePrecioCostoAction({ productoId, precioCosto: n })
      if (!res.success) {
        setError(res.error?.message ?? 'Error al guardar')
        return
      }
      toast.success('Precio de costo actualizado')
      onUpdated?.(res.data.precioCosto)
      setEditando(false)
    })
  }

  if (!editando) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={iniciarEdicion}
        className="gap-1"
        aria-label="Editar precio de costo"
      >
        <Pencil className="h-3.5 w-3.5" />
        Editar
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="space-y-1">
          <Label htmlFor={`precio-costo-${productoId}`} className="sr-only">
            Nuevo precio de costo
          </Label>
          <Input
            id={`precio-costo-${productoId}`}
            type="number"
            min={0}
            step="1"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-32"
            autoFocus
            disabled={isPending}
          />
        </div>
        <Button
          onClick={guardar}
          size="sm"
          disabled={isPending}
          className="gap-1"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Guardar
        </Button>
        <Button
          onClick={cancelar}
          size="sm"
          variant="ghost"
          disabled={isPending}
          className="gap-1"
        >
          <X className="h-3.5 w-3.5" />
          Cancelar
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
