
import { differenceInMonths, differenceInDays } from "date-fns";

interface VacationAccrualConfig {
  diasAnualesBase: number;
  diasMaximosPorAntiguedad: number;
  mesesParaPrimerPeriodo: number;
  incrementoAnual: number;
}

const DEFAULT_CONFIG: VacationAccrualConfig = {
  diasAnualesBase: 15,
  diasMaximosPorAntiguedad: 10,
  mesesParaPrimerPeriodo: 12,
  incrementoAnual: 1
};

class VacationAccrualService {
  private config: VacationAccrualConfig;

  constructor(config?: Partial<VacationAccrualConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Updated Logic
  public calculateProportionalDays(
    fechaContratacion: Date, 
    fechaCalculo: Date, 
    diasAnuales: number,
    periodo?: string
  ): number {
    const mesesAntiguedad = differenceInMonths(fechaCalculo, fechaContratacion);
    
    // Si es el primer período, calcular proporcionalmente
    if (mesesAntiguedad < this.config.mesesParaPrimerPeriodo) {
      const diasTrabajados = Math.min(
        mesesAntiguedad * 30,
        differenceInDays(fechaCalculo, fechaContratacion)
      );
      const diasPeriodo = this.config.mesesParaPrimerPeriodo * 30;
      
      return (diasTrabajados / diasPeriodo) * diasAnuales;
    }
    
    // Para períodos completos, usar la parte proporcional mensual (1/12 del anual)
    return diasAnuales / 12;
  }
}

// Test Case
const service = new VacationAccrualService();
const fechaContratacion = new Date("2020-01-01"); // 5 years ago
const fechaCalculo = new Date("2025-01-01");
const diasAnuales = 20; // Example: 15 base + 5 seniority

const accrued = service.calculateProportionalDays(fechaContratacion, fechaCalculo, diasAnuales);

console.log(`Expected: ${diasAnuales / 12} (approx 1.66)`);
console.log(`Actual: ${accrued}`);

if (Math.abs(accrued - (diasAnuales / 12)) < 0.01) {
    console.log("PASS: Accruing correctly.");
} else {
    console.log("FAIL: Accruing incorrect amount!");
}
