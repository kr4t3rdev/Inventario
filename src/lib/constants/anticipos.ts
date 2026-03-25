export const FORMA_PAGO_ANTICIPO_PAGO = 'ANTICIPO_PAGO' as const
export const FORMA_PAGO_ANTICIPO_COBRO = 'ANTICIPO_COBRO' as const

export type FormaPagoAnticipo =
  | typeof FORMA_PAGO_ANTICIPO_PAGO
  | typeof FORMA_PAGO_ANTICIPO_COBRO
