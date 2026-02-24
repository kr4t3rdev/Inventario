/**
 * @description Servicio de integración con el módulo de tesorería
 * Maneja la sincronización bidireccional entre el dashboard de inteligencia cambiaria
 * y el módulo de gestión de capital/pagos
 */

import { prisma } from '@/lib/prisma'
import type { DeudaPriorizada } from '@/types/exchange-intelligence'
import type { InyeccionCapital } from '@/app/models/model'

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

/**
 * @description Datos pre-llenados para formulario de pago
 */
export interface PrefilledPaymentData {
  deuda_id: string
  entidad: string
  monto_sugerido: number
  moneda: string
  descripcion: string
  prioridad: number
  impacto_30_dias: number
  observaciones_recomendadas: string
}

/**
 * @description Recordatorio de pago
 */
export interface PaymentReminder {
  id: string
  deuda_id: string
  fecha_recordatorio: Date
  mensaje: string
  prioridad: 'alta' | 'media' | 'baja'
  enviado: boolean
  creado_por: string
  createdAt: Date
}

/**
 * @description Registro de auditoría de acciones
 */
export interface AuditLog {
  id: string
  accion: string
  entidad_tipo: string
  entidad_id: string
  usuario_id: string
  datos_anteriores?: Record<string, unknown>
  datos_nuevos?: Record<string, unknown>
  metadata?: Record<string, unknown>
  timestamp: Date
}

/**
 * @description Resultado de sincronización
 */
export interface SyncResult {
  success: boolean
  deudas_actualizadas: number
  kpis_recalculados: boolean
  errores: string[]
}

// ============================================================================
// SERVICIO DE INTEGRACIÓN CON TESORERÍA
// ============================================================================

export class TreasuryIntegrationService {
  /**
   * @description Prepara datos para pre-llenar el formulario de pago
   * @param deuda_priorizada - Deuda priorizada del análisis de envejecimiento
   * @returns Datos pre-llenados para el formulario
   */
  async prepare_payment_form_data(
    deuda_priorizada: DeudaPriorizada
  ): Promise<PrefilledPaymentData> {
    // Obtener detalles completos de la deuda
    const deuda = await prisma.inyeccionCapital.findUnique({
      where: { id: deuda_priorizada.deuda_id },
      include: {
        cuentaBancaria: true,
        pagos: {
          orderBy: { fechaPago: 'desc' },
          take: 1
        }
      }
    })

    if (!deuda) {
      throw new Error(`Deuda no encontrada: ${deuda_priorizada.deuda_id}`)
    }

    // Calcular monto sugerido basado en prioridad y saldo pendiente
    const saldo_pendiente = Number(deuda.saldoPendiente) || 0
    let monto_sugerido = saldo_pendiente

    // Si la deuda tiene plazo, sugerir cuota mensual
    if (deuda.plazoMeses && deuda.plazoMeses > 0) {
      const cuota_mensual = saldo_pendiente / deuda.plazoMeses
      monto_sugerido = Math.min(cuota_mensual, saldo_pendiente)
    }

    // Si la prioridad es muy alta (>0.8), sugerir pago completo
    if (deuda_priorizada.prioridad > 0.8) {
      monto_sugerido = saldo_pendiente
    }

    // Generar observaciones recomendadas
    const observaciones_recomendadas = this.generate_payment_recommendations(
      deuda_priorizada,
      deuda as any
    )

    return {
      deuda_id: deuda.id,
      entidad: deuda.entidadPrestamista || 'Entidad desconocida',
      monto_sugerido,
      moneda: deuda.moneda,
      descripcion: `Pago de deuda - ${deuda.entidadPrestamista}`,
      prioridad: deuda_priorizada.prioridad,
      impacto_30_dias: deuda_priorizada.impacto_30_dias,
      observaciones_recomendadas
    }
  }

  /**
   * @description Genera recomendaciones para el pago basadas en análisis cambiario
   * @param deuda_priorizada - Deuda priorizada
   * @param deuda - Detalles completos de la deuda
   * @returns Texto con recomendaciones
   */
  private generate_payment_recommendations(
    deuda_priorizada: DeudaPriorizada,
    deuda: InyeccionCapital
  ): string {
    const recomendaciones: string[] = []

    // Recomendación por prioridad
    if (deuda_priorizada.prioridad > 0.8) {
      recomendaciones.push('⚠️ PRIORIDAD CRÍTICA: Se recomienda pago inmediato.')
    } else if (deuda_priorizada.prioridad > 0.6) {
      recomendaciones.push('⚡ PRIORIDAD ALTA: Considerar pago en los próximos 7 días.')
    }

    // Recomendación por tendencia de moneda
    if (deuda_priorizada.tendencia_moneda === 'alcista') {
      const tendencia_pct = deuda_priorizada.tendencia_porcentaje.toFixed(2)
      recomendaciones.push(
        `📈 Moneda en tendencia alcista (+${tendencia_pct}% últimos 30 días). Pagar pronto minimiza pérdidas.`
      )
    }

    // Recomendación por impacto proyectado
    if (deuda_priorizada.impacto_30_dias > 0) {
      const impacto = deuda_priorizada.impacto_30_dias.toLocaleString()
      recomendaciones.push(
        `💰 Impacto proyectado en 30 días: ${impacto} ${deuda.moneda}. Pagar hoy evita este costo adicional.`
      )
    }

    // Recomendación por antigüedad
    if (deuda_priorizada.antiguedad_dias > 180) {
      recomendaciones.push(
        `⏰ Deuda con ${deuda_priorizada.antiguedad_dias} días de antigüedad. Considerar liquidación.`
      )
    }

    return recomendaciones.join('\n')
  }

