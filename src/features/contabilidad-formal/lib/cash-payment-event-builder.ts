/**
 * @description Construye los eventos de mayor para pagos de obligaciones cash,
 * preservando la valoración exacta de la escritura operativa.
 */

import type { DecimalInput } from '../services/posting-engine';

export type CashPaymentDecimalInput = DecimalInput;

export interface CashPaymentEvent {
  tipo: 'COBRO_PRESTAMO' | 'PAGO_DEUDA';
  fecha: Date;
  descripcion: string;
  origen: { tipo: 'reconciliacion_venta' | 'reconciliacion_gasto'; id: string };
  monto: CashPaymentDecimalInput;
  moneda: string;
  montoFuncional: CashPaymentDecimalInput;
  monedaFuncional: string;
  tasaCambio: CashPaymentDecimalInput | null;
  fxEvidenceFingerprint: string | null;
  medioCobro?: 'CAJA' | 'BANCOS';
  referencia?: string;
  auxiliares?: { intereses?: CashPaymentDecimalInput; interesesMoratorios?: CashPaymentDecimalInput };
}

export interface CashPaymentEventParams {
  obligation: 'loan' | 'debt';
  reconciliationId: string;
  amount: CashPaymentDecimalInput;
  currency: string;
  functionalAmount: CashPaymentDecimalInput;
  functionalCurrency: string;
  exchangeRate?: CashPaymentDecimalInput | null;
  fxEvidenceFingerprint?: string | null;
  interest?: CashPaymentDecimalInput | null;
  moratoryInterest?: CashPaymentDecimalInput | null;
  treasuryAccountType?: string | null;
  fecha: Date;
  reference?: string;
}

/**
 * @description Mapea un pago persistido a un evento formal sin recalcular moneda
 * ni tipo de cambio; la fuente FX debe provenir del writer de negocio.
 * @param {CashPaymentEventParams} params - Pago y evidencia ya persistidos.
 * @returns {CashPaymentEvent} Evento apto para el motor formal.
 */
export function buildCashPaymentEvent(params: CashPaymentEventParams): CashPaymentEvent {
  const isLoan = params.obligation === 'loan';
  const interest = params.interest;
  const moratoryInterest = params.moratoryInterest;
  return {
    tipo: isLoan ? 'COBRO_PRESTAMO' : 'PAGO_DEUDA',
    fecha: params.fecha,
    descripcion: isLoan ? 'Cobro de préstamo' : 'Pago de deuda',
    origen: {
      tipo: isLoan ? 'reconciliacion_venta' : 'reconciliacion_gasto',
      id: params.reconciliationId,
    },
    monto: params.amount,
    moneda: params.currency,
    montoFuncional: params.functionalAmount,
    monedaFuncional: params.functionalCurrency,
    tasaCambio: params.exchangeRate ?? null,
    fxEvidenceFingerprint: params.fxEvidenceFingerprint ?? null,
    ...(params.treasuryAccountType == null ? {} : {
      medioCobro: params.treasuryAccountType === 'EFECTIVO' ? 'CAJA' : 'BANCOS',
    }),
    referencia: params.reference,
    ...(
      interest == null && moratoryInterest == null
        ? {}
        : {
            auxiliares: {
              ...(interest == null ? {} : { intereses: interest }),
              ...(moratoryInterest == null ? {} : { interesesMoratorios: moratoryInterest }),
            },
          }
    ),
  };
}
