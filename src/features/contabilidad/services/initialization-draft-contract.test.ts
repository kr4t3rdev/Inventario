import { describe, expect, it } from 'vitest';
import { initializationDraftContract } from './initialization-contract';

describe('contrato de borrador de inicialización', () => {
  it('acepta un borrador vacío con solo la clave', () => {
    expect(initializationDraftContract.parse({ idempotencyKey: 'draft-1' })).toEqual({ idempotencyKey: 'draft-1' });
  });

  it('acepta una cuenta parcial sin origen ni tasas', () => {
    const result = initializationDraftContract.parse({
      idempotencyKey: 'draft-1',
      cuentas: [{ numeroCuenta: 'QA-001', moneda: 'USD' }],
    });
    expect(result.cuentas?.[0]).toMatchObject({ numeroCuenta: 'QA-001', moneda: 'USD' });
  });

  it('acepta la carga completa válida', () => {
    const result = initializationDraftContract.parse({
      idempotencyKey: 'draft-1',
      fechaCorte: '2026-11-01',
      monedaFuncional: 'CUP',
      cuentas: [{
        nombreCuenta: 'Caja', nombreBanco: 'Banco QA', numeroCuenta: 'QA-001',
        tipoCuenta: 'Ahorros', moneda: 'CUP', saldoInicial: '100000',
        origen: { tipo: 'CAPITAL_SOCIAL', tercero: 'Socio QA' },
      }],
    });
    expect(result.fechaCorte).toBe('2026-11-01');
    expect(result.monedaFuncional).toBe('CUP');
  });

  it('rechaza tasas duplicadas tras normalizar la moneda', () => {
    expect(initializationDraftContract.safeParse({
      idempotencyKey: 'draft-1',
      tasas: { usd: '400', USD: '420' },
    }).success).toBe(false);
  });

  it('rechaza clave vacía y cuentas duplicadas', () => {
    expect(initializationDraftContract.safeParse({ idempotencyKey: ' ' }).success).toBe(false);
    expect(initializationDraftContract.safeParse({
      idempotencyKey: 'draft-1',
      cuentas: [{ numeroCuenta: 'QA-001' }, { numeroCuenta: 'QA-001' }],
    }).success).toBe(false);
  });

  it('rechaza importes inválidos aunque el borrador sea parcial', () => {
    expect(initializationDraftContract.safeParse({
      idempotencyKey: 'draft-1',
      cuentas: [{ numeroCuenta: 'QA-001', saldoInicial: '1.001' }],
    }).success).toBe(false);
  });

  it('valida la fecha de corte cuando viene informada', () => {
    expect(initializationDraftContract.safeParse({ idempotencyKey: 'draft-1', fechaCorte: '2999-01-01' }).success).toBe(false);
    expect(initializationDraftContract.safeParse({ idempotencyKey: 'draft-1', fechaCorte: '2026-11-01' }).success).toBe(true);
  });
});
