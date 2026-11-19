import { describe, expect, it } from 'vitest';
import {
  settleInitialPayableInput,
  settleInitialReceivableInput,
} from '../services/initial-subledger-settlement-contract';

const base = {
  cuentaId: 'cuenta-1',
  monto: '100',
  referencia: 'ref-1',
  tipoPagoId: 'tipo-1',
};

describe('contrato de liquidación de submayor inicial: fechaEfectiva', () => {
  it.each(['2026-02-30', '2026-02-31', '2026-13-01', '2026-00-10'])(
    'rechaza la fecha civil imposible %s en el cobro',
    (fechaEfectiva) => {
      const result = settleInitialReceivableInput.safeParse({
        ...base,
        cuentaPorCobrarId: 'cxc-1',
        fechaEfectiva,
      });
      expect(result.success).toBe(false);
    },
  );

  it('rechaza la fecha civil imposible 2026-02-30 en el pago', () => {
    const result = settleInitialPayableInput.safeParse({
      cuentaId: 'cuenta-1',
      monto: '100',
      referencia: 'ref-1',
      cuentaPorPagarId: 'cxp-1',
      fechaEfectiva: '2026-02-30',
    });
    expect(result.success).toBe(false);
  });

  it.each(['2026-02-28', '2024-02-29', '2026-11-01'])(
    'acepta la fecha civil válida %s',
    (fechaEfectiva) => {
      const result = settleInitialReceivableInput.safeParse({
        ...base,
        cuentaPorCobrarId: 'cxc-1',
        fechaEfectiva,
      });
      expect(result.success).toBe(true);
    },
  );

  it('sigue rechazando el formato que no es yyyy-mm-dd', () => {
    const result = settleInitialReceivableInput.safeParse({
      ...base,
      cuentaPorCobrarId: 'cxc-1',
      fechaEfectiva: '2026-2-3',
    });
    expect(result.success).toBe(false);
  });
});
