import { describe, expect, it } from 'vitest';
import {
  buildCapitalInjectionPayload,
  type CapitalFormData,
} from '@/features/contabilidad/components/capital/capital-form';
import {
  buildBankAdjustmentPayload,
  type AjusteBancarioFormData,
} from '@/features/contabilidad/components/ajuste-bancario-form';

describe('idempotency keys in accounting forms', () => {
  it('includes the provided key in the capital injection payload', () => {
    const data: CapitalFormData = {
      tipo: 'CAPITAL_SOCIAL',
      montoRecibido: 500,
      moneda: 'CUP',
      cuentaId: 'account-1',
      socio: 'Founder',
    };

    expect(buildCapitalInjectionPayload(data, 'capital-key')).toMatchObject({
      cuentaId: 'account-1',
      montoRecibido: 500,
      idempotencyKey: 'capital-key',
    });
  });

  it('reuses the same key when a bank adjustment payload is rebuilt for a retry', () => {
    const data: AjusteBancarioFormData = {
      cuentaId: 'account-1',
      tipo: 'egreso',
      monto: '50',
      moneda: 'CUP',
      descripcion: 'Manual adjustment',
      motivo: 'Reconciliation',
      fechaOperacion: '2026-10-08',
    };

    const first = buildBankAdjustmentPayload(data, 'adjustment-key');
    const retry = buildBankAdjustmentPayload(data, 'adjustment-key');

    expect(first.idempotencyKey).toBe('adjustment-key');
    expect(retry.idempotencyKey).toBe(first.idempotencyKey);
    expect(retry).toEqual(first);
  });
});
