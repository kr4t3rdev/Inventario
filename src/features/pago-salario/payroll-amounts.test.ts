import { describe, expect, it } from 'vitest';

import { getPayrollPaymentAmount } from './payroll-amounts';

describe('getPayrollPaymentAmount', () => {
  it('suma bonificaciones y horas extras y resta deducciones', () => {
    expect(getPayrollPaymentAmount({ salario: 1000, bonificaciones: 100, horasExtras: 50, deducciones: 200 })).toBe(950);
  });

  it('trata componentes opcionales ausentes como cero', () => {
    expect(getPayrollPaymentAmount({ salario: 1000 })).toBe(1000);
  });
});
