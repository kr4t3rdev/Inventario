import { describe, expect, it } from 'vitest';
import { initializationContract } from './initialization-contract';

const account = {
  nombreCuenta: ' Caja de prueba ',
  nombreBanco: ' Banco QA ',
  numeroCuenta: ' QA-001 ',
  tipoCuenta: ' Ahorros ',
  moneda: 'cup',
  saldoInicial: '000100000.00',
  origen: { tipo: 'CAPITAL_SOCIAL', tercero: ' Socio QA ' },
};
const input = { idempotencyKey: ' request-1 ', fechaCorte: '2026-11-01', monedaFuncional: 'cup', cuentas: [account] };

describe('contrato de inicialización de empresa nueva', () => {
  it('normaliza texto, moneda e importe sin convertirlo a número', () => {
    expect(initializationContract.parse(input)).toEqual({
      idempotencyKey: 'request-1',
      fechaCorte: '2026-11-01',
      monedaFuncional: 'CUP',
      cuentas: [{
        nombreCuenta: 'Caja de prueba', nombreBanco: 'Banco QA', numeroCuenta: 'QA-001',
        tipoCuenta: 'Ahorros', moneda: 'CUP', saldoInicial: '100000',
        origen: { tipo: 'CAPITAL_SOCIAL', tercero: 'Socio QA' },
      }],
    });
  });

  it.each(['CAPITAL_SOCIAL', 'PRESTAMO', 'ANTICIPO'] as const)(
    'acepta %s con tercero identificado', (tipo) => {
      const origen = tipo === 'ANTICIPO'
        ? { tipo, tercero: 'Cliente o aportante', tipoPagoId: 'pago-1' }
        : { tipo, tercero: 'Cliente o aportante' };
      expect(initializationContract.safeParse({ ...input, cuentas: [{ ...account, origen }] }).success).toBe(true);
    },
  );

  it('admite varias cuentas y cuentas sin saldo ni origen', () => {
    const result = initializationContract.parse({ ...input, cuentas: [account, {
      ...account, numeroCuenta: 'QA-002', moneda: 'usd', saldoInicial: '0.00', origen: undefined,
    }] });
    expect(result.cuentas[1].saldoInicial).toBe('0');
    expect(result.cuentas[1].moneda).toBe('USD');
  });

  it.each(['-1', '1e3', '1,00', '1.001', '', 'NaN', '  '])(
    'rechaza importes inválidos: %s', (saldoInicial) => {
      expect(initializationContract.safeParse({ ...input, cuentas: [{ ...account, saldoInicial }] }).success).toBe(false);
    },
  );

  it('rechaza números JavaScript y valida el límite seguro de centavos', () => {
    expect(initializationContract.safeParse({ ...input, cuentas: [{ ...account, saldoInicial: 1.2 }] }).success).toBe(false);
    expect(initializationContract.parse({ ...input, cuentas: [{ ...account, saldoInicial: '90071992547409.91' }] }).cuentas[0].saldoInicial).toBe('90071992547409.91');
    expect(initializationContract.safeParse({ ...input, cuentas: [{ ...account, saldoInicial: '90071992547409.92' }] }).success).toBe(false);
    expect(initializationContract.safeParse({ ...input, cuentas: [{ ...account, saldoInicial: '90071992547410' }] }).success).toBe(false);
    expect(initializationContract.safeParse({ ...input, cuentas: [{ ...account, saldoInicial: '70368744177664.01' }] }).success).toBe(false);
    expect(initializationContract.parse({ ...input, cuentas: [{ ...account, saldoInicial: '1.01' }] }).cuentas[0].saldoInicial).toBe('1.01');
  });

  it('requiere una clasificación explícita para saldos positivos sin asumir su procedencia', () => {
    expect(initializationContract.safeParse({ ...input, cuentas: [{ ...account, origen: undefined }] }).success).toBe(false);
    expect(initializationContract.safeParse({ ...input, cuentas: [{ ...account, origen: { tipo: 'ANTICIPO', tercero: ' ' } }] }).success).toBe(false);
    expect(initializationContract.safeParse({ ...input, cuentas: [{
      ...account, origen: undefined, origenNoDocumentado: true,
    }] }).success).toBe(true);
    expect(initializationContract.safeParse({ ...input, cuentas: [{
      ...account, origenNoDocumentado: true,
    }] }).success).toBe(false);
    expect(initializationContract.safeParse({ ...input, cuentas: [{
      ...account, saldoInicial: '0', origen: undefined, origenNoDocumentado: true,
    }] }).success).toBe(false);
    expect(initializationContract.safeParse({ ...input, cuentas: [{ ...account, saldoInicial: '0', origen: account.origen }] }).success).toBe(false);
  });

  it('requiere tipo de pago para anticipos y tasa positiva para monedas extranjeras', () => {
    expect(initializationContract.safeParse({ ...input, cuentas: [{
      ...account, origen: { tipo: 'ANTICIPO', tercero: 'Cliente' },
    }] }).success).toBe(false);
    expect(initializationContract.safeParse({ ...input, cuentas: [{
      ...account, origen: { tipo: 'CAPITAL_SOCIAL', tercero: 'Socio', tasaCambio: '0' },
    }] }).success).toBe(false);
    expect(initializationContract.safeParse({ ...input, cuentas: [{
      ...account, origen: { tipo: 'CAPITAL_SOCIAL', tercero: 'Socio', tasaCambio: '400' },
    }] }).success).toBe(true);
  });

  it('rechaza datos incompletos, claves vacías y cuentas repetidas', () => {
    expect(initializationContract.safeParse({ ...input, idempotencyKey: ' ' }).success).toBe(false);
    expect(initializationContract.safeParse({ ...input, cuentas: [] }).success).toBe(false);
    expect(initializationContract.safeParse({ ...input, cuentas: [{ ...account, nombreBanco: ' ' }] }).success).toBe(false);
    expect(initializationContract.safeParse({ ...input, cuentas: [account, {
      ...account, nombreBanco: 'Otro banco', numeroCuenta: 'QA-001',
    }] }).success).toBe(false);
  });

  it('refleja la unicidad exacta del número de cuenta en PostgreSQL', () => {
    expect(initializationContract.safeParse({ ...input, cuentas: [account, {
      ...account, numeroCuenta: 'qa-001',
    }] }).success).toBe(true);
  });

describe('contrato de inicialización: fecha de corte, moneda funcional y evidencia FX', () => {
  const baseFx = {
    idempotencyKey: 'request-fx',
    fechaCorte: '2026-11-01',
    monedaFuncional: 'cup',
    cuentas: [{
      nombreCuenta: 'Caja de prueba',
      nombreBanco: 'Banco QA',
      numeroCuenta: 'QA-001',
      tipoCuenta: 'Ahorros',
      moneda: 'CUP',
      saldoInicial: '100000',
      origen: { tipo: 'CAPITAL_SOCIAL', tercero: 'Socio QA' },
    }],
  };

  it('acepta fecha de corte y moneda funcional normalizada', () => {
    const result = initializationContract.parse(baseFx);
    expect(result.fechaCorte).toBe('2026-11-01');
    expect(result.monedaFuncional).toBe('CUP');
  });

  it('exige fecha de corte y moneda funcional', () => {
    expect(initializationContract.safeParse({ idempotencyKey: 'x', cuentas: baseFx.cuentas }).success).toBe(false);
    expect(initializationContract.safeParse({ ...baseFx, fechaCorte: undefined }).success).toBe(false);
    expect(initializationContract.safeParse({ ...baseFx, monedaFuncional: undefined }).success).toBe(false);
  });

  it('rechaza fecha de corte futura, inválida o con otro formato', () => {
    expect(initializationContract.safeParse({ ...baseFx, fechaCorte: '2999-01-01' }).success).toBe(false);
    expect(initializationContract.safeParse({ ...baseFx, fechaCorte: '2026-13-01' }).success).toBe(false);
    expect(initializationContract.safeParse({ ...baseFx, fechaCorte: '2026-02-30' }).success).toBe(false);
    expect(initializationContract.safeParse({ ...baseFx, fechaCorte: '01/11/2026' }).success).toBe(false);
  });

  it('rechaza moneda funcional con formato inválido', () => {
    expect(initializationContract.safeParse({ ...baseFx, monedaFuncional: 'CU' }).success).toBe(false);
    expect(initializationContract.safeParse({ ...baseFx, monedaFuncional: 'CUP1' }).success).toBe(false);
  });

  it('no exige tasas cuando todas las cuentas están en moneda funcional', () => {
    expect(initializationContract.safeParse(baseFx).success).toBe(true);
  });

  it('exige tasa para cada moneda distinta a la funcional', () => {
    const usd = { ...baseFx.cuentas[0], moneda: 'USD', origen: { tipo: 'CAPITAL_SOCIAL', tercero: 'Socio QA' } };
    expect(initializationContract.safeParse({ ...baseFx, cuentas: [usd] }).success).toBe(false);
    expect(initializationContract.safeParse({ ...baseFx, cuentas: [usd], tasas: { EUR: '400' } }).success).toBe(false);
    expect(initializationContract.safeParse({ ...baseFx, cuentas: [usd], tasas: { USD: '400' } }).success).toBe(true);
  });

  it('exige tasa también con origen no documentado en moneda extranjera', () => {
    const usd = { ...baseFx.cuentas[0], moneda: 'USD', origen: undefined, origenNoDocumentado: true };
    expect(initializationContract.safeParse({ ...baseFx, cuentas: [usd] }).success).toBe(false);
    expect(initializationContract.safeParse({ ...baseFx, cuentas: [usd], tasas: { USD: '400' } }).success).toBe(true);
  });

  it('acepta la tasa del origen como evidencia FX sin mapa de tasas', () => {
    const usd = { ...baseFx.cuentas[0], moneda: 'USD', origen: { tipo: 'CAPITAL_SOCIAL', tercero: 'Socio QA', tasaCambio: '400' } };
    expect(initializationContract.safeParse({ ...baseFx, cuentas: [usd] }).success).toBe(true);
  });

  it('rechaza tasas cero, negativas o no numéricas', () => {
    const usd = { ...baseFx.cuentas[0], moneda: 'USD', origen: { tipo: 'CAPITAL_SOCIAL', tercero: 'Socio QA' } };
    expect(initializationContract.safeParse({ ...baseFx, cuentas: [usd], tasas: { USD: '0' } }).success).toBe(false);
    expect(initializationContract.safeParse({ ...baseFx, cuentas: [usd], tasas: { USD: '-5' } }).success).toBe(false);
    expect(initializationContract.safeParse({ ...baseFx, cuentas: [usd], tasas: { USD: 'abc' } }).success).toBe(false);
  });
});
});
