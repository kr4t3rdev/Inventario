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
  tenantId: string
  cuentaOrigenId?: string
  tipoPagoOrigenId?: string
  referenciaExterna?: string
  vigenciaHasta?: Date | string
  usuarioId: string
  idempotencyKey?: string
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
