import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { VacationAccrualService } from "@/lib/vacation-accrual-service";

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

    const payrollRecords = [];
    const vacationResults = [];

    for (const empleado of empleados) {
      try {
        // Calcular horas extras y deducciones basadas en asistencia
        const [year, month] = periodo.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Último día del mes

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
        const overtimePay = overtimeHours * (baseSalary / 240) * 1.5; // Asumiendo 240 horas/mes, 1.5x para extras
        const grossSalary = baseSalary + overtimePay;

        const pagoSalarios = prisma.pagosalario.findMany({
          orderBy: { createdAt: 'desc'}
        })

        const bonificaciones = Number((await pagoSalarios).find((ps: any) => ps.empleadoId === empleado.empleadoId)?.bonificaciones || 0);

        // Deducciones básicas (pueden ser configurables)
        const deductions = Math.round(grossSalary * 0.1); // 10% deducciones
        const netSalary = grossSalary - deductions;

        // Crear registro de nómina
        const payroll = await prisma.pagosalario.create({
          data: {
            empleadoId: empleado.empleadoId,
            salario: baseSalary,
            bonificaciones,
            deducciones: deductions,
            horasExtras: Math.round(overtimeHours),
            periodo,
            observaciones: `Horas trabajadas: ${totalHours.toFixed(2)}, Horas extras: ${overtimeHours.toFixed(2)}`
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