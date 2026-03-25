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
  reconciliacionVentaId?: string
  reconciliacionGastoId?: string
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

export type ExecuteReconciliacionHandler = (
  tx: Prisma.TransactionClient
) => Promise<{
  reconciliacionVentaId?: string
  reconciliacionGastoId?: string
}>
