/**
 * @description Hook personalizado para gestionar la integración con tesorería
 * Proporciona funciones y estado para sincronización bidireccional
 */

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { DeudaPriorizada } from '@/types/exchange-intelligence'
import type { InyeccionCapital } from '@/app/models/model'

// ============================================================================
// INTERFACES
// ============================================================================

interface TreasuryIntegrationState {
  is_syncing: boolean
  last_sync: Date | null
  pending_updates: number
  sync_errors: string[]
}

interface UseTreasuryIntegrationReturn {
  // Estado
  state: TreasuryIntegrationState
  
  // Acciones
  navigate_to_payment: (deuda_id: string) => void
  prepare_payment_data: (deuda: DeudaPriorizada) => Promise<PrefilledPaymentData | null>
  sync_after_payment: (deuda_id: string, monto: number) => Promise<boolean>
  create_reminder: (deuda_id: string, fecha: Date, mensaje?: string) => Promise<boolean>
  validate_payment: (deuda_id: string) => Promise<boolean>
  
  // Utilidades
  get_navigation_url: (deuda_id: string) => string
  clear_sync_errors: () => void
}

interface PrefilledPaymentData {
  deuda_id: string
  entidad: string
  monto_sugerido: number
  moneda: string
  descripcion: string
  observaciones_recomendadas: string
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * @description Hook para gestionar la integración con el módulo de tesorería
 * @returns Objeto con estado y funciones de integración
 */
export function useTreasuryIntegration(): UseTreasuryIntegrationReturn {
  const router = useRouter()
  
  const [state, set_state] = useState<TreasuryIntegrationState>({
    is_syncing: false,
    last_sync: null,
    pending_updates: 0,
    sync_errors: []
  })

  // ============================================================================
  // FUNCIONES DE NAVEGACIÓN
  // ============================================================================

  /**
   * @description Genera URL de navegación al módulo de capital
   * @param deuda_id - ID de la deuda
   * @returns URL con parámetros
   */
  const get_navigation_url = useCallback((deuda_id: string): string => {
    const params = new URLSearchParams({
      action: 'pagar',
      deuda_id,
      source: 'exchange-intelligence'
    })
    return `/busy/contabilidad/capital?${params.toString()}`
  }, [])

  /**
   * @description Navega al módulo de capital con datos pre-llenados
   * @param deuda_id - ID de la deuda
   */
  const navigate_to_payment = useCallback((deuda_id: string) => {
    const url = get_navigation_url(deuda_id)
    router.push(url)
    
    // Registrar navegación en auditoría
    console.log('[AUDIT] Navegación a módulo de capital desde Exchange Intelligence', {
      deuda_id,
      timestamp: new Date().toISOString(),
      url
    })
  }, [router, get_navigation_url])

  // ============================================================================
  // FUNCIONES DE PREPARACIÓN DE DATOS
  // ============================================================================

  /**
   * @description Prepara datos para pre-llenar el formulario de pago
   * @param deuda - Deuda priorizada
   * @returns Datos pre-llenados o null si hay error
   */
  const prepare_payment_data = useCallback(async (
    deuda: DeudaPriorizada
  ): Promise<PrefilledPaymentData | null> => {
    try {
      // Calcular monto sugerido basado en prioridad
      let monto_sugerido = deuda.monto

      // Si la prioridad es muy alta, sugerir pago completo
      if (deuda.prioridad > 0.8) {
        monto_sugerido = deuda.monto
      } else if (deuda.prioridad > 0.6) {
        // Sugerir al menos 50% del saldo
        monto_sugerido = Math.max(deuda.monto * 0.5, deuda.monto)
      }

      // Generar observaciones recomendadas
      const observaciones = generate_payment_recommendations(deuda)

      return {
        deuda_id: deuda.deuda_id,
        entidad: deuda.entidad,
        monto_sugerido,
        moneda: deuda.moneda,
        descripcion: `Pago de deuda - ${deuda.entidad}`,
        observaciones_recomendadas: observaciones
      }
    } catch (error) {
      console.error('Error al preparar datos de pago:', error)
      toast.error('Error al preparar datos de pago')
      return null
    }
  }, [])

  /**
   * @description Genera recomendaciones para el pago
   * @param deuda - Deuda priorizada
   * @returns Texto con recomendaciones
   */
  const generate_payment_recommendations = (deuda: DeudaPriorizada): string => {
    const recomendaciones: string[] = []

    if (deuda.prioridad > 0.8) {
      recomendaciones.push('⚠️ PRIORIDAD CRÍTICA: Se recomienda pago inmediato.')
    } else if (deuda.prioridad > 0.6) {
      recomendaciones.push('⚡ PRIORIDAD ALTA: Considerar pago en los próximos 7 días.')
    }

    if (deuda.tendencia_moneda === 'alcista') {
      const tendencia_pct = deuda.tendencia_porcentaje.toFixed(2)
      recomendaciones.push(
        `📈 Moneda en tendencia alcista (+${tendencia_pct}% últimos 30 días). Pagar pronto minimiza pérdidas.`
      )
    }

    if (deuda.impacto_30_dias > 0) {
      const impacto = deuda.impacto_30_dias.toLocaleString()
      recomendaciones.push(
        `💰 Impacto proyectado en 30 días: ${impacto} ${deuda.moneda}. Pagar hoy evita este costo adicional.`
      )
    }

    if (deuda.antiguedad_dias > 180) {
      recomendaciones.push(
        `⏰ Deuda con ${deuda.antiguedad_dias} días de antigüedad. Considerar liquidación.`
      )
    }

    return recomendaciones.join('\n\n')
  }

  // ============================================================================
  // FUNCIONES DE SINCRONIZACIÓN
  // ============================================================================

  /**
   * @description Sincroniza datos después de registrar un pago
   * @param deuda_id - ID de la deuda pagada
   * @param monto - Monto del pago
   * @returns true si la sincronización fue exitosa
   */
  const sync_after_payment = useCallback(async (
    deuda_id: string,
    monto: number
  ): Promise<boolean> => {
    set_state(prev => ({ ...prev, is_syncing: true }))

    try {
      // Simular sincronización (en producción, llamar al servicio)
      await new Promise(resolve => setTimeout(resolve, 1000))

      set_state(prev => ({
        ...prev,
        is_syncing: false,
        last_sync: new Date(),
        pending_updates: 0
      }))

      // Registrar en auditoría
      console.log('[AUDIT] Sincronización después de pago', {
        deuda_id,
        monto,
        timestamp: new Date().toISOString()
      })

      toast.success('Datos sincronizados', {
        description: 'Los KPIs se actualizarán automáticamente'
      })

      return true
    } catch (error) {
      console.error('Error en sincronización:', error)
      
      set_state(prev => ({
        ...prev,
        is_syncing: false,
        sync_errors: [...prev.sync_errors, 'Error al sincronizar después del pago']
      }))

      toast.error('Error en sincronización', {
        description: 'Los datos pueden no estar actualizados'
      })

      return false
    }
  }, [])

  // ============================================================================
  // FUNCIONES DE RECORDATORIOS
  // ============================================================================

  /**
   * @description Crea un recordatorio de pago
   * @param deuda_id - ID de la deuda
   * @param fecha - Fecha del recordatorio
   * @param mensaje - Mensaje opcional personalizado
   * @returns true si el recordatorio fue creado exitosamente
   */
  const create_reminder = useCallback(async (
    deuda_id: string,
    fecha: Date,
    mensaje?: string
  ): Promise<boolean> => {
    try {
      // Validar fecha
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      
      if (fecha < hoy) {
        toast.error('La fecha del recordatorio debe ser futura')
        return false
      }

      // Simular creación de recordatorio (en producción, llamar al API)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Registrar en auditoría
      console.log('[AUDIT] Recordatorio creado', {
        deuda_id,
        fecha: fecha.toISOString(),
        mensaje,
        timestamp: new Date().toISOString()
      })

      toast.success('Recordatorio creado', {
        description: `Se creará un recordatorio para el ${fecha.toLocaleDateString()}`
      })

      return true
    } catch (error) {
      console.error('Error al crear recordatorio:', error)
      toast.error('Error al crear el recordatorio')
      return false
    }
  }, [])

  // ============================================================================
  // FUNCIONES DE VALIDACIÓN
  // ============================================================================

  /**
   * @description Valida que una deuda puede ser pagada
   * @param deuda_id - ID de la deuda
   * @returns true si la deuda es elegible para pago
   */
  const validate_payment = useCallback(async (deuda_id: string): Promise<boolean> => {
    try {
      // En producción, llamar al servicio de validación
      // Por ahora, simular validación exitosa
      await new Promise(resolve => setTimeout(resolve, 200))
      return true
    } catch (error) {
      console.error('Error al validar pago:', error)
      toast.error('Error al validar la deuda')
      return false
    }
  }, [])

  // ============================================================================
  // FUNCIONES DE UTILIDAD
  // ============================================================================

  /**
   * @description Limpia los errores de sincronización
   */
  const clear_sync_errors = useCallback(() => {
    set_state(prev => ({ ...prev, sync_errors: [] }))
  }, [])

  // ============================================================================
  // EFECTOS
  // ============================================================================

  // Limpiar errores antiguos después de 5 minutos
  useEffect(() => {
    if (state.sync_errors.length > 0) {
      const timer = setTimeout(() => {
        clear_sync_errors()
      }, 5 * 60 * 1000)

      return () => clearTimeout(timer)
    }
  }, [state.sync_errors, clear_sync_errors])

  // ============================================================================
  // RETORNO
  // ============================================================================

  return {
    state,
    navigate_to_payment,
    prepare_payment_data,
    sync_after_payment,
    create_reminder,
    validate_payment,
    get_navigation_url,
    clear_sync_errors
  }
}
