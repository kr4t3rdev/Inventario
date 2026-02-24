import { NextRequest, NextResponse } from "next/server";
import { activarReporteProgramado } from "@/lib/services/scheduled-report-scheduler";

/**
 * @description Endpoint para activar o desactivar un reporte programado
 * @route PATCH /api/contabilidad/exchange/scheduled-reports/:id/toggle
 */

/**
 * @description Activa o desactiva un reporte programado
 * @param {NextRequest} request - Request de la API
 * @param {Object} params - Parámetros de la ruta
 * @param {string} params.id - ID del reporte programado
 * @returns {Promise<NextResponse>} Respuesta con el reporte actualizado
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID de reporte requerido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { activo } = body;

    if (typeof activo !== "boolean") {
      return NextResponse.json(
        { success: false, error: "El campo 'activo' es requerido y debe ser booleano" },
        { status: 400 }
      );
    }

    const reporteActualizado = await activarReporteProgramado(id, activo);

    return NextResponse.json({
      success: true,
      data: reporteActualizado,
      message: activo ? "Reporte activado" : "Reporte desactivado",
    });
  } catch (error) {
    if ((error as Error).message === "Reporte programado no encontrado") {
      return NextResponse.json(
        { success: false, error: "Reporte programado no encontrado" },
        { status: 404 }
      );
    }

    console.error("Error al activar/desactivar reporte programado:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar reporte programado" },
      { status: 500 }
    );
  }
}
