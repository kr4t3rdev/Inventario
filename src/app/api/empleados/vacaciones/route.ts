import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { VacationAccrualService } from "@/lib/vacation-accrual-service";

/**
 * Esquema de validación para solicitud de vacaciones
 */
const vacationRequestSchema = z.object({
  employeeId: z.string().min(1, "ID de empleado requerido"),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  endDate: z.string().min(1, "Fecha de fin requerida"),
  reason: z.string().optional()
});

/**
 * Servicio de acumulación de vacaciones
 */
const vacationService = new VacationAccrualService();

/**
 * Obtiene las solicitudes de vacaciones
 * @param request - Solicitud HTTP
 * @returns Lista de solicitudes de vacaciones
 */
export async function GET(request: NextRequest) {
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

/**
 * Crea una nueva solicitud de vacaciones
 * @param request - Solicitud HTTP con datos de la solicitud
 * @returns Solicitud de vacaciones creada
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = vacationRequestSchema.parse(body);

    const { employeeId, startDate, endDate, reason } = validatedData;

    // Verificar que el empleado existe
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

    // Verificar que el empleado tenga fecha de contratación
    if (!empleado.fechaContratacion) {
      return NextResponse.json(
        { error: "El empleado debe tener fecha de contratación configurada para solicitar vacaciones" },
        { status: 400 }
      );
    }

    // Calcular días solicitados
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysRequested = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Verificar días disponibles
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

    // Verificar que no haya solicitudes pendientes en el mismo período
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

    // Verificar antigüedad mínima (ej: 6 meses)
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