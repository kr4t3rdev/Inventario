import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { VacationAccrualService } from "@/lib/vacation-accrual-service"
import { requireManagerRole, requireTenant } from "@/lib/services/tenant-scope"
import type { AuthenticatedUser } from "@/lib/auth-middleware"

const vacationRequestSchema = z.object({
  employeeId: z.string().min(1, "ID de empleado requerido"),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  endDate: z.string().min(1, "Fecha de fin requerida"),
  reason: z.string().optional()
});

export async function getVacacionesHandler(
  request: NextRequest,
  _context: any,
  user: AuthenticatedUser,
) {
  try {
    const tenantId = requireTenant(user);
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");

    const where: any = { employee: { tenantId } };

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

export async function createVacacionHandler(
  request: NextRequest,
  _context: any,
  user: AuthenticatedUser,
) {
  try {
    requireManagerRole(user, "crear solicitudes de vacaciones");
    const tenantId = requireTenant(user);
    const body = await request.json();
    const validatedData = vacationRequestSchema.parse(body);

    const { employeeId, startDate, endDate, reason } = validatedData;

    const empleado = await prisma.empleado.findFirst({
      where: { empleadoId: employeeId, tenantId },
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
  { params }: { params: Promise<{ id: string }> },
  user: AuthenticatedUser,
) {
  try {
    const tenantId = requireTenant(user);
    const { id } = await params;

    const vacationRequest = await prisma.vacationRequest.findFirst({
      where: { requestId: id, employee: { tenantId } },
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
  { params }: { params: Promise<{ id: string }> },
  user: AuthenticatedUser,
) {
  try {
    requireManagerRole(user, "aprobar o rechazar vacaciones");
    const tenantId = requireTenant(user);
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateVacationSchema.parse(body);

    const existingRequest = await prisma.vacationRequest.findFirst({
      where: { requestId: id, employee: { tenantId } },
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
  { params }: { params: Promise<{ id: string }> },
  user: AuthenticatedUser,
) {
  try {
    requireManagerRole(user, "eliminar solicitudes de vacaciones");
    const tenantId = requireTenant(user);
    const { id } = await params;

    const existingRequest = await prisma.vacationRequest.findFirst({
      where: { requestId: id, employee: { tenantId } }
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

export async function getVacacionAccumulacionHandler(
  request: NextRequest,
  _context: any,
  user: AuthenticatedUser,
) {
  try {
    const tenantId = requireTenant(user);
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { error: "ID de empleado requerido" },
        { status: 400 }
      );
    }

    const empleado = await prisma.empleado.findFirst({
      where: { empleadoId: employeeId, tenantId },
      select: { empleadoId: true },
    });
    if (!empleado) {
      return NextResponse.json(
        { error: "Empleado no encontrado" },
        { status: 404 }
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

export async function calculateVacacionAccumulacionHandler(
  request: NextRequest,
  _context: any,
  user: AuthenticatedUser,
) {
  try {
    requireManagerRole(user, "calcular acumulación de vacaciones");
    const tenantId = requireTenant(user);
    const body = await request.json();
    const validatedData = manualAccrualSchema.parse(body);

    const { employeeId, periodo, fechaCalculo } = validatedData;

    const empleado = await prisma.empleado.findFirst({
      where: { empleadoId: employeeId, tenantId },
      select: { empleadoId: true },
    });
    if (!empleado) {
      return NextResponse.json(
        { error: "Empleado no encontrado" },
        { status: 404 }
      );
    }

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

export async function getMassAccrualHandler(
  request: NextRequest,
  _context: any,
  user: AuthenticatedUser,
) {
  try {
    const tenantId = requireTenant(user);
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo") || new Date().toISOString().slice(0, 7);

    const acumulaciones = await prisma.vacationAccrual.findMany({
      where: { periodo, employee: { tenantId } },
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
      where: { tenantId, fechaContratacion: { not: undefined } },
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

export async function massAccrualHandler(
  request: NextRequest,
  _context: any,
  user: AuthenticatedUser,
) {
  try {
    requireManagerRole(user, "calcular acumulación masiva de vacaciones");
    const tenantId = requireTenant(user);
    const body = await request.json();
    const validatedData = massAccrualSchema.parse(body);

    const { periodo, employeeIds, fechaCalculo, incluirSinFechaContratacion = false } = validatedData;

    const whereClause: any = { tenantId };

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
