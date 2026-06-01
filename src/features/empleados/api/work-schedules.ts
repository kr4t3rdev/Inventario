import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

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
