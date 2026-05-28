/**
 * @description Hook que encapsula la lógica de pago de Cuentas por Pagar (CxP).
 * Extrae del ReconciliacionGastosForm la validación, construcción de distribución
 * y llamada a reconciliarGastoAction específica para CxP.
 *
 * @module features/contabilidad/hooks/use-pago-cuenta-por-pagar
 */
'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { reconciliarGastoAction } from '@/features/contabilidad/actions-reconciliacion'

interface DistribucionPago {
  cuentaId: string
  tipoPagoId: string
  monto: number
  moneda: string
  tasaCambio?: number
  numeroTransaccion: string
  observaciones?: string
}

interface UsePagoCuentaPorPagarOptions {
  cuentaPorPagarId: string
  gasto: {
    monto: number
    referenciaId: string
    tipo: 'compra' | 'servicio'
    descripcion: string
    periodo?: string
  }
  /** Callback post-pago exitoso */
  onSuccess?: () => void
  /** Callback para cerrar el modal */
  onClose?: () => void
}

interface UsePagoCuentaPorPagarReturn {
  /** Ejecuta el pago con la distribución dada */
  pagar: (distribuciones: DistribucionPago[]) => Promise<void>
  /** Indica si hay una operación en curso */
  isLoading: boolean
}

/**
 * @description Prepara los parámetros base para reconciliarGastoAction según el tipo de gasto.
 */
function buildBaseData(
  gasto: UsePagoCuentaPorPagarOptions['gasto'],
  montoPago: number,
  distribuciones: DistribucionPago[],
) {
  const baseData: Record<string, unknown> = {
    tipoGasto: gasto.tipo,
    referenciaId: gasto.referenciaId,
    monto: montoPago,
    descripcion: gasto.descripcion?.trim() || `Gasto ${gasto.tipo}`,
    periodo: gasto.periodo,
    distribucion: distribuciones.map((d) => ({
      cuentaId: d.cuentaId,
      monto: d.monto,
      tipoPagoId: d.tipoPagoId,
      moneda: d.moneda,
      tasaCambio: d.tasaCambio,
      numeroTransaccion: d.numeroTransaccion,
      observaciones: d.observaciones,
      porcentaje:
        montoPago > 0
          ? Math.round((d.monto / montoPago) * 100 * 100) / 100
          : 0,
    })),
  }

  // Tipos de gasto específicos
  if (gasto.tipo === 'compra') {
    baseData.gastoCompraId = gasto.referenciaId
  } else if (gasto.tipo === 'servicio') {
    baseData.compraServicioId = gasto.referenciaId
  }

  return baseData
}

/**
 * @description Hook para gestionar el pago de una Cuenta por Pagar.
 * Centraliza validaciones y la llamada a reconciliarGastoAction.
 *
 * @param {UsePagoCuentaPorPagarOptions} options - Configuración del pago.
 * @returns {UsePagoCuentaPorPagarReturn} Estado y función de pago.
 *
 * @example
 * ```tsx
 * const { pagar, isLoading } = usePagoCuentaPorPagar({
 *   cuentaPorPagarId: 'cxp-123',
 *   gasto: { monto: 500, referenciaId: 'compra-1', tipo: 'compra', descripcion: '' },
 *   onSuccess: () => refetch(),
 *   onClose: () => setOpen(false),
 * })
 *
 * await pagar([{
 *   cuentaId: 'cb-1',
 *   tipoPagoId: 'tp-1',
 *   monto: 500,
 *   moneda: 'CUP',
 *   numeroTransaccion: 'TRX-001',
 * }])
 * ```
 */
export function usePagoCuentaPorPagar(
  options: UsePagoCuentaPorPagarOptions,
): UsePagoCuentaPorPagarReturn {
  const { cuentaPorPagarId, gasto, onSuccess, onClose } = options
  const [isLoading, setIsLoading] = useState(false)

  const pagar = useCallback(
    async (distribuciones: DistribucionPago[]) => {
      // --- Validaciones ---
      const totalDistribuido = distribuciones.reduce(
        (sum, d) => sum + (d.monto || 0),
        0,
      )
      const saldoPendiente = gasto.monto

      if (totalDistribuido > saldoPendiente + 0.01) {
        toast.error(
          `El monto total distribuido (${totalDistribuido.toFixed(2)}) ` +
            `no puede exceder el saldo pendiente (${saldoPendiente.toFixed(2)})`,
        )
        return
      }

      if (totalDistribuido <= 0) {
        toast.error('El monto a pagar debe ser mayor a 0')
        return
      }

      const montoNegativo = distribuciones.find((d) => (d.monto || 0) <= 0)
      if (montoNegativo) {
        toast.error('Todos los montos deben ser positivos')
        return
      }

      // --- Ejecución ---
      setIsLoading(true)

      try {
        const baseData = buildBaseData(gasto, totalDistribuido, distribuciones)

        const result = await reconciliarGastoAction({
          pgId: baseData.pgId as string | undefined,
          gastoCompraId: baseData.gastoCompraId as string | undefined,
          compraServicioId: baseData.compraServicioId as string | undefined,
          ventaServicioId: baseData.ventaServicioId as string | undefined,
          cuentaId: distribuciones[0].cuentaId,
          tipoPagoId: distribuciones[0].tipoPagoId,
          monto: totalDistribuido,
          moneda: distribuciones[0].moneda,
          descripcion: baseData.descripcion as string,
          cuentaPorPagarId,
          // distribucion se pasa completa para multi-cuenta
          distribucion: baseData.distribucion as Array<{
            cuentaId: string
            monto: number
            tipoPagoId: string
            moneda: string
            tasaCambio?: number
            numeroTransaccion?: string
            observaciones?: string
            porcentaje?: number
          }>,
        })

        if (!result.success) {
          throw new Error(result.error?.message || 'Error al registrar el pago')
        }

        toast.success('Pago registrado exitosamente')

        setTimeout(() => {
          onSuccess?.()
        }, 500)

        onClose?.()
      } catch (error: unknown) {
        const err = error as { data?: { message?: string; details?: Array<{ message: string }> }; message?: string }
        console.error('[usePagoCuentaPorPagar] Error →', err)

        const details = Array.isArray(err?.data?.details)
          ? err.data.details.map((d: { message: string }) => d.message).join('; ')
          : ''
        const errorMessage =
          err?.data?.message ||
          err?.message ||
          'Error al registrar el pago'
        toast.error(details ? `${errorMessage} | ${details}` : errorMessage)
      } finally {
        setIsLoading(false)
      }
    },
    [cuentaPorPagarId, gasto, onSuccess, onClose],
  )

  return { pagar, isLoading }
}
