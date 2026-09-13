/**
 * @description Datos monetarios usados para calcular el pago de nómina.
 * `horasExtras` es un campo legacy que guarda HORAS (no dinero): se conserva
 * en la interfaz solo para lectura histórica y nunca entra al cálculo.
 */
export interface PayrollAmountInput {
  salario: number;
  bonificaciones?: number | null;
  deducciones?: number | null;
  montoHorasExtras?: number | null;
  /** @deprecated Horas históricas; no participan del cálculo. */
  horasExtras?: number | null;
}

/**
 * @description Calcula el importe neto que debe reconocerse y pagarse al empleado.
 * Fórmula: salario + bonificaciones + montoHorasExtras − deducciones.
 * @param {PayrollAmountInput} payroll - Componentes del pago salarial.
 * @returns {number} Importe neto después de deducciones.
 */
export function getPayrollPaymentAmount(payroll: PayrollAmountInput): number {
  return payroll.salario + (payroll.bonificaciones ?? 0) +
    (payroll.montoHorasExtras ?? 0) - (payroll.deducciones ?? 0);
}
