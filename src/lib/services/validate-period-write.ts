/**
 * @description Helper para validar período contable en API routes legacy.
 *
 * Los API routes de Next.js que escriben datos contables deben llamar esta
 * función antes de hacer writes para respetar la política de períodos.
 *
 * Ejemplo de uso en un route handler:
 * ```
 * import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write'
 *
 * export async function POST(request: NextRequest) {
 *   const body = await request.json()
 *   const validacion = await validarEscrituraPeriodo({
 *     fecha: new Date(body.fecha),  // o extraer del body según el tipo de operación
 *     tenantId: 'tenant-id',        // obtener del auth
 *     tipoOperacion: 'reconciliacion',
 *     actor: user.userId,
 *   })
 *
 *   if (!validacion.permitido) {
 *     return NextResponse.json(
 *       { error: validacion.error?.message, code: validacion.error?.code },
 *       { status: 400 }
 *     )
 *   }
 *   // proceed with write...
 * }
 * ```
 */

import { PeriodoContableService } from './periodo-contable-service'
import { getGuardConfig } from './periodo-contable-types'
import type { PeriodoErrorCode } from './periodo-contable-types'

export interface ValidacionEscrituraParams {
  fecha: Date
  tenantId: string
  tipoOperacion: string
  actor: string
  metadata?: Record<string, unknown>
}

export interface ValidacionEscrituraResult {
  permitido: boolean
  modo: 'disabled' | 'audit-only' | 'enforce'
  error?: {
    message: string
    code: PeriodoErrorCode
  }
}

/**
 * Valida si una operación contable puede ejecutarse en la fecha dada.
 * Respeta el feature flag PERIODO_CONTABLE_MODE.
 *
 * En modo 'disabled': siempre retorna {permitido: true, modo: 'disabled'}
 * En modo 'audit-only': retorna {permitido: true, modo: 'audit-only'} (solo loguea)
 * En modo 'enforce': retorna {permitido: false} si el período no está abierto
 */
export async function validarEscrituraPeriodo(
  params: ValidacionEscrituraParams
): Promise<ValidacionEscrituraResult> {
  const config = getGuardConfig()

  if (!config.enabled || config.mode === 'disabled') {
    return { permitido: true, modo: 'disabled' }
  }

  try {
    const result = await PeriodoContableService.validarEscritura(
      params.fecha,
      params.tenantId,
      params.tipoOperacion
    )

    if (result.error) {
      const esAuditOnly = config.mode === 'audit-only'

      if (esAuditOnly) {
        // En audit-only, logueamos pero permitimos la operación
        console.warn(
          `[PeriodoGuard-AUDIT] Operación bloqueada pero permitida en audit-only:`,
          {
            fecha: params.fecha.toISOString(),
            tenantId: params.tenantId,
            tipoOperacion: params.tipoOperacion,
            actor: params.actor,
            error: result.error.message,
            codigo: result.error.code,
          }
        )
        return {
          permitido: true,
          modo: 'audit-only',
        }
      }

      return {
        permitido: false,
        modo: 'enforce',
        error: {
          message: result.error.message,
          code: result.error.code,
        },
      }
    }

    return { permitido: true, modo: config.mode }
  } catch (err) {
    // Error inesperado: en enforce fallamos, en audit-only permitimos
    if (config.mode === 'enforce') {
      return {
        permitido: false,
        modo: 'enforce',
        error: {
          message: err instanceof Error ? err.message : 'Error validando período',
          code: 'INTERNAL_ERROR',
        },
      }
    }

    console.error('[PeriodoGuard-AUDIT] Error validando período:', err)
    return { permitido: true, modo: 'audit-only' }
  }
}

/**
 * Helper para extraer la fecha de negocio de un body de request.
 * Recogniza los campos de fecha más comunes en operaciones contables.
 */
export function extraerFechaDeBody(body: Record<string, unknown>): Date | null {
  // Campos comunes de fecha en operaciones contables
  // fechaOperacion es el campo canónico (prioritario)
  const camposFecha = [
    'fechaOperacion',
    'fechaReconciliacion',
    'fechaTransferencia',
    'fecha',
    'fechaPago',
    'fechaCompra',
    'fechaServicio',
    'createdAt',
  ]

  for (const campo of camposFecha) {
    if (body[campo]) {
      const fecha = new Date(body[campo] as string)
      if (!isNaN(fecha.getTime())) {
        return fecha
      }
    }
  }

  return null
}