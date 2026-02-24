'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { TasasSimuladas, SimulationResult } from '@/types/exchange-intelligence'
import type { SimulateScenarioResponse } from '@/lib/types/exchange-intelligence'

interface SaveScenarioDialogProps {
  open: boolean
  on_open_change: (open: boolean) => void
  tasas_simuladas: TasasSimuladas
  fecha_proyeccion: string
  resultados: SimulationResult | SimulateScenarioResponse
  on_save_success: () => void
}

/**
 * @description Dialog para guardar un escenario de simulación
 * @param open - Estado de apertura del dialog
 * @param on_open_change - Callback para cambiar estado de apertura
 * @param tasas_simuladas - Tasas de cambio simuladas
 * @param fecha_proyeccion - Fecha de proyección del escenario
 * @param resultados - Resultados de la simulación
 * @param on_save_success - Callback cuando se guarda exitosamente
 * @returns Dialog para guardar escenario
 */
export function SaveScenarioDialog({
  open,
  on_open_change,
  tasas_simuladas,
  fecha_proyeccion,
  resultados,
  on_save_success
}: SaveScenarioDialogProps) {
  const [nombre, set_nombre] = useState('')
  const [descripcion, set_descripcion] = useState('')
  const [etiquetas_input, set_etiquetas_input] = useState('')
  const [etiquetas, set_etiquetas] = useState<string[]>([])
  const [es_favorito, set_es_favorito] = useState(false)
  const [guardando, set_guardando] = useState(false)

  /**
   * @description Agrega una etiqueta a la lista
   */
  const agregar_etiqueta = () => {
    const etiqueta = etiquetas_input.trim()
    if (etiqueta && !etiquetas.includes(etiqueta)) {
      set_etiquetas([...etiquetas, etiqueta])
      set_etiquetas_input('')
    }
  }

  /**
   * @description Elimina una etiqueta de la lista
   * @param etiqueta - Etiqueta a eliminar
   */
  const eliminar_etiqueta = (etiqueta: string) => {
    set_etiquetas(etiquetas.filter(e => e !== etiqueta))
  }

  /**
   * @description Maneja el evento de tecla en el input de etiquetas
   * @param e - Evento de teclado
   */
  const handle_etiqueta_key_down = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      agregar_etiqueta()
    }
  }

  /**
   * @description Guarda el escenario
   */
  const guardar_escenario = async () => {
    if (!nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    try {
      set_guardando(true)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No hay sesión activa')
      }

      const response = await fetch('/api/contabilidad/exchange/scenarios', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          tasas_simuladas,
          fecha_proyeccion,
          resultados,
          alertas: resultados.alertas_generadas,
          etiquetas: etiquetas.length > 0 ? etiquetas : undefined,
          es_favorito
        })
      })

      if (!response.ok) {
        const error_data = await response.json()
        throw new Error(error_data.error || 'Error al guardar escenario')
      }

      toast.success('Escenario guardado exitosamente')
      
      // Limpiar formulario
      set_nombre('')
      set_descripcion('')
      set_etiquetas([])
      set_etiquetas_input('')
      set_es_favorito(false)
      
      // Cerrar dialog y notificar éxito
      on_open_change(false)
      on_save_success()

    } catch (err) {
      console.error('Error al guardar escenario:', err)
      toast.error(err instanceof Error ? err.message : 'Error al guardar escenario')
    } finally {
      set_guardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={on_open_change}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Guardar Escenario</DialogTitle>
          <DialogDescription>
            Guarda este escenario de simulación para consultarlo más tarde
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="nombre">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nombre"
              placeholder="Ej: Escenario optimista Q1 2025"
              value={nombre}
              onChange={(e) => set_nombre(e.target.value)}
              disabled={guardando}
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              placeholder="Describe el escenario y sus supuestos..."
              value={descripcion}
              onChange={(e) => set_descripcion(e.target.value)}
              disabled={guardando}
              rows={3}
            />
          </div>

          {/* Etiquetas */}
          <div className="space-y-2">
            <Label htmlFor="etiquetas">Etiquetas</Label>
            <div className="flex gap-2">
              <Input
                id="etiquetas"
                placeholder="Agregar etiqueta..."
                value={etiquetas_input}
                onChange={(e) => set_etiquetas_input(e.target.value)}
                onKeyDown={handle_etiqueta_key_down}
                disabled={guardando}
              />
              <Button
                type="button"
                variant="outline"
                onClick={agregar_etiqueta}
                disabled={guardando || !etiquetas_input.trim()}
              >
                Agregar
              </Button>
            </div>
            {etiquetas.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {etiquetas.map((etiqueta, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1">
                    {etiqueta}
                    <button
                      onClick={() => eliminar_etiqueta(etiqueta)}
                      className="ml-1 hover:text-destructive"
                      disabled={guardando}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Favorito */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="favorito"
              checked={es_favorito}
              onChange={(e) => set_es_favorito(e.target.checked)}
              disabled={guardando}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="favorito" className="cursor-pointer">
              Marcar como favorito
            </Label>
          </div>

          {/* Resumen de tasas */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <p className="text-sm font-medium mb-2">Tasas simuladas:</p>
            <div className="space-y-1">
              {Object.entries(tasas_simuladas).map(([moneda, tasa]) => (
                <div key={moneda} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{moneda}:</span>
                  <span className="font-mono">{tasa.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => on_open_change(false)}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button
            onClick={guardar_escenario}
            disabled={guardando || !nombre.trim()}
          >
            {guardando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Escenario'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