  /**
   * @description Crea un recordatorio de pago para una deuda
   * @param deuda_id - ID de la deuda
   * @param fecha_recordatorio - Fecha del recordatorio
   * @param usuario_id - ID del usuario que crea el recordatorio
   * @param mensaje_personalizado - Mensaje opcional personalizado
   * @returns Recordatorio creado
   */
  async create_payment_reminder(
    deuda_id: string,
    fecha_recordatorio: Date,
    usuario_id: string,
    mensaje_personalizado?: string
  ): Promise<PaymentReminder> {
    // Obtener detalles de la deuda
    const deuda = await prisma.inyeccionCapital.findUnique({
      where: { id: deuda_id }
    })

    if (!deuda) {
      throw new Error(`Deuda no encontrada: ${deuda_id}`)
    }

    // Generar mensaje por defecto si no se proporciona uno
    const mensaje = mensaje_personalizado || 
      `Recordatorio: Pago pendiente a ${deuda.entidadPrestamista} - ` +
      `Saldo: ${Number(deuda.saldoPendiente).toLocaleString()} ${deuda.moneda}`

    // Determinar prioridad basada en saldo y fecha
    let prioridad: 'alta' | 'media' | 'baja' = 'media'
    const saldo = Number(deuda.saldoPendiente) || 0
    const dias_hasta_recordatorio = Math.floor(
      (fecha_recordatorio.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )

    if (saldo > 10000 || dias_hasta_recordatorio <= 7) {
      prioridad = 'alta'
    } else if (saldo < 5000 && dias_hasta_recordatorio > 30) {
      prioridad = 'baja'
    }

    // Crear recordatorio (usando tabla de notificaciones existente)
    const recordatorio = await prisma.notification.create({
      data: {
        title: `Recordatorio de Pago - ${deuda.entidadPrestamista}`,
        message: mensaje,
        type: 'transferencia', // Usar tipo existente más cercano
        prioridad,
        isRead: false,
        userId: usuario_id
      }
    })

    // Registrar en auditoría
    await this.log_action(
      'crear_recordatorio_pago',
      'recordatorio',
      recordatorio.id,
      usuario_id,
      undefined,
      {
        deuda_id,
        fecha_recordatorio: fecha_recordatorio.toISOString(),
        prioridad
      }
    )

    return {
      id: recordatorio.id,
      deuda_id,
      fecha_recordatorio,
      mensaje,
      prioridad,
      enviado: false,
      creado_por: usuario_id,
      createdAt: recordatorio.createdAt
    }
  }

  /**
   * @description Registra una acción en el log de auditoría
   * @param accion - Tipo de acción realizada
   * @param entidad_tipo - Tipo de entidad afectada
   * @param entidad_id - ID de la entidad afectada
   * @param usuario_id - ID del usuario que realizó la acción
   * @param datos_anteriores - Estado anterior (opcional)
   * @param datos_nuevos - Estado nuevo (opcional)
   * @returns Log de auditoría creado
   */
  async log_action(
    accion: string,
    entidad_tipo: string,
    entidad_id: string,
    usuario_id: string,
    datos_anteriores?: Record<string, unknown>,
    datos_nuevos?: Record<string, unknown>
  ): Promise<any> {
    const detalles = {
      datos_anteriores,
      datos_nuevos
    }

    // Guardar en la tabla AuditLog de Prisma
    const log = await (prisma as any).auditLog.create({
      data: {
        accion,
        entidad: entidad_tipo,
        entidadId: entidad_id,
        usuarioId: usuario_id,
        detalles: detalles as any,
        userAgent: 'exchange-intelligence-dashboard',
        ip: 'internal'
      }
    })

    console.log('[AUDIT LOG CREATED]', log)

    return log
  }

  /**
   * @description Sincroniza datos después de registrar un pago
   * @param deuda_id - ID de la deuda pagada
   * @param monto_pagado - Monto del pago realizado
   * @param usuario_id - ID del usuario que realizó el pago
   * @returns Resultado de la sincronización
   */
  async sync_after_payment(
    deuda_id: string,
    monto_pagado: number,
    usuario_id: string
  ): Promise<SyncResult> {
    const errores: string[] = []
    let deudas_actualizadas = 0

    try {
      // Obtener estado actual de la deuda (que debería estar ya actualizada por el proceso de pago)
      const deuda = await prisma.inyeccionCapital.findUnique({
        where: { id: deuda_id },
        include: {
          pagos: {
            orderBy: { fechaPago: 'desc' },
            take: 2 // Tomamos los últimos dos para comparar si es necesario
          }
        }
      })

      if (!deuda) {
        errores.push(`Deuda no encontrada: ${deuda_id}`)
        return {
          success: false,
          deudas_actualizadas: 0,
          kpis_recalculados: false,
          errores
        }
      }

      deudas_actualizadas = 1
      const pagos = deuda.pagos || []
      const ultimo_pago = pagos[0]
      const pago_anterior = pagos[1]

      // Registrar en auditoría
      await this.log_action(
        'registrar_pago_deuda',
        'inyeccion_capital',
        deuda_id,
        usuario_id,
        {
          saldo_pendiente_antes: pago_anterior ? Number(deuda.saldoPendiente) + Number(ultimo_pago?.montoPagado || 0) : undefined,
          estado: pago_anterior ? 'ACTIVA' : undefined
        },
        {
          saldo_pendiente_despues: deuda.saldoPendiente,
          estado: deuda.estado,
          monto_pagado
        }
      )

      return {
        success: true,
        deudas_actualizadas,
        kpis_recalculados: true,
        errores
      }
    } catch (error) {
      console.error('Error en sincronización después de pago:', error)
      errores.push(error instanceof Error ? error.message : 'Error desconocido')
      
      return {
        success: false,
        deudas_actualizadas,
        kpis_recalculados: false,
        errores
      }
    }
  }

  /**
   * @description Obtiene el estado de sincronización de una deuda
   * @param deuda_id - ID de la deuda
   * @returns Estado de sincronización
   */
  async get_sync_status(deuda_id: string): Promise<{
    sincronizada: boolean
    ultima_actualizacion: Date | null
    pendiente_recalculo: boolean
  }> {
    const deuda = await prisma.inyeccionCapital.findUnique({
      where: { id: deuda_id },
      include: {
        pagos: {
          orderBy: { fechaPago: 'desc' },
          take: 1
        }
      }
    })

    if (!deuda) {
      return {
        sincronizada: false,
        ultima_actualizacion: null,
        pendiente_recalculo: false
      }
    }

    const ultimo_pago = deuda.pagos[0]
    const ultima_actualizacion = ultimo_pago 
      ? new Date(ultimo_pago.fechaPago)
      : new Date(deuda.updatedAt)

    // Considerar pendiente de recálculo si el último pago fue hace menos de 5 minutos
    const cinco_minutos_atras = new Date(Date.now() - 5 * 60 * 1000)
    const pendiente_recalculo = ultima_actualizacion > cinco_minutos_atras

    return {
      sincronizada: true,
      ultima_actualizacion,
      pendiente_recalculo
    }
  }

  /**
   * @description Navega al módulo de capital con datos pre-llenados
   * @param deuda_id - ID de la deuda
   * @returns URL de navegación con parámetros
   */
  generate_navigation_url(deuda_id: string): string {
    // Generar URL con parámetros para pre-llenar el formulario
    const params = new URLSearchParams({
      action: 'pagar',
      deuda_id,
      source: 'exchange-intelligence'
    })

    return `/busy/contabilidad/capital?${params.toString()}`
  }

  /**
   * @description Valida que una deuda puede ser pagada
   * @param deuda_id - ID de la deuda
   * @returns Resultado de validación
   */
  async validate_payment_eligibility(deuda_id: string): Promise<{
    eligible: boolean
    reason?: string
    deuda?: InyeccionCapital
  }> {
    const deuda = await prisma.inyeccionCapital.findUnique({
      where: { id: deuda_id }
    })

    if (!deuda) {
      return {
        eligible: false,
        reason: 'Deuda no encontrada'
      }
    }

    if (deuda.tipo !== 'DEUDA_EXTERNA') {
      return {
        eligible: false,
        reason: 'Solo se pueden pagar deudas externas',
        deuda: deuda as any
      }
    }

    if (deuda.estado === 'PAGADA') {
      return {
        eligible: false,
        reason: 'La deuda ya está pagada',
        deuda: deuda as any
      }
    }

    const saldo_pendiente = Number(deuda.saldoPendiente) || 0
    if (saldo_pendiente <= 0) {
      return {
        eligible: false,
        reason: 'No hay saldo pendiente',
        deuda: deuda as any
      }
    }

    return {
      eligible: true,
      deuda: deuda as any
    }
  }
}

// Exportar instancia singleton
export const treasury_integration_service = new TreasuryIntegrationService()
