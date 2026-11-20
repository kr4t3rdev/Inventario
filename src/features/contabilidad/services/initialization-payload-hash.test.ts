import { describe, expect, it } from 'vitest';
import { computeInitializationPayloadHash } from './initialization-idempotency';

describe('hash canónico de carga de inicialización', () => {
  it('produce el mismo hash con distinto orden de claves', () => {
    const a = { cuentas: [{ numeroCuenta: 'QA-001', saldoInicial: '100000' }], fechaCorte: '2026-11-01' };
    const b = { fechaCorte: '2026-11-01', cuentas: [{ saldoInicial: '100000', numeroCuenta: 'QA-001' }] };
    expect(computeInitializationPayloadHash(a)).toBe(computeInitializationPayloadHash(b));
  });

  it('produce el mismo hash con distinto orden de claves anidadas', () => {
    const a = { tasas: { USD: '400', EUR: '450' } };
    const b = { tasas: { EUR: '450', USD: '400' } };
    expect(computeInitializationPayloadHash(a)).toBe(computeInitializationPayloadHash(b));
  });

  it('devuelve un sha256 hexadecimal estable de 64 caracteres', () => {
    const hash = computeInitializationPayloadHash({ cuentas: [] });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(computeInitializationPayloadHash({ cuentas: [] })).toBe(hash);
  });

  it('cambia cuando cambia el contenido', () => {
    const a = computeInitializationPayloadHash({ cuentas: [{ saldoInicial: '100' }] });
    const b = computeInitializationPayloadHash({ cuentas: [{ saldoInicial: '200' }] });
    expect(a).not.toBe(b);
  });

  it('rechaza valores que no se pueden serializar de forma estable', () => {
    expect(() => computeInitializationPayloadHash({ x: undefined })).toThrow();
    expect(() => computeInitializationPayloadHash({ x: Number.NaN })).toThrow();
    expect(() => computeInitializationPayloadHash({ x: () => 1 })).toThrow();
  });
});
