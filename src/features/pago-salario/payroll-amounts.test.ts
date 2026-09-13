import { describe, expect, it } from 'vitest';

import { getPayrollPaymentAmount } from './payroll-amounts';

describe('getPayrollPaymentAmount', () => {
  it('suma bonificaciones y el monto de horas extras, y resta deducciones', () => {
    expect(
      getPayrollPaymentAmount({
        salario: 1000,
        bonificaciones: 100,
        montoHorasExtras: 90,
        deducciones: 200,
      }),
    ).toBe(990);
  });

  it('no suma el campo legacy de horas como si fuera dinero', () => {
    // Registros históricos: horasExtras guarda HORAS (p. ej. 6 h), no pesos.
    // El monto a pagar no debe inflarse cuando solo existe el campo legacy.
    expect(getPayrollPaymentAmount({ salario: 1000, horasExtras: 6 })).toBe(1000);
  });

  it('trata componentes opcionales ausentes como cero', () => {
    expect(getPayrollPaymentAmount({ salario: 1000 })).toBe(1000);
  });
});
