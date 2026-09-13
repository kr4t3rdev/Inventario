import { describe, expect, it } from 'vitest';

import {
  calcularMontoHorasExtras,
  OVERTIME_RATE_MULTIPLIER,
  STANDARD_MONTHLY_HOURS,
} from './payroll-formulas';

describe('constantes de nómina', () => {
  it('unifica las horas estándar del mes en un solo valor', () => {
    expect(STANDARD_MONTHLY_HOURS).toBe(192);
  });

  it('unifica el multiplicador de hora extra', () => {
    expect(OVERTIME_RATE_MULTIPLIER).toBe(1.5);
  });
});

describe('calcularMontoHorasExtras', () => {
  it('paga las horas a 1.5× la tarifa horaria del salario base', () => {
    // salarioBases 1920 → tarifa 10/h → 40 h extra = 600
    expect(calcularMontoHorasExtras(40, 1920)).toBe(600);
  });

  it('redondea a entero (los salarios se persisten como Int)', () => {
    // salarioBases 1000 → tarifa ≈ 5.2083/h → 6 h extra ≈ 46.875 → 47
    expect(calcularMontoHorasExtras(6, 1000)).toBe(47);
  });

  it('devuelve 0 sin horas o sin salario base', () => {
    expect(calcularMontoHorasExtras(0, 1920)).toBe(0);
    expect(calcularMontoHorasExtras(10, 0)).toBe(0);
  });
});
