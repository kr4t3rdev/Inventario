import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * @description Endpoint para actualizar una alerta del historial
 * @route PATCH /api/contabilidad/exchange/alert-history/[id]
 */

// PATCH /api/contabilidad/exchange/alert-history/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { estado, revisadaPor, notasRevision } = body;

    // Validar estado si se proporciona
    const estadosValidos = ["activa", "revisada", "descartada", "resuelta"];
    if (estado && !estadosValidos.includes(estado)) {
      return NextResponse.json(
        { success: false, error: "Estado inválido" },
        { status: 400 }
      );
    }

    // Actualizar la alerta
    const alerta = await prisma.alertHistory.update({
      where: { id },
      data: {
        ...(estado && { estado }),
        ...(revisadaPor && { revisadaPor }),
        ...(notasRevision && { notasRevision }),
        ...(estado && { fechaRevision: new Date() }),
      },
    });

    return NextResponse.json({
      success: true,
      data: alerta,
    });
  } catch (error) {
    console.error("Error al actualizar alerta:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar alerta" },
      { status: 500 }
    );
  }
}

// DELETE /api/contabilidad/exchange/alert-history/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.alertHistory.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Alerta eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar alerta:", error);
    return NextResponse.json(
      { success: false, error: "Error al eliminar alerta" },
      { status: 500 }
    );
  }
}
