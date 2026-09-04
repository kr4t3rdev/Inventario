/**
 * @description Datos monetarios usados para calcular el pago de nómina.
 */
export interface PayrollAmountInput {
  salario: number;
  bonificaciones?: number | null;
  deducciones?: number | null;
  horasExtras?: number | null;
}

/**
 * @description Calcula el importe neto que debe reconocerse y pagarse al empleado.
 * @param {PayrollAmountInput} payroll - Componentes del pago salarial.
 * @returns {number} Importe neto después de deducciones.
 */
export function getPayrollPaymentAmount(payroll: PayrollAmountInput): number {
  return payroll.salario + (payroll.bonificaciones ?? 0) +
    (payroll.horasExtras ?? 0) - (payroll.deducciones ?? 0);
}
