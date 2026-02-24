import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/**
 * Esquema de validación para actualización de nómina
 */
const updatePayrollSchema = z.object({
  salario: z.number().min(0).optional(),
  bonificaciones: z.number().min(0).optional(),
  deducciones: z.number().min(0).optional(),
  horasExtras: z.number().min(0).optional(),
  observaciones: z.string().optional()
});

/**
 * Obtiene un registro específico de nómina
 * @param request - Solicitud HTTP
 * @param context - Contexto con parámetros de ruta
 * @returns Registro de nómina
 */
export async function GET(
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

/**
 * Actualiza un registro de nómina
 * @param request - Solicitud HTTP con datos actualizados
 * @param context - Contexto con parámetros de ruta
 * @returns Registro de nómina actualizado
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updatePayrollSchema.parse(body);

    // Verificar que el registro existe
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

/**
 * Elimina un registro de nómina
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