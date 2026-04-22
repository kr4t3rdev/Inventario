import { Prisma } from '@/generated/prisma'

export type AnticipoTipo = 'PAGO' | 'COBRO'
export type AnticipoEstado = 'RESERVADO' | 'EJECUTADO' | 'ANULADO'
export type AnticipoContexto =
  | 'COMPRA_PRODUCTO'
  | 'COMPRA_SERVICIO'
  | 'FACTURA_OFERTA'
  | 'FACTURA_DIRECTA'

export interface AnticipoWorkflowError extends Error {
  status: number
  code: string
}

export interface CreateAnticipoParams {
  tipo: AnticipoTipo
  contratoId: string
  proveedorId?: string
  clienteId?: string
  monto: number
  moneda: string
  cuentaOrigenId?: string
  tipoPagoOrigenId?: string
  referenciaExterna?: string
  vigenciaHasta?: Date | string
  usuarioId: string
}

export interface ExecuteAnticipoParams {
  anticipoId: string
  contexto: AnticipoContexto
  documentoDestinoId: string
  montoObjetivo: number
  monedaObjetivo: string
  tasaAplicada?: number
  idempotencyKey: string
  observaciones?: string
  usuarioId: string
}

export interface ExecuteAnticipoResult {
  anticipoId: string
  estado: AnticipoEstado
  saldoDisponible: number
  movimientoId: string
  idempotentReplay: boolean
}

export interface ExecuteAnticipoPersistedResult {
  requestFingerprint: string
  response: Omit<ExecuteAnticipoResult, 'idempotentReplay'>
}

export interface ReverseAnticipoParams {
  anticipoId: string
  documentoDestinoId: string
  montoReverso: number
  observaciones?: string
  usuarioId: string
}

/**
 * Allocation de anticipo: par anticipoId + monto aplicado.
 */
export interface AnticipoAllocation {
  anticipoId: string
  montoAplicado: number
}

/**
 * Resultado de aplicar una allocation de anticipo.
 */
export interface AnticipoAllocationResult {
  anticipoId: string
  movimientoId: string
  montoAplicado: number
  saldoRestante: number
}

/**
 * Handler para ejecutar reconciliación de negocio después de consumir anticipo.
 * Recibe el contexto completo para tomar decisiones de qué tipo de reconciliación crear.
 */
export type ExecuteReconciliacionHandler = (
  tx: Prisma.TransactionClient,
  context: {
    anticipoId: string
    tipoAnticipo: AnticipoTipo
    documentoDestinoId: string
    contexto: AnticipoContexto
    montoObjetivo: number
    monedaObjetivo: string
    cuentaBancariaId: string
    tipoPagoId: string
    usuarioId: string
  }
) => Promise<{
  reconciliacionVentaId?: string
  reconciliacionGastoId?: string
  reconciliacionServicioId?: string
}>
