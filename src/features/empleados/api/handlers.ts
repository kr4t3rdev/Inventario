import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateUser, type AuthenticatedUser } from "@/lib/auth-middleware"
import { requireTenant } from "@/lib/services/tenant-scope"
import { z } from "zod"
import { Decimal } from "@/generated/prisma/runtime/library"
import { VacationAccrualService } from "@/lib/vacation-accrual-service"
import { calculateEmployeeDeductions, calculateEmployerContributions } from "@/lib/payroll-utils"
import { calculatePayrollFormulas, getPayrollConfig } from "@/lib/payroll-formulas"

// ─── Empleados ─────────────────────────────────────────────────────────────────

export async function getEmpleadosHandler(_request: NextRequest, _context: any, user: AuthenticatedUser) {
  try {
    const tenantId = requireTenant(user);
    const empleados = await prisma.empleado.findMany({
      where: { tenantId },
      orderBy: { salarioBases: "desc" },
    })

    return NextResponse.json(empleados)
  } catch (error) {
    console.error("Error al obtener empleados:", error)
    return NextResponse.json({ error: "Error al obtener empleados" }, { status: 500 })
  }
}

export async function createEmpleadoHandler(request: NextRequest, context: any, user: any) {
  try {
    const data = await request.json()
    const {
      nombre,
      apellido,
      telefono,
      cargo,
      salarioBases,
      fechaContratacion,
      esTiempoCompleto = true,
      diasVacacionesAnuales = 15
    } = data

    const empleado = await prisma.empleado.create({
      data: {
        nombre,
        apellido,
        telefono,
        cargo,
        salarioBases,
        fechaContratacion: fechaContratacion ? new Date(fechaContratacion) : new Date(),
        esTiempoCompleto,
        diasVacacionesAnuales
      },
    })

    return NextResponse.json(empleado)
  } catch (error) {
    console.error("Error al crear empleado:", error)
    return NextResponse.json({ error: "Error al crear empleado" }, { status: 500 })
  }
}

export async function getEmpleadoByIdHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const empleado = await prisma.empleado.findUnique({
      where: { empleadoId: id },
      include: {
        ventas: {
          include: {
            producto: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    })

    if (!empleado) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 })
    }

    return NextResponse.json(empleado)
  } catch (error) {
    console.error("Error al obtener empleado:", error)
    return NextResponse.json({ error: "Error al obtener empleado" }, { status: 500 })
  }
}

export async function updateEmpleadoHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const {
      nombre,
      apellido,
      telefono,
      cargo,
      salarioBases,

    } = await request.json()

    const empleado = await prisma.empleado.update({
      where: { empleadoId: id },
      data: {
        nombre,
        apellido,
        telefono,
        cargo,
        salarioBases,

      },
    })

    return NextResponse.json(empleado)
  } catch (error) {
    console.error("Error al actualizar empleado:", error)
    return NextResponse.json({ error: "Error al actualizar empleado" }, { status: 500 })
  }
}

