import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { VacationAccrualService } from "@/lib/vacation-accrual-service";
import { calculateEmployeeDeductions, calculateEmployerContributions } from "@/lib/payroll-utils";
import { calculatePayrollFormulas, getPayrollConfig } from "@/lib/payroll-formulas";

/**
 * Esquema de validación para cálculo de nómina
 */
const calculatePayrollSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "Formato de período inválido (YYYY-MM)"),
  employeeIds: z.array(z.string()).optional(), // Si no se especifica, calcula para todos
  includeVacationAccrual: z.boolean().default(true), // Incluir acumulación automática de vacaciones
  forceRecalculate: z.boolean().default(false) // Forzar recálculo aunque exista nómina
});

/**
 * Servicio de acumulación de vacaciones
 */
const vacationService = new VacationAccrualService();

/**
 * Obtiene los registros de nómina
 * @param request - Solicitud HTTP
 * @returns Lista de registros de nómina
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo");
    const employeeId = searchParams.get("employeeId");

    const where: any = {};

    if (periodo) {
      where.periodo = periodo;
    }

    if (employeeId) {
      where.empleadoId = employeeId;
    }

    const payrolls = await prisma.pagosalario.findMany({
      where,
      include: {
        empleado: {
          select: {
            nombre: true,
            apellido: true,
            cargo: true,
            salarioBases: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(payrolls);
  } catch (error) {
    console.error("Error obteniendo nómina:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * Calcula y crea registros de nómina para un período
 * @param request - Solicitud HTTP con datos del cálculo
 * @returns Registros de nómina creados
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = calculatePayrollSchema.parse(body);

    const { periodo, employeeIds, includeVacationAccrual = true, forceRecalculate = false } = validatedData;
    const [year, month] = periodo.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Verificar si ya existe nómina para este período (a menos que se fuerce el recálculo)
    if (!forceRecalculate) {
      const existingPayrolls = await prisma.pagosalario.findMany({
        where: { periodo },
        include: {
          empleado: {
            select: {
              nombre: true,
              apellido: true,
              cargo: true,
              salarioBases: true
            }
          }
        }
      });

      if (existingPayrolls.length > 0) {
        return NextResponse.json({
          payrolls: existingPayrolls,
          message: `Ya existe nómina calculada para este período con ${existingPayrolls.length} empleados`,
          existing: true
        }, { status: 200 });
      }
    } else {
      // Si se fuerza el recálculo, eliminar nómina existente
      await prisma.pagosalario.deleteMany({
        where: { periodo }
      });
    }

    // Obtener empleados
    let empleados;
    if (employeeIds && employeeIds.length > 0) {
      empleados = await prisma.empleado.findMany({
        where: {
          empleadoId: { in: employeeIds },
          fechaContratacion: { not: undefined } // Solo empleados con fecha de contratación
        }
      });
    } else {
      empleados = await prisma.empleado.findMany({
        where: {
          fechaContratacion: { not: undefined }
        }
      });
    }

    if (empleados.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron empleados con fecha de contratación para calcular nómina" },
        { status: 404 }
      );
    }

    // Obtener configuración de nómina para el período
    const payrollConfig = await getPayrollConfig(periodo);

    const payrollRecords = [];
    const vacationResults = [];

    for (const empleado of empleados) {
      try {
        // Obtener registros de asistencia del período
        const attendances = await prisma.attendance.findMany({
          where: {
            employeeId: empleado.empleadoId,
            date: {
              gte: startDate,
              lte: endDate
            }
          }
        });

        // Calcular horas trabajadas y extras
        let totalHours = 0;
        let overtimeHours = 0;

        for (const attendance of attendances) {
          if (attendance.totalHours) {
            totalHours += Number(attendance.totalHours);
            // Asumir que horas extras son > 8 horas/día
            const hours = Number(attendance.totalHours);
            if (hours > 8) {
              overtimeHours += hours - 8;
            }
          }
        }

        // Calcular salario
        const baseSalary = empleado.salarioBases;
        // Asumiendo horas mensuales estándar de 190.6 horas (promedio mensual laboral) o 24/192 como en el excel
        // El excel muestra 24 días / 192 horas para salario completo. 192 horas.
        const standardHours = 192; 
        
        const hourlyRate = baseSalary / standardHours;
        // Si hay horas extras, se suman (asumiendo 1.0x o factor configurable, usaremos 1.0 por defecto o lo que diga el excel implícitamente)
        // El excel no muestra cálculo explícito de horas extras con factor, solo "Devengado Real".
        // Asumiremos Devengado Real = (Horas Trabajadas / Horas Estándar) * Salario Base
        // Si Horas Trabajadas > Estándar, cobra más.
        
        const hoursWorked = totalHours > 0 ? totalHours : standardHours; // Si no hay asistencia registrada, asumir completo
        const bonificaciones = 0;
        const devengadoReal = (hoursWorked / standardHours) * baseSalary + bonificaciones;

        // Calcular fórmulas según Excel
        const calculations = calculatePayrollFormulas(devengadoReal, payrollConfig);

        // Crear registro de nómina
        const payroll = await prisma.pagosalario.create({
          data: {
            empleadoId: empleado.empleadoId,
            salario: Math.round(calculations.netoACobrar), 
            bonificaciones,
            deducciones: Math.round(calculations.deducciones.total),
            horasExtras: Math.round(overtimeHours),
            periodo,
            observaciones: `Devengado: ${devengadoReal.toFixed(2)}, Vacaciones (9.09%): ${calculations.vacaciones.toFixed(2)}. ` +
                           `Deducciones: 5%($${calculations.deducciones.p5.toFixed(2)}), 3%($${calculations.deducciones.p3.toFixed(2)})` +
                           (payrollConfig.aplicar12_5y1_5 ? `, 12.5%($${calculations.deducciones.p12_5.toFixed(2)}), 1.5%($${calculations.deducciones.p1_5.toFixed(2)})` : '')
          },
          include: {
            empleado: {
              select: {
                nombre: true,
                apellido: true,
                cargo: true,
                salarioBases: true
              }
            }
          }
        });

        payrollRecords.push(payroll);

        // Calcular acumulación automática de vacaciones si está habilitado
        if (includeVacationAccrual) {
          try {
            const vacationResult = await vacationService.calculateAccrualForEmployee(
              empleado.empleadoId,
              endDate,
              periodo
            );
            vacationResults.push({
              empleadoId: empleado.empleadoId,
              empleado: `${empleado.nombre} ${empleado.apellido}`,
              ...vacationResult
            });
          } catch (vacationError) {
            console.error(`Error calculando vacaciones para empleado ${empleado.empleadoId}:`, vacationError);
            vacationResults.push({
              empleadoId: empleado.empleadoId,
              empleado: `${empleado.nombre} ${empleado.apellido}`,
              error: vacationError instanceof Error ? vacationError.message : "Error calculando vacaciones",
              processed: false
            });
          }
        }

      } catch (error) {
        console.error(`Error procesando empleado ${empleado.empleadoId}:`, error);
        payrollRecords.push({
          empleadoId: empleado.empleadoId,
          empleado: `${empleado.nombre} ${empleado.apellido}`,
          error: error instanceof Error ? error.message : "Error procesando empleado",
          processed: false
        });
      }
    }

    return NextResponse.json({
      payrolls: payrollRecords,
      vacationAccruals: vacationResults.length > 0 ? vacationResults : undefined,
      message: `Nómina procesada para ${payrollRecords.length} empleados${vacationResults.length > 0 ? ` y acumulación de vacaciones para ${vacationResults.filter(v => v.processed).length} empleados` : ''}`
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error calculando nómina:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
