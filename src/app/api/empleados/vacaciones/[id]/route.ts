import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/**
 * Esquema de validación para actualización de solicitud de vacaciones
 */
const updateVacationSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
  approvedBy: z.string().optional()
});

/**
 * Obtiene una solicitud específica de vacaciones
 * @param request - Solicitud HTTP
 * @param context - Contexto con parámetros de ruta
 * @returns Solicitud de vacaciones
 */
export async function GET(
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

/**
 * Actualiza el estado de una solicitud de vacaciones (aprobar/rechazar)
 * @param request - Solicitud HTTP con datos actualizados
 * @param context - Contexto con parámetros de ruta
 * @returns Solicitud de vacaciones actualizada
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateVacationSchema.parse(body);

    // Verificar que la solicitud existe
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

      // Actualizar días de vacaciones usados del empleado
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

/**
 * Elimina una solicitud de vacaciones
 * @param request - Solicitud HTTP
 * @param context - Contexto con parámetros de ruta
 * @returns Confirmación de eliminación
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verificar que la solicitud existe
    const existingRequest = await prisma.vacationRequest.findUnique({
      where: { requestId: id }
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: "Solicitud de vacaciones no encontrada" },
        { status: 404 }
      );
    }

    // Solo permitir eliminar solicitudes pendientes
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