export async function deleteEmpleadoHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await prisma.empleado.delete({
      where: { empleadoId: id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar empleado:", error)
    return NextResponse.json({ error: "Error al eliminar empleado" }, { status: 500 })
  }
}

// ─── Asistencia ────────────────────────────────────────────────────────────────

const asistenciaSchema = z.object({
  employeeId: z.string().min(1, "ID de empleado requerido"),
  action: z.enum(["checkin", "checkout"], {
    errorMap: () => ({ message: "Acción debe ser 'checkin' o 'checkout'" })
  })
});

const manualAttendanceSchema = z.object({
  attendanceId: z.string().min(1, "ID de asistencia requerido"),
  manualCheckIn: z.string().optional(),
  manualCheckOut: z.string().optional(),
  notes: z.string().optional(),
  approvedBy: z.string().optional()
});

async function handleManualAttendanceUpdate(body: any) {
  const validatedData = manualAttendanceSchema.parse(body);

  const { attendanceId, manualCheckIn, manualCheckOut, notes, approvedBy } = validatedData;

  const existingAttendance = await prisma.attendance.findUnique({
    where: { attendanceId },
    include: { employee: { select: { nombre: true, apellido: true, cargo: true } } }
  });

  if (!existingAttendance) {
    return NextResponse.json(
      { error: "Registro de asistencia no encontrado" },
      { status: 404 }
    );
  }

  let totalHours = existingAttendance.totalHours;
  let overtimeHours = existingAttendance.overtimeHours;

  if (manualCheckIn && manualCheckOut) {
    const checkInTime = new Date(manualCheckIn).getTime();
    const checkOutTime = new Date(manualCheckOut).getTime();
    const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);

    const dayOfWeek = new Date(existingAttendance.date).getDay();
    const workSchedule = await prisma.employeeWorkSchedule.findFirst({
      where: {
        employeeId: existingAttendance.employeeId,
        dayOfWeek,
        isWorkingDay: true
      }
    });

    totalHours = new Decimal(hoursWorked);
    if (workSchedule) {
      const scheduledHours = Number(workSchedule.scheduledHours);
      if (hoursWorked > scheduledHours) {
        overtimeHours = new Decimal(hoursWorked - scheduledHours);
      }
    }
  }

  const updatedAttendance = await prisma.attendance.update({
    where: { attendanceId },
    data: {
      manualCheckIn: manualCheckIn ? new Date(manualCheckIn) : undefined,
      manualCheckOut: manualCheckOut ? new Date(manualCheckOut) : undefined,
      totalHours: totalHours ? new Decimal(totalHours) : undefined,
      overtimeHours: overtimeHours ? new Decimal(overtimeHours) : undefined,
      notes,
      isManualEntry: true,
      approvedBy,
      approvedAt: approvedBy ? new Date() : undefined
    },
    include: {
      employee: {
        select: {
          nombre: true,
          apellido: true,
          cargo: true
        }
      }
    }
  });

  return NextResponse.json(updatedAttendance);
}

export async function getAsistenciaHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const date = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (date) {
      const targetDate = new Date(date);
      where.date = {
        gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
        lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1)
      };
    }

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const asistencia = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            nombre: true,
            apellido: true,
            cargo: true
          }
        }
      },
      orderBy: {
        date: "desc"
      }
    });

    const enrichedAsistencia = await Promise.all(
      asistencia.map(async (record: any) => {
        const dayOfWeek = new Date(record.date).getDay();
        const workSchedule = await prisma.employeeWorkSchedule.findFirst({
          where: {
            employeeId: record.employeeId,
            dayOfWeek,
            isWorkingDay: true
          }
        });

        return {
          ...record,
          scheduledHours: workSchedule?.scheduledHours || null,
          workSchedule: workSchedule ? {
            startTime: workSchedule.startTime,
            endTime: workSchedule.endTime,
            breakStartTime: workSchedule.breakStartTime,
            breakEndTime: workSchedule.breakEndTime
          } : null
        };
      })
    );

    return NextResponse.json(enrichedAsistencia);
  } catch (error) {
    console.error("Error obteniendo asistencia:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function postAsistenciaHandler(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.attendanceId) {
      return await handleManualAttendanceUpdate(body);
    }

    const validatedData = asistenciaSchema.parse(body);

    const { employeeId, action } = validatedData;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const empleado = await prisma.empleado.findUnique({
      where: { empleadoId: employeeId }
    });

    if (!empleado) {
      return NextResponse.json(
        { error: "Empleado no encontrado" },
        { status: 404 }
      );
    }

    let asistencia = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });

    if (action === "checkin") {
      if (asistencia && asistencia.checkIn) {
        return NextResponse.json(
          { error: "Ya se registró entrada para hoy" },
          { status: 400 }
        );
      }

      if (!asistencia) {
        asistencia = await prisma.attendance.create({
          data: {
            employeeId,
            date: today,
            checkIn: now,
            status: "present"
          },
          include: {
            employee: {
              select: {
                nombre: true,
                apellido: true,
                cargo: true
              }
            }
          }
        });
      } else {
        asistencia = await prisma.attendance.update({
          where: { attendanceId: asistencia.attendanceId },
          data: { checkIn: now },
          include: {
            employee: {
              select: {
                nombre: true,
                apellido: true,
                cargo: true
              }
            }
          }
        });
      }
    } else if (action === "checkout") {
      if (!asistencia || !asistencia.checkIn) {
        return NextResponse.json(
          { error: "Debe registrar entrada antes de salida" },
          { status: 400 }
        );
      }

      if (asistencia.checkOut) {
        return NextResponse.json(
          { error: "Ya se registró salida para hoy" },
          { status: 400 }
        );
      }

      const checkInTime = asistencia.checkIn.getTime();
      const checkOutTime = now.getTime();
      const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);

      asistencia = await prisma.attendance.update({
        where: { attendanceId: asistencia.attendanceId },
        data: {
          checkOut: now,
          totalHours: hoursWorked
        },
        include: {
          employee: {
            select: {
              nombre: true,
              apellido: true,
              cargo: true
            }
          }
        }
      });
    }

    return NextResponse.json(asistencia);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error registrando asistencia:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

