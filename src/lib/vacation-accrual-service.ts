import { prisma } from "@/lib/prisma";
import { addMonths, differenceInDays, differenceInMonths, format } from "date-fns";

/**
 * Configuración de acumulación de vacaciones
 */
interface VacationAccrualConfig {
  diasAnualesBase: number; // Días base por año (ej: 15 días)
  diasMaximosPorAntiguedad: number; // Máximo días adicionales por antigüedad
  mesesParaPrimerPeriodo: number; // Meses para acumular primer período completo
  incrementoAnual: number; // Incremento de días por año de antigüedad
}

/**
 * Configuración por defecto
 */
const DEFAULT_CONFIG: VacationAccrualConfig = {
  diasAnualesBase: 15,
  diasMaximosPorAntiguedad: 10,
  mesesParaPrimerPeriodo: 12,
  incrementoAnual: 1
};

/**
 * Servicio para gestión de acumulación automática de vacaciones
 */
export class VacationAccrualService {
  private config: VacationAccrualConfig;

  constructor(config?: Partial<VacationAccrualConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calcula días de vacaciones basados en antigüedad
   */
  private calculateDaysBySeniority(fechaContratacion: Date, fechaCalculo: Date): number {
    const mesesAntiguedad = differenceInMonths(fechaCalculo, fechaContratacion);
    const añosAntiguedad = Math.floor(mesesAntiguedad / 12);
    
    // Días base + incremento por años de antigüedad
    const diasIncremento = Math.min(
      añosAntiguedad * this.config.incrementoAnual,
      this.config.diasMaximosPorAntiguedad
    );
    
    return this.config.diasAnualesBase + diasIncremento;
  }

  /**
   * Calcula días proporcionales por tiempo trabajado en el período
   */
  private calculateProportionalDays(
    fechaContratacion: Date, 
    fechaCalculo: Date, 
    diasAnuales: number,
    periodo?: string
  ): number {
    const mesesAntiguedad = differenceInMonths(fechaCalculo, fechaContratacion);
    
    // Si es el primer período, calcular proporcionalmente
    if (mesesAntiguedad < this.config.mesesParaPrimerPeriodo) {
      const diasTrabajados = Math.min(
        mesesAntiguedad * 30, // Aproximación: 30 días por mes
        differenceInDays(fechaCalculo, fechaContratacion)
      );
      const diasPeriodo = this.config.mesesParaPrimerPeriodo * 30;
      
      return (diasTrabajados / diasPeriodo) * diasAnuales;
    }
    
    // Para períodos completos, usar la parte proporcional mensual (1/12 del anual)
    return diasAnuales / 12;
  }

  /**
   * Obtiene el período formateado (YYYY-MM)
   */
  private getPeriodo(fecha: Date = new Date()): string {
    return format(fecha, "yyyy-MM");
  }

  /**
   * Verifica si ya existe acumulación para un empleado y período
   */
  private async hasAccrualForPeriod(employeeId: string, periodo: string): Promise<boolean> {
    const existing = await prisma.vacationAccrual.findFirst({
      where: {
        employeeId,
        periodo,
        procesado: true
      }
    });
    
    return !!existing;
  }

  /**
   * Calcula y acumula vacaciones para un empleado específico
   */
  async calculateAccrualForEmployee(
    employeeId: string, 
    fechaCalculo: Date = new Date(),
    periodo?: string
  ): Promise<any> {
    try {
      const empleado = await prisma.empleado.findUnique({
        where: { empleadoId: employeeId }
      });

      if (!empleado) {
        throw new Error("Empleado no encontrado");
      }

      if (!empleado.fechaContratacion) {
        throw new Error("Fecha de contratación requerida para cálculo de vacaciones");
      }

      const periodoCalculo = periodo || this.getPeriodo(fechaCalculo);
      
      // Verificar si ya existe acumulación para este período
      if (await this.hasAccrualForPeriod(employeeId, periodoCalculo)) {
        return { message: "Ya existe acumulación procesada para este período", processed: false };
      }

      // Calcular días por antigüedad
      const diasPorAntiguedad = this.calculateDaysBySeniority(
        empleado.fechaContratacion, 
        fechaCalculo
      );

      // Calcular días proporcionales por tiempo trabajado
      const diasPorTiempoTrabajado = this.calculateProportionalDays(
        empleado.fechaContratacion,
        fechaCalculo,
        diasPorAntiguedad,
        periodoCalculo
      );

      // Crear registro de acumulación
      const accrual = await prisma.vacationAccrual.create({
        data: {
          employeeId,
          periodo: periodoCalculo,
          diasAcumulados: diasPorTiempoTrabajado,
          diasPorAntiguedad,
          diasPorTiempoTrabajado,
          tipoAcumulacion: "automatico_mensual",
          fechaCalculo: fechaCalculo,
          procesado: true
        }
      });

      // Actualizar días acumulados del empleado
      const nuevoTotalAcumulado = empleado.vacationDaysAccrued + diasPorTiempoTrabajado;
      await prisma.empleado.update({
        where: { empleadoId: employeeId },
        data: {
          vacationDaysAccrued: nuevoTotalAcumulado,
          diasVacacionesAnuales: diasPorAntiguedad
        }
      });

      return {
        accrual,
        empleadoActualizado: {
          ...empleado,
          vacationDaysAccrued: nuevoTotalAcumulado
        },
        message: "Acumulación calculada y aplicada correctamente",
        processed: true
      };

    } catch (error) {
      console.error("Error calculando acumulación de vacaciones:", error);
      throw error;
    }
  }

  /**
   * Calcula y acumula vacaciones para todos los empleados
   */
  async calculateAccrualForAllEmployees(
    fechaCalculo: Date = new Date(),
    periodo?: string
  ): Promise<any[]> {
    const empleados = await prisma.empleado.findMany({
      where: {
        fechaContratacion: {
          not: undefined
        }
      }
    });

    const resultados = [];
    
    for (const empleado of empleados) {
      try {
        const resultado = await this.calculateAccrualForEmployee(
          empleado.empleadoId,
          fechaCalculo,
          periodo
        );
        resultados.push({
          empleadoId: empleado.empleadoId,
          empleado: `${empleado.nombre} ${empleado.apellido}`,
          ...resultado
        });
      } catch (error) {
        console.error(`Error procesando empleado ${empleado.empleadoId}:`, error);
        resultados.push({
          empleadoId: empleado.empleadoId,
          empleado: `${empleado.nombre} ${empleado.apellido}`,
          error: error instanceof Error ? error.message : "Error desconocido",
          processed: false
        });
      }
    }

    return resultados;
  }

  /**
   * Obtiene el resumen de acumulación para un empleado
   */
  async getAccrualSummary(employeeId: string): Promise<any> {
    const empleado = await prisma.empleado.findUnique({
      where: { empleadoId: employeeId },
      include: {
        vacationAccruals: {
          orderBy: { createdAt: 'desc' },
          take: 12 // Últimos 12 registros
        }
      }
    });

    if (!empleado) {
      throw new Error("Empleado no encontrado");
    }

    const totalAcumulado = empleado.vacationDaysAccrued;
    const totalUsado = empleado.vacationDaysUsed;
    const diasDisponibles = totalAcumulado - totalUsado;

    // Calcular proyección anual
    const diasAnuales = empleado.diasVacacionesAnuales || this.config.diasAnualesBase;
    const proximaAcumulacion = addMonths(new Date(), 1);

    return {
      empleado: {
        id: empleado.empleadoId,
        nombre: empleado.nombre,
        apellido: empleado.apellido,
        cargo: empleado.cargo,
        fechaContratacion: empleado.fechaContratacion
      },
      resumen: {
        diasAcumulados: totalAcumulado,
        diasUsados: totalUsado,
        diasDisponibles,
        diasAnualesAsignados: diasAnuales,
        porcentajeUtilizado: totalAcumulado > 0 ? (totalUsado / totalAcumulado) * 100 : 0
      },
      historico: empleado.vacationAccruals,
      proyeccion: {
        proximaAcumulacion,
        diasProyectadosAnuales: diasAnuales
      }
    };
  }
}