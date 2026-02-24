import { NextRequest, NextResponse } from "next/server";
import { ejecutarReportesPendientes } from "@/lib/services/scheduled-report-scheduler";

/**
 * @description Endpoint para ejecutar reportes programados pendientes
 * @route POST /api/contabilidad/exchange/scheduled-reports/trigger
 */

/**
 * @description Ejecuta todos los reportes programados que están pendientes
 * @param {NextRequest} request - Request de la API
 * @returns {Promise<NextResponse>} Respuesta con el resultado de las ejecuciones
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verificar API key o token de autorización para seguridad
    const authHeader = request.headers.get("authorization");
    const apiKey = process.env.SCHEDULER_API_KEY;

    // Si hay una API key configurada, verificar que coincida
    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    // Ejecutar reportes pendientes
    const resultado = await ejecutarReportesPendientes();

    return NextResponse.json({
      success: true,
      message: `Ejecución completada`,
      data: {
        ejecutados: resultado.ejecutados,
        fallidos: resultado.fallidos,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error al ejecutar reportes programados:", error);
    return NextResponse.json(
      { success: false, error: "Error al ejecutar reportes programados" },
      { status: 500 }
    );
  }
}
