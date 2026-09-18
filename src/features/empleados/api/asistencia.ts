import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { Decimal } from "@/generated/prisma/runtime/library"
import { requirePermission, requireTenant, requireFeature } from "@/lib/services/tenant-scope"
import type { AuthenticatedUser } from "@/lib/auth-middleware"

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

async function handleManualAttendanceUpdate(body: any, user: AuthenticatedUser) {
  const tenantId = requireTenant(user);
  const validatedData = manualAttendanceSchema.parse(body);

  const { attendanceId, manualCheckIn, manualCheckOut, notes, approvedBy } = validatedData;

  const existingAttendance = await prisma.attendance.findUnique({
    where: { attendanceId },
    include: { employee: { select: { nombre: true, apellido: true, cargo: true, tenantId: true } } }
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

export async function getAsistenciaHandler(
  request: NextRequest,
  _context: any,
  user: AuthenticatedUser,
) {
  try {
    requireFeature(user, 'asistencia', 'gestionar asistencia');
    const tenantId = requireTenant(user);
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const date = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = { employee: { tenantId } };

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

export async function postAsistenciaHandler(
  request: NextRequest,
  _context: any,
  user: AuthenticatedUser,
) {
  try {
    requireFeature(user, 'asistencia', 'gestionar asistencia');
    requirePermission(user, "rrhh.asistencia.registrar", "registrar asistencia");
    const tenantId = requireTenant(user);
    const body = await request.json();

    if (body.attendanceId) {
      return await handleManualAttendanceUpdate(body, user);
    }

    const validatedData = asistenciaSchema.parse(body);

    const { employeeId, action } = validatedData;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const empleado = await prisma.empleado.findFirst({
      where: { empleadoId: employeeId, tenantId }
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
  { params }: { params: Promise<{ id: string }> },
  user: AuthenticatedUser,
) {
  try {
    requireFeature(user, 'asistencia', 'gestionar asistencia');
    const tenantId = requireTenant(user);
    const { id } = await params;

    const asistencia = await prisma.attendance.findFirst({
      where: { attendanceId: id, employee: { tenantId } },
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
  { params }: { params: Promise<{ id: string }> },
  user: AuthenticatedUser,
) {
  try {
    requireFeature(user, 'asistencia', 'gestionar asistencia');
    requirePermission(user, "rrhh.asistencia.editar", "editar asistencia");
    const tenantId = requireTenant(user);
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateAsistenciaSchema.parse(body);

    const existingAsistencia = await prisma.attendance.findFirst({
      where: { attendanceId: id, employee: { tenantId } }
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
  { params }: { params: Promise<{ id: string }> },
  user: AuthenticatedUser,
) {
  try {
    requireFeature(user, 'asistencia', 'gestionar asistencia');
    requirePermission(user, "rrhh.asistencia.eliminar", "eliminar asistencia");
    const tenantId = requireTenant(user);
    const { id } = await params;

    const existingAsistencia = await prisma.attendance.findFirst({
      where: { attendanceId: id, employee: { tenantId } }
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
