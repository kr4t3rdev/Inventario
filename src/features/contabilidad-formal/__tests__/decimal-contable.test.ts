import { describe, expect, it } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { decimalFuncional, serializarDecimalContable } from '@/features/contabilidad-formal/services/decimal-contable';

describe('precisión funcional exacta', () => {
  it('acepta hasta cuatro decimales y serializa de forma canónica', () => {
    expect(serializarDecimalContable(decimalFuncional('1.2300'))).toBe('1.23');
    expect(serializarDecimalContable(decimalFuncional(new Prisma.Decimal('0.0001')))).toBe('0.0001');
    expect(serializarDecimalContable(decimalFuncional('1e-4'))).toBe('0.0001');
  });

  it.each(['0.00001', '1.23456', '-0.00001', '1.00009'])('rechaza precisión no representable %s', (valor) => {
    expect(() => decimalFuncional(valor)).toThrow('PRECISION_FUNCIONAL_INVALIDA');
  });

  it.each(['NaN', 'Infinity', '-Infinity', 'abc'])('rechaza importe no finito %s', (valor) => {
    expect(() => decimalFuncional(valor)).toThrow('IMPORTE_CONTABLE_INVALIDO');
  });
});
