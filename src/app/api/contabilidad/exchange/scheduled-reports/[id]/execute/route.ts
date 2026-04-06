import { NextRequest, NextResponse } from "next/server";
import { ejecutarReporteProgramado } from "@/lib/services/scheduled-report-scheduler";
import { authenticateUser } from "@/lib/auth-middleware";
import { AuditLogService } from "@/lib/services/audit-log-service";

/**
 * @description Endpoint para ejecutar un reporte programado específico manualmente
 * @route POST /api/contabilidad/exchange/scheduled-reports/:id/execute
 */

/**
 * @description Ejecuta un reporte programado específico
 * @param {NextRequest} request - Request de la API
 * @param {Object} params - Parámetros de la ruta
 * @param {string} params.id - ID del reporte programado
 * @returns {Promise<NextResponse>} Respuesta con el resultado de la ejecución
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID de reporte requerido" },
        { status: 400 }
      );
    }

    const resultado = await ejecutarReporteProgramado(id);

    if (resultado.success) {
      await AuditLogService.log({
        accion: "EXECUTE",
        entidad: "REPORTE_PROGRAMADO",
        entidadId: id,
        usuarioId: user.userId,
        detalles: { tipoReporte: "manual" }
      });

      return NextResponse.json({
        success: true,
        message: resultado.message,
        data: {
          reporteId: id,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: resultado.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error al ejecutar reporte programado:", error);
    return NextResponse.json(
      { success: false, error: "Error al ejecutar reporte programado" },
      { status: 500 }
    );
  }
}
