
/**
 * Utilidades para el cálculo de nómina y retenciones.
 * Basado en la legislación tributaria estándar para TCP en Cuba (o adaptable según Excel).
 */

export interface TaxBracket {
  limit: number; // Límite superior del tramo (Infinity para el último)
  rate: number;  // Tasa impositiva (0.05 para 5%)
}

// Escala progresiva estándar (Ejemplo basado en regulaciones recientes, ajustar según Excel)
// Hasta 3260: Exento
// Exceso de 3260 hasta 9510: 3%
// Exceso de 9510: 5%
export const STANDARD_TAX_BRACKETS: TaxBracket[] = [
  { limit: 3260, rate: 0 },       
  { limit: 9510, rate: 0.03 },    
  { limit: Infinity, rate: 0.05 } 
];

/**
 * Calcula el Impuesto sobre Ingresos Personales (ISR) basado en una escala progresiva.
 * @param taxableIncome Ingreso imponible (generalmente Salario Bruto)
 * @param brackets Escala de tramos (opcional)
 */
export function calculateIncomeTax(taxableIncome: number, brackets: TaxBracket[] = STANDARD_TAX_BRACKETS): number {
  let tax = 0;
  let previousLimit = 0;

  for (const bracket of brackets) {
    if (taxableIncome > previousLimit) {
      // El monto sujeto a impuesto en este tramo es el menor entre:
      // 1. El total de ingresos menos el límite anterior
      // 2. El límite actual menos el límite anterior (tamaño del tramo)
      const taxableInBracket = Math.min(taxableIncome, bracket.limit) - previousLimit;
      
      if (taxableInBracket > 0) {
        tax += taxableInBracket * bracket.rate;
      }
      
      previousLimit = bracket.limit;
    } else {
      break;
    }
  }

  return Math.round(tax * 100) / 100; // Redondear a 2 decimales
}

/**
 * Calcula la Contribución Especial a la Seguridad Social (Empleado)
 * Generalmente 5% del salario total.
 * @param grossSalary Salario Bruto
 * @param rate Tasa de contribución (por defecto 5%)
 */
export function calculateSocialSecurityEmployee(grossSalary: number, rate: number = 0.05): number {
  return Math.round(grossSalary * rate * 100) / 100;
}

/**
 * Calcula el Aporte a la Seguridad Social (Empleador)
 * Generalmente 14% de la nómina (o similar).
 * @param grossSalary Salario Bruto
 * @param rate Tasa de aporte (por defecto 14%)
 */
export function calculateSocialSecurityEmployer(grossSalary: number, rate: number = 0.14): number {
  return Math.round(grossSalary * rate * 100) / 100;
}

/**
 * Calcula el Impuesto por la Utilización de la Fuerza de Trabajo (Empleador)
 * Generalmente 5% de la nómina.
 * @param grossSalary Salario Bruto
 * @param rate Tasa de impuesto (por defecto 5%)
 */
export function calculateWorkforceTax(grossSalary: number, rate: number = 0.05): number {
  return Math.round(grossSalary * rate * 100) / 100;
}

/**
 * Calcula el total de deducciones del empleado (ISR + Seguridad Social)
 */
export function calculateEmployeeDeductions(grossSalary: number): { incomeTax: number, socialSecurity: number, total: number } {
  const socialSecurity = calculateSocialSecurityEmployee(grossSalary);
  const incomeTax = calculateIncomeTax(grossSalary);
  
  return {
    incomeTax,
    socialSecurity,
    total: Math.round(incomeTax + socialSecurity) // Redondeo final al entero más cercano para nómina
  };
}

/**
 * Calcula el total de aportes del empleador
 */
export function calculateEmployerContributions(grossSalary: number): { socialSecurity: number, workforceTax: number, total: number } {
  const socialSecurity = calculateSocialSecurityEmployer(grossSalary); // 14%
  const workforceTax = calculateWorkforceTax(grossSalary); // 5%
  
  return {
    socialSecurity,
    workforceTax,
    total: Math.round(socialSecurity + workforceTax) // Redondeo final
  };
}
