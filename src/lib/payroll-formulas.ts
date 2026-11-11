export interface PayrollConfig {
  vacacionesPorcentaje: number
  impuesto3Porcentaje: number
  impuesto5Porcentaje: number
  impuesto12_5Porcentaje: number
  impuesto1_5Porcentaje: number
  aplicar12_5y1_5: boolean
}

/** Horas estándar del mes para la tarifa horaria. Única fuente (antes: 192 en servidor y 240 en UI). */
export const STANDARD_MONTHLY_HOURS = 192

/** Multiplicador legal de la hora extra sobre la tarifa horaria. */
export const OVERTIME_RATE_MULTIPLIER = 1.5

/**
 * Valores de horas extra que un tenant puede sobrescribir vía `NominaConfig`
 * (F-5). Ambos opcionales: los ausentes caen a los defaults vigentes.
 */
export interface HorasExtrasConfig {
  tarifaHoraExtra: number
  horasMensualesEstandar: number
}

/**
 * @description Calcula el dinero a pagar por horas extras. Las horas NUNCA se
 * suman directamente al salario: se multiplican por la tarifa horaria del
 * salario base y el multiplicador legal.
 * @param {number} horas - Cantidad de horas extras trabajadas.
 * @param {number} salarioBase - Salario base mensual del empleado.
 * @param {Partial<HorasExtrasConfig>} [config] - Config del tenant
 * (`NominaConfig`): tarifa y horas mensuales estándar. Sin config el cálculo
 * es idéntico byte-a-byte al histórico (1.5 / 192); config inválida cae a 0
 * (fail-closed, nunca inventa dinero).
 * @returns {number} Monto entero (los salarios se persisten como Int).
 */
export function calcularMontoHorasExtras(
  horas: number,
  salarioBase: number,
  config?: Partial<HorasExtrasConfig>,
): number {
  if (!horas || !salarioBase || horas <= 0 || salarioBase <= 0) return 0
  const horasMensuales = config?.horasMensualesEstandar ?? STANDARD_MONTHLY_HOURS
  const tarifa = config?.tarifaHoraExtra ?? OVERTIME_RATE_MULTIPLIER
  if (!Number.isFinite(horasMensuales) || horasMensuales <= 0) return 0
  if (!Number.isFinite(tarifa) || tarifa < 0) return 0
  return Math.round(horas * (salarioBase / horasMensuales) * tarifa)
}

const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  vacacionesPorcentaje: 9.09,
  impuesto3Porcentaje: 3,
  impuesto5Porcentaje: 5,
  impuesto12_5Porcentaje: 12.5,
  impuesto1_5Porcentaje: 1.5,
  aplicar12_5y1_5: true,
}

export async function getPayrollConfig(_periodo: string): Promise<PayrollConfig> {
  return DEFAULT_PAYROLL_CONFIG
}

export function calculatePayrollFormulas(
  devengadoReal: number, 
  config: PayrollConfig
) {
  // 1. Cálculo de Vacaciones (9.09% del Devengado Real)
  const vacaciones = devengadoReal * (config.vacacionesPorcentaje / 100);
  
  // Base Imponible para deducciones (Devengado + Vacaciones)
  const baseImponible = devengadoReal + vacaciones;

  // 2. Cálculo de Impuestos/Deducciones al Trabajador
  // 5% Seguridad Social (Asumiendo que el 5% del Excel es esto)
  const deduccion5 = baseImponible * (config.impuesto5Porcentaje / 100);
  
  // 3% Impuesto sobre Ingresos (Asumiendo que el 3% del Excel es esto)
  const deduccion3 = baseImponible * (config.impuesto3Porcentaje / 100);

  let deduccion12_5 = 0;
  let deduccion1_5 = 0;

  if (config.aplicar12_5y1_5) {
    // 12.5% (Probablemente Contribución Patronal o Impuesto Fuerza Trabajo, pero el Excel lo lista en columnas)
    // Si se resta al empleado, lo calculamos aquí. Si es patronal, va aparte.
    // Viendo el Excel, "Total Descuento" suma las columnas.
    // En Febrero: Total Descuento = col(0.125) + col(0.015) + col(0.03) + col(0.05)
    // Entonces TODOS se descuentan al trabajador.
    
    deduccion12_5 = baseImponible * (config.impuesto12_5Porcentaje / 100);
    deduccion1_5 = baseImponible * (config.impuesto1_5Porcentaje / 100);
  }

  const totalDeducciones = deduccion5 + deduccion3 + deduccion12_5 + deduccion1_5;
  const netoACobrar = baseImponible - totalDeducciones;

  return {
    vacaciones,
    baseImponible,
    deducciones: {
      p3: deduccion3,
      p5: deduccion5,
      p12_5: deduccion12_5,
      p1_5: deduccion1_5,
      total: totalDeducciones
    },
    netoACobrar
  };
}
