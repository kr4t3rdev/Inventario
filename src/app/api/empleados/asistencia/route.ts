import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@/generated/prisma/runtime/library";

/**
 * Esquema de validación para registro de asistencia
 */
const asistenciaSchema = z.object({
  employeeId: z.string().min(1, "ID de empleado requerido"),
  action: z.enum(["checkin", "checkout"], {
    errorMap: () => ({ message: "Acción debe ser 'checkin' o 'checkout'" })
  })
});

/**
 * Esquema de validación para edición manual de asistencia
 */
const manualAttendanceSchema = z.object({
  attendanceId: z.string().min(1, "ID de asistencia requerido"),
  manualCheckIn: z.string().optional(),
  manualCheckOut: z.string().optional(),
  notes: z.string().optional(),
  approvedBy: z.string().optional()
});

/**
 * Obtiene la asistencia de empleados
 * @param request - Solicitud HTTP
 * @returns Lista de registros de asistencia
 */
export async function GET(request: NextRequest) {
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

    // Enrich attendance records with schedule information
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

/**
 * Maneja actualización manual de asistencia
 */
async function handleManualAttendanceUpdate(body: any) {
  const validatedData = manualAttendanceSchema.parse(body);

  const { attendanceId, manualCheckIn, manualCheckOut, notes, approvedBy } = validatedData;

  // Verificar que el registro existe
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

  // Calcular horas trabajadas si se proporcionan ambas horas
  let totalHours = existingAttendance.totalHours;
  let overtimeHours = existingAttendance.overtimeHours;

  if (manualCheckIn && manualCheckOut) {
    const checkInTime = new Date(manualCheckIn).getTime();
    const checkOutTime = new Date(manualCheckOut).getTime();
    const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);

    // Obtener horario programado para calcular horas extras
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

/**
 * Registra entrada o salida de empleado
 * @param request - Solicitud HTTP con datos de asistencia
 * @returns Registro de asistencia creado o actualizado
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a manual attendance update
    if (body.attendanceId) {
      return await handleManualAttendanceUpdate(body);
    }

    const validatedData = asistenciaSchema.parse(body);

    const { employeeId, action } = validatedData;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Verificar que el empleado existe
    const empleado = await prisma.empleado.findUnique({
      where: { empleadoId: employeeId }
    });

    if (!empleado) {
      return NextResponse.json(
        { error: "Empleado no encontrado" },
        { status: 404 }
      );
    }

    // Buscar registro de asistencia para hoy
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
        // Crear nuevo registro
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
        // Actualizar check-in
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

      // Calcular horas trabajadas
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
