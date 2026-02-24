'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Star, 
  Trash2, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import type { EscenarioGuardado } from '@/types/exchange-intelligence'
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

interface SavedScenariosListProps {
  on_scenario_select: (escenario: EscenarioGuardado) => void
  usuario_id?: string
}

/**
 * @description Componente para listar y gestionar escenarios guardados
 * @param on_scenario_select - Callback cuando se selecciona un escenario
 * @param usuario_id - ID del usuario para filtrar escenarios
 * @returns Lista de escenarios guardados con opciones de gestión
 */
export function SavedScenariosList({
  on_scenario_select,
  usuario_id 
}: SavedScenariosListProps) {
  const [escenarios, set_escenarios] = useState<EscenarioGuardado[]>([])
  const [loading, set_loading] = useState(true)
  const [error, set_error] = useState<string | null>(null)
  const [escenario_a_eliminar, set_escenario_a_eliminar] = useState<string | null>(null)
  const [eliminando, set_eliminando] = useState(false)

  /**
   * @description Carga los escenarios guardados desde la API
   */
  const cargar_escenarios = useCallback(async () => {
    try {
      set_loading(true)
      set_error(null)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No hay sesión activa')
      }

      const params = new URLSearchParams()
      if (usuario_id) {
        params.append('usuario_id', usuario_id)
      }

      const response = await fetch(
        `/api/contabilidad/exchange/scenarios?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Error al cargar escenarios')
      }

      const data = await response.json()
      set_escenarios(data.escenarios || [])

    } catch (err) {
      console.error('Error al cargar escenarios:', err)
      set_error(err instanceof Error ? err.message : 'Error desconocido')
      toast.error('Error al cargar escenarios guardados')
    } finally {
      set_loading(false)
    }
  }, [usuario_id])

  /**
   * @description Elimina un escenario
   * @param escenario_id - ID del escenario a eliminar
   */
  const eliminar_escenario = async (escenario_id: string) => {
    try {
      set_eliminando(true)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No hay sesión activa')
      }

      const response = await fetch(
        `/api/contabilidad/exchange/scenarios/${escenario_id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Error al eliminar escenario')
      }

      toast.success('Escenario eliminado exitosamente')
      
      // Recargar lista
      await cargar_escenarios()

    } catch (err) {
      console.error('Error al eliminar escenario:', err)
      toast.error('Error al eliminar escenario')
    } finally {
      set_eliminando(false)
      set_escenario_a_eliminar(null)
    }
  }

  /**
   * @description Marca/desmarca un escenario como favorito
   * @param escenario_id - ID del escenario
   * @param es_favorito - Nuevo estado de favorito
   */
  const toggle_favorito = async (escenario_id: string, es_favorito: boolean) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No hay sesión activa')
      }

      const response = await fetch(
        `/api/contabilidad/exchange/scenarios/${escenario_id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ es_favorito })
        }
      )

      if (!response.ok) {
        throw new Error('Error al actualizar favorito')
      }

      // Actualizar estado local
      set_escenarios(prev => 
        prev.map(esc => 
          esc.id === escenario_id 
            ? { ...esc, esFavorito: es_favorito }
            : esc
        )
      )

      toast.success(es_favorito ? 'Marcado como favorito' : 'Removido de favoritos')

    } catch (err) {
      console.error('Error al actualizar favorito:', err)
      toast.error('Error al actualizar favorito')
    }
  }

  /**
   * @description Formatea las tasas simuladas para mostrar
   * @param tasas - Objeto con tasas por moneda
   * @returns String formateado con las tasas
   */
  const formatear_tasas = (tasas: Record<string, number>): string => {
    return Object.entries(tasas)
      .map(([moneda, tasa]) => `${moneda}: ${tasa.toFixed(2)}`)
      .join(', ')
  }

  /**
   * @description Calcula el cambio porcentual de utilidad
   * @param resultados - Resultados de la simulación
   * @returns Cambio porcentual o null
   */
  const calcular_cambio_utilidad = (resultados: any): number | null => {
    if (!resultados || typeof resultados !== 'object') return null
    return resultados.cambio_utilidad_porcentual || null
  }

  useEffect(() => {
    cargar_escenarios()
  }, [cargar_escenarios])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button 
          variant="outline" 
          onClick={cargar_escenarios}
          className="mt-4"
        >
          Reintentar
        </Button>
      </div>
    )
  }

  if (escenarios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground mb-2">
          No hay escenarios guardados
        </p>
        <p className="text-xs text-muted-foreground">
          Crea una simulación y guárdala para verla aquí
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {escenarios.map((escenario) => {
          const cambio_utilidad = calcular_cambio_utilidad(escenario.resultados)
          const es_positivo = cambio_utilidad !== null && cambio_utilidad > 0

          return (
            <Card 
              key={escenario.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => on_scenario_select(escenario)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        {escenario.nombre}
                      </CardTitle>
                      {escenario.esFavorito && (
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      )}
                    </div>
                    {escenario.descripcion && (
                      <CardDescription className="mt-1">
                        {escenario.descripcion}
                      </CardDescription>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggle_favorito(escenario.id, !escenario.esFavorito)}
                    >
                      <Star 
                        className={`h-4 w-4 ${
                          escenario.esFavorito 
                            ? 'fill-yellow-400 text-yellow-400' 
                            : 'text-muted-foreground'
                        }`} 
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => set_escenario_a_eliminar(escenario.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Tasas simuladas */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Tasas simuladas:
                  </p>
                  <p className="text-sm font-mono">
                    {formatear_tasas(escenario.tasasSimuladas)}
                  </p>
                </div>

                {/* Cambio de utilidad */}
                {cambio_utilidad !== null && (
                  <div className="flex items-center gap-2">
                    {es_positivo ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${
                      es_positivo ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {es_positivo ? '+' : ''}{cambio_utilidad.toFixed(2)}% utilidad
                    </span>
                  </div>
                )}

                {/* Etiquetas */}
                {escenario.etiquetas && escenario.etiquetas.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {escenario.etiquetas.map((etiqueta, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {etiqueta}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Fecha */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    Creado: {format(new Date(escenario.fechaCreacion), 'PPP')}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog 
        open={escenario_a_eliminar !== null} 
        onOpenChange={(open) => !open && set_escenario_a_eliminar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar escenario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El escenario será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminando}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => escenario_a_eliminar && eliminar_escenario(escenario_a_eliminar)}
              disabled={eliminando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {eliminando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