const updateAsistenciaSchema = z.object({
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  totalHours: z.number().min(0).optional(),
  status: z.enum(["present", "absent", "late", "half-day"]).optional()
});

export async function getAsistenciaByIdHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const asistencia = await prisma.attendance.findUnique({
      where: { attendanceId: id },
      include: {
        employee: {
          select: {
            nombre: true,
            apellido: true,
            cargo: true
          }
        }
      }
    });

    if (!asistencia) {
      return NextResponse.json(
        { error: "Registro de asistencia no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(asistencia);
  } catch (error) {
    console.error("Error obteniendo asistencia:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function updateAsistenciaHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateAsistenciaSchema.parse(body);

    const existingAsistencia = await prisma.attendance.findUnique({
      where: { attendanceId: id }
    });

    if (!existingAsistencia) {
      return NextResponse.json(
        { error: "Registro de asistencia no encontrado" },
        { status: 404 }
      );
    }

    let totalHours = validatedData.totalHours;
    if ((validatedData.checkIn || validatedData.checkOut) && !totalHours) {
      const checkIn = validatedData.checkIn ? new Date(validatedData.checkIn) : existingAsistencia.checkIn;
      const checkOut = validatedData.checkOut ? new Date(validatedData.checkOut) : existingAsistencia.checkOut;

      if (checkIn && checkOut) {
        const hoursWorked = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        totalHours = hoursWorked;
      }
    }

    const updatedAsistencia = await prisma.attendance.update({
      where: { attendanceId: id },
      data: {
        ...validatedData,
        checkIn: validatedData.checkIn ? new Date(validatedData.checkIn) : undefined,
        checkOut: validatedData.checkOut ? new Date(validatedData.checkOut) : undefined,
        totalHours
      },
      include: {
        employee: {
          select: {
            nombre: true,
            apellido: true,
            cargo: true
          }
        }
      }
    });

    return NextResponse.json(updatedAsistencia);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error actualizando asistencia:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function deleteAsistenciaHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingAsistencia = await prisma.attendance.findUnique({
      where: { attendanceId: id }
    });

    if (!existingAsistencia) {
      return NextResponse.json(
        { error: "Registro de asistencia no encontrado" },
        { status: 404 }
      );
    }

    await prisma.attendance.delete({
      where: { attendanceId: id }
    });

    return NextResponse.json({ message: "Registro de asistencia eliminado" });
  } catch (error) {
    console.error("Error eliminando asistencia:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ─── Nómina ────────────────────────────────────────────────────────────────────

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

// ─── Vacaciones ────────────────────────────────────────────────────────────────

const vacationRequestSchema = z.object({
  employeeId: z.string().min(1, "ID de empleado requerido"),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  endDate: z.string().min(1, "Fecha de fin requerida"),
  reason: z.string().optional()
});

export async function getVacacionesHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");

    const where: any = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status) {
      where.status = status;
    }

    const vacationRequests = await prisma.vacationRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            nombre: true,
            apellido: true,
            cargo: true,
            vacationDaysAccrued: true,
            vacationDaysUsed: true,
            fechaContratacion: true,
            diasVacacionesAnuales: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(vacationRequests);
  } catch (error) {
    console.error("Error obteniendo solicitudes de vacaciones:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function createVacacionHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = vacationRequestSchema.parse(body);

    const { employeeId, startDate, endDate, reason } = validatedData;

    const empleado = await prisma.empleado.findUnique({
      where: { empleadoId: employeeId },
      select: {
        vacationDaysAccrued: true,
        vacationDaysUsed: true,
        fechaContratacion: true,
        diasVacacionesAnuales: true,
        nombre: true,
        apellido: true
      }
    });

    if (!empleado) {
      return NextResponse.json(
        { error: "Empleado no encontrado" },
        { status: 404 }
      );
    }

    if (!empleado.fechaContratacion) {
      return NextResponse.json(
        { error: "El empleado debe tener fecha de contratación configurada para solicitar vacaciones" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysRequested = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const daysAvailable = empleado.vacationDaysAccrued - empleado.vacationDaysUsed;
    if (daysRequested > daysAvailable) {
      return NextResponse.json(
        {
          error: "Días de vacaciones insuficientes",
          available: daysAvailable,
          requested: daysRequested,
          empleado: {
            nombre: empleado.nombre,
            apellido: empleado.apellido,
            diasAnualesAsignados: empleado.diasVacacionesAnuales,
            fechaContratacion: empleado.fechaContratacion
          }
        },
        { status: 400 }
      );
    }

    const conflictingRequest = await prisma.vacationRequest.findFirst({
      where: {
        employeeId,
        status: "pending",
        OR: [
          {
            AND: [
              { startDate: { lte: start } },
              { endDate: { gte: start } }
            ]
          },
          {
            AND: [
              { startDate: { lte: end } },
              { endDate: { gte: end } }
            ]
          },
          {
            AND: [
              { startDate: { gte: start } },
              { endDate: { lte: end } }
            ]
          }
        ]
      }
    });

    if (conflictingRequest) {
      return NextResponse.json(
        { error: "Ya existe una solicitud de vacaciones en este período" },
        { status: 400 }
      );
    }

    const mesesAntiguedad = Math.floor((start.getTime() - empleado.fechaContratacion.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (mesesAntiguedad < 6) {
      return NextResponse.json(
        {
          error: "Antigüedad insuficiente para solicitar vacaciones",
          mesesAntiguedad,
          mesesRequeridos: 6
        },
        { status: 400 }
      );
    }

    const vacationRequest = await prisma.vacationRequest.create({
      data: {
        employeeId,
        startDate: start,
        endDate: end,
        daysRequested,
        reason
      },
      include: {
        employee: {
          select: {
            nombre: true,
            apellido: true,
            cargo: true,
            vacationDaysAccrued: true,
            vacationDaysUsed: true,
            fechaContratacion: true,
            diasVacacionesAnuales: true
          }
        }
      }
    });

    return NextResponse.json(vacationRequest, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creando solicitud de vacaciones:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

const updateVacationSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
  approvedBy: z.string().optional()
});

export async function getVacacionByIdHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const vacationRequest = await prisma.vacationRequest.findUnique({
      where: { requestId: id },
      include: {
        employee: {
          select: {
            nombre: true,
            apellido: true,
            cargo: true,
            vacationDaysAccrued: true,
            vacationDaysUsed: true
          }
        }
      }
    });

    if (!vacationRequest) {
      return NextResponse.json(
        { error: "Solicitud de vacaciones no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(vacationRequest);
  } catch (error) {
    console.error("Error obteniendo solicitud de vacaciones:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function updateVacacionHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateVacationSchema.parse(body);

    const existingRequest = await prisma.vacationRequest.findUnique({
      where: { requestId: id },
      include: {
        employee: {
          select: {
            vacationDaysAccrued: true,
            vacationDaysUsed: true
          }
        }
      }
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: "Solicitud de vacaciones no encontrada" },
        { status: 404 }
      );
    }

    const updateData: any = {
      status: validatedData.status
    };

    if (validatedData.status === "approved") {
      updateData.approvedBy = validatedData.approvedBy;
      updateData.approvedAt = new Date();

      const newUsedDays = existingRequest.employee.vacationDaysUsed + existingRequest.daysRequested;
      await prisma.empleado.update({
        where: { empleadoId: existingRequest.employeeId },
        data: { vacationDaysUsed: newUsedDays }
      });
    }

    const updatedRequest = await prisma.vacationRequest.update({
      where: { requestId: id },
      data: updateData,
      include: {
        employee: {
          select: {
            nombre: true,
            apellido: true,
            cargo: true,
            vacationDaysAccrued: true,
            vacationDaysUsed: true
          }
        }
      }
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error actualizando solicitud de vacaciones:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function deleteVacacionHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingRequest = await prisma.vacationRequest.findUnique({
      where: { requestId: id }
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: "Solicitud de vacaciones no encontrada" },
        { status: 404 }
      );
    }

    if (existingRequest.status !== "pending") {
      return NextResponse.json(
        { error: "No se puede eliminar una solicitud ya procesada" },
        { status: 400 }
      );
    }

    await prisma.vacationRequest.delete({
      where: { requestId: id }
    });

    return NextResponse.json({ message: "Solicitud de vacaciones eliminada" });
  } catch (error) {
    console.error("Error eliminando solicitud de vacaciones:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ─── Vacaciones - Acumulación ──────────────────────────────────────────────────

const manualAccrualSchema = z.object({
  employeeId: z.string().min(1, "ID de empleado requerido"),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "Formato de período inválido (YYYY-MM)"),
  fechaCalculo: z.string().optional()
});

export async function getVacacionAccumulacionHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { error: "ID de empleado requerido" },
        { status: 400 }
      );
    }

    const vacationService = new VacationAccrualService();
    const summary = await vacationService.getAccrualSummary(employeeId);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error obteniendo resumen de vacaciones:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function calculateVacacionAccumulacionHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = manualAccrualSchema.parse(body);

    const { employeeId, periodo, fechaCalculo } = validatedData;

    const vacationService = new VacationAccrualService();
    const fechaCalculoDate = fechaCalculo ? new Date(fechaCalculo) : new Date();

    const result = await vacationService.calculateAccrualForEmployee(
      employeeId,
      fechaCalculoDate,
      periodo
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error calculando acumulación manual:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ─── Vacaciones - Acumulación Masiva ───────────────────────────────────────────

const massAccrualSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "Formato de período inválido (YYYY-MM)"),
  employeeIds: z.array(z.string()).optional(),
  fechaCalculo: z.string().optional(),
  incluirSinFechaContratacion: z.boolean().default(false)
});

export async function getMassAccrualHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo") || new Date().toISOString().slice(0, 7);

    const acumulaciones = await prisma.vacationAccrual.findMany({
      where: { periodo },
      include: {
        employee: {
          select: {
            nombre: true,
            apellido: true,
            cargo: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const empleados = await prisma.empleado.findMany({
      where: { fechaContratacion: { not: undefined } },
      select: {
        empleadoId: true,
        nombre: true,
        apellido: true,
        cargo: true,
        vacationDaysAccrued: true,
        vacationDaysUsed: true,
        fechaContratacion: true,
        diasVacacionesAnuales: true
      }
    });

    const estadisticas = {
      periodo,
      totalEmpleados: empleados.length,
      empleadosConAcumulacion: acumulaciones.length,
      totalDiasAcumulados: acumulaciones.reduce((sum: number, acc: { diasAcumulados: number }) => sum + acc.diasAcumulados, 0),
      totalDiasUsados: empleados.reduce((sum: number, emp: { vacationDaysUsed: number }) => sum + emp.vacationDaysUsed, 0),
      totalDiasDisponibles: empleados.reduce((sum: number, emp: { vacationDaysAccrued: number; vacationDaysUsed: number }) => sum + (emp.vacationDaysAccrued - emp.vacationDaysUsed), 0),
      acumulaciones: acumulaciones.map((acc: any) => ({
        empleadoId: acc.employeeId,
        empleado: `${acc.employee.nombre} ${acc.employee.apellido}`,
        cargo: acc.employee.cargo,
        diasAcumulados: acc.diasAcumulados,
        tipoAcumulacion: acc.tipoAcumulacion,
        fechaCalculo: acc.fechaCalculo,
        procesado: acc.procesado
      })),
      empleadosSinAcumulacion: empleados
        .filter((emp: any) => !acumulaciones.find((acc: any) => acc.employeeId === emp.empleadoId))
        .map((emp: any) => ({
          empleadoId: emp.empleadoId,
          empleado: `${emp.nombre} ${emp.apellido}`,
          cargo: emp.cargo,
          diasDisponibles: emp.vacationDaysAccrued - emp.vacationDaysUsed,
          diasAnualesAsignados: emp.diasVacacionesAnuales
        }))
    };

    return NextResponse.json(estadisticas);

  } catch (error) {
    console.error("Error obteniendo estadísticas de acumulación:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function massAccrualHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = massAccrualSchema.parse(body);

    const { periodo, employeeIds, fechaCalculo, incluirSinFechaContratacion = false } = validatedData;

    const whereClause: any = {};

    if (employeeIds && employeeIds.length > 0) {
      whereClause.empleadoId = { in: employeeIds };
    }

    if (!incluirSinFechaContratacion) {
      whereClause.fechaContratacion = { not: undefined };
    }

    const empleados = await prisma.empleado.findMany({
      where: whereClause
    });

    if (empleados.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron empleados para procesar" },
        { status: 404 }
      );
    }

    const vacationService = new VacationAccrualService();
    const fechaCalculoDate = fechaCalculo ? new Date(fechaCalculo) : new Date();

    const results = [];

    for (const empleado of empleados) {
      try {
        const result = await vacationService.calculateAccrualForEmployee(
          empleado.empleadoId,
          fechaCalculoDate,
          periodo
        );

        results.push({
          empleadoId: empleado.empleadoId,
          empleado: `${empleado.nombre} ${empleado.apellido}`,
          ...result
        });
      } catch (error) {
        console.error(`Error procesando empleado ${empleado.empleadoId}:`, error);
        results.push({
          empleadoId: empleado.empleadoId,
          empleado: `${empleado.nombre} ${empleado.apellido}`,
          error: error instanceof Error ? error.message : "Error desconocido",
          processed: false
        });
      }
    }

    const successCount = results.filter(r => r.processed !== false).length;
    const errorCount = results.length - successCount;

    return NextResponse.json({
      results,
      summary: {
        totalEmpleados: results.length,
        exitosos: successCount,
        errores: errorCount,
        periodo,
        fechaCalculo: fechaCalculoDate.toISOString()
      },
      message: `Procesamiento completado: ${successCount} empleados procesados exitosamente${errorCount > 0 ? `, ${errorCount} con errores` : ''}`
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error en cálculo masivo de acumulación:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ─── Work Schedules ────────────────────────────────────────────────────────────

const workScheduleSchema = z.object({
  employeeId: z.string().min(1, "ID de empleado requerido"),
  dayOfWeek: z.number().min(0).max(6, "Día de la semana debe ser 0-6"),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)"),
  breakStartTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  breakEndTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  isWorkingDay: z.boolean().default(true),
  scheduledHours: z.number().min(0).max(24)
});

export async function getWorkSchedulesHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    const where: any = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    const workSchedules = await prisma.employeeWorkSchedule.findMany({
      where,
      include: {
        employee: {
          select: {
            nombre: true,
            apellido: true,
            cargo: true
          }
        }
      },
      orderBy: [
        { employeeId: "asc" },
        { dayOfWeek: "asc" }
      ]
    });

    return NextResponse.json(workSchedules);
  } catch (error) {
    console.error("Error obteniendo horarios de trabajo:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function upsertWorkScheduleHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = workScheduleSchema.parse(body);

    const { employeeId, dayOfWeek, startTime, endTime, breakStartTime, breakEndTime, isWorkingDay, scheduledHours } = validatedData;

    const empleado = await prisma.empleado.findUnique({
      where: { empleadoId: employeeId }
    });

    if (!empleado) {
      return NextResponse.json(
        { error: "Empleado no encontrado" },
        { status: 404 }
      );
    }

    let calculatedScheduledHours = scheduledHours;
    if (scheduledHours === undefined) {
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      const breakHours = breakStartTime && breakEndTime ?
        (new Date(`2000-01-01T${breakEndTime}`).getTime() - new Date(`2000-01-01T${breakStartTime}`).getTime()) / (1000 * 60 * 60) : 0;
      calculatedScheduledHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60) - breakHours;
    }

    const workSchedule = await prisma.employeeWorkSchedule.upsert({
      where: {
        employeeId_dayOfWeek: {
          employeeId,
          dayOfWeek
        }
      },
      update: {
        startTime,
        endTime,
        breakStartTime,
        breakEndTime,
        isWorkingDay,
        scheduledHours: calculatedScheduledHours
      },
      create: {
        employeeId,
        dayOfWeek,
        startTime,
        endTime,
        breakStartTime,
        breakEndTime,
        isWorkingDay,
        scheduledHours: calculatedScheduledHours
      },
      include: {
        employee: {
          select: {
            nombre: true,
            apellido: true,
            cargo: true
          }
        }
      }
    });

    return NextResponse.json(workSchedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creando horario de trabajo:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function deleteWorkScheduleHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get("scheduleId");

    if (!scheduleId) {
      return NextResponse.json(
        { error: "ID de horario requerido" },
        { status: 400 }
      );
    }

    await prisma.employeeWorkSchedule.delete({
      where: { scheduleId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando horario de trabajo:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
