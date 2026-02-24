import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/**
 * Esquema de validación para actualización de asistencia
 */
const updateAsistenciaSchema = z.object({
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  totalHours: z.number().min(0).optional(),
  status: z.enum(["present", "absent", "late", "half-day"]).optional()
});

/**
 * Obtiene un registro específico de asistencia
 * @param request - Solicitud HTTP
 * @param context - Contexto con parámetros de ruta
 * @returns Registro de asistencia
 */
export async function GET(
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

/**
 * Actualiza un registro de asistencia
 * @param request - Solicitud HTTP con datos actualizados
 * @param context - Contexto con parámetros de ruta
 * @returns Registro de asistencia actualizado
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateAsistenciaSchema.parse(body);

    // Verificar que el registro existe
    const existingAsistencia = await prisma.attendance.findUnique({
      where: { attendanceId: id }
    });

    if (!existingAsistencia) {
      return NextResponse.json(
        { error: "Registro de asistencia no encontrado" },
        { status: 404 }
      );
    }

    // Calcular horas trabajadas si se actualizan checkIn o checkOut
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

/**
 * Elimina un registro de asistencia
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

    // Verificar que el registro existe
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