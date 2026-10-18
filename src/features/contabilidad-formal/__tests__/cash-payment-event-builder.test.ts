import { describe, expect, it } from 'vitest';

import { buildCashPaymentEvent } from '../lib/cash-payment-event-builder';

describe('buildCashPaymentEvent', () => {
  const fecha = new Date('2026-10-14T12:00:00.000Z');
  const common = {
    reconciliationId: 'recon-1',
    amount: '0.0123',
    currency: 'USD',
    functionalAmount: '3.6900',
    functionalCurrency: 'CUP',
    exchangeRate: '300',
    fxEvidenceFingerprint: 'fx-history:2026-10-14:USD-CUP',
    fecha,
    reference: 'payment-1',
  } as const;

  it('builds a loan collection with exact source and functional valuation', () => {
    expect(buildCashPaymentEvent({ ...common, obligation: 'loan', treasuryAccountType: 'CORRIENTE' })).toEqual({
      tipo: 'COBRO_PRESTAMO',
      fecha,
      descripcion: 'Cobro de préstamo',
      origen: { tipo: 'reconciliacion_venta', id: 'recon-1' },
      monto: '0.0123',
      moneda: 'USD',
      montoFuncional: '3.6900',
      monedaFuncional: 'CUP',
      tasaCambio: '300',
      fxEvidenceFingerprint: 'fx-history:2026-10-14:USD-CUP',
      medioCobro: 'BANCOS',
      referencia: 'payment-1',
    });
  });

  it('builds a debt payment with a cash/bank role and interest auxiliary', () => {
    expect(buildCashPaymentEvent({
      ...common,
      obligation: 'debt',
      interest: '0.0020',
      treasuryAccountType: 'EFECTIVO',
    })).toEqual({
      tipo: 'PAGO_DEUDA',
      fecha,
      descripcion: 'Pago de deuda',
      origen: { tipo: 'reconciliacion_gasto', id: 'recon-1' },
      monto: '0.0123',
      moneda: 'USD',
      montoFuncional: '3.6900',
      monedaFuncional: 'CUP',
      tasaCambio: '300',
      fxEvidenceFingerprint: 'fx-history:2026-10-14:USD-CUP',
      medioCobro: 'CAJA',
      referencia: 'payment-1',
      auxiliares: { intereses: '0.0020' },
    });
  });

  it('preserves ordinary and moratory interest as separate formal auxiliaries', () => {
    expect(buildCashPaymentEvent({
      ...common,
      obligation: 'loan',
      interest: '0.0020',
      moratoryInterest: '0.0010',
    }).auxiliares).toEqual({
      intereses: '0.0020',
      interesesMoratorios: '0.0010',
    });
  });

  it('maps an available treasury account for either obligation and omits an unknown one', () => {
    expect(buildCashPaymentEvent({
      ...common,
      obligation: 'debt',
      treasuryAccountType: 'BANK',
    }).medioCobro).toBe('BANCOS');
    expect(buildCashPaymentEvent({
      ...common,
      obligation: 'loan',
      treasuryAccountType: 'CORRIENTE',
    }).medioCobro).toBe('BANCOS');
    expect(buildCashPaymentEvent({
      ...common,
      obligation: 'loan',
    }).medioCobro).toBeUndefined();
  });
});
