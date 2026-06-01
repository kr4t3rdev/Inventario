import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { VacationAccrualService } from "@/lib/vacation-accrual-service"
import { calculatePayrollFormulas, getPayrollConfig } from "@/lib/payroll-formulas"

const calculatePayrollSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "Formato de período inválido (YYYY-MM)"),
  employeeIds: z.array(z.string()).optional(),
  includeVacationAccrual: z.boolean().default(true),
  forceRecalculate: z.boolean().default(false)
});

const vacationService = new VacationAccrualService();

export async function getNominaHandler(request: NextRequest) {
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

export async function calculateNominaHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = calculatePayrollSchema.parse(body);

    const { periodo, employeeIds, includeVacationAccrual = true, forceRecalculate = false } = validatedData;
    const [year, month] = periodo.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

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
      await prisma.pagosalario.deleteMany({
        where: { periodo }
      });
    }

    let empleados;
    if (employeeIds && employeeIds.length > 0) {
      empleados = await prisma.empleado.findMany({
        where: {
          empleadoId: { in: employeeIds },
          fechaContratacion: { not: undefined }
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

    const payrollConfig = await getPayrollConfig(periodo);

    const payrollRecords = [];
    const vacationResults = [];

    for (const empleado of empleados) {
      try {
        const attendances = await prisma.attendance.findMany({
          where: {
            employeeId: empleado.empleadoId,
            date: {
              gte: startDate,
              lte: endDate
            }
          }
        });

        let totalHours = 0;
        let overtimeHours = 0;

        for (const attendance of attendances) {
          if (attendance.totalHours) {
            totalHours += Number(attendance.totalHours);
            const hours = Number(attendance.totalHours);
            if (hours > 8) {
              overtimeHours += hours - 8;
            }
          }
        }

        const baseSalary = empleado.salarioBases;
        const standardHours = 192;

        const hourlyRate = baseSalary / standardHours;

        const hoursWorked = totalHours > 0 ? totalHours : standardHours;
        const bonificaciones = 0;
        const devengadoReal = (hoursWorked / standardHours) * baseSalary + bonificaciones;

        const calculations = calculatePayrollFormulas(devengadoReal, payrollConfig);

        const payroll = await prisma.pagosalario.create({
          data: {
            empleadoId: empleado.empleadoId,
            salario: Math.round(calculations.netoACobrar),
            bonificaciones,
            deducciones: Math.round(calculations.deducciones.total),
            horasExtras: Math.round(overtimeHours),
            periodo,
            tenantId: empleado.tenantId,
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

const updatePayrollSchema = z.object({
  salario: z.number().min(0).optional(),
  bonificaciones: z.number().min(0).optional(),
  deducciones: z.number().min(0).optional(),
  horasExtras: z.number().min(0).optional(),
  observaciones: z.string().optional()
});

export async function getNominaByIdHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const payroll = await prisma.pagosalario.findUnique({
      where: { pgId: id },
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

    if (!payroll) {
      return NextResponse.json(
        { error: "Registro de nómina no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(payroll);
  } catch (error) {
    console.error("Error obteniendo registro de nómina:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function updateNominaHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updatePayrollSchema.parse(body);

    const existingPayroll = await prisma.pagosalario.findUnique({
      where: { pgId: id }
    });

    if (!existingPayroll) {
      return NextResponse.json(
        { error: "Registro de nómina no encontrado" },
        { status: 404 }
      );
    }

    const updatedPayroll = await prisma.pagosalario.update({
      where: { pgId: id },
      data: validatedData,
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

    return NextResponse.json(updatedPayroll);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error actualizando registro de nómina:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function deleteNominaHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingPayroll = await prisma.pagosalario.findUnique({
      where: { pgId: id }
    });

    if (!existingPayroll) {
      return NextResponse.json(
        { error: "Registro de nómina no encontrado" },
        { status: 404 }
      );
    }

    await prisma.pagosalario.delete({
      where: { pgId: id }
    });

    return NextResponse.json({ message: "Registro de nómina eliminado" });
  } catch (error) {
    console.error("Error eliminando registro de nómina:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

