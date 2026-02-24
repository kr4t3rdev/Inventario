import { NextRequest, NextResponse } from "next/server";
import { exchange_intelligence_service } from "@/lib/services/exchange_intelligence_service";

/**
 * @description Endpoint para obtener el análisis de exposición de deuda
 * GET /api/contabilidad/exchange/debt-exposure
 *
 * Query parameters:
 * - fecha_corte?: string (ISO date, default: today)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extraer parámetro opcional
    const fecha_corte = searchParams.get("fecha_corte");

    // Validar formato de fecha si se proporciona
    if (fecha_corte) {
      const fecha_corte_date = new Date(fecha_corte);
      if (isNaN(fecha_corte_date.getTime())) {
        return NextResponse.json(
          {
            error: "Formato de fecha inválido",
            message: "fecha_corte debe estar en formato ISO válido"
          },
          { status: 400 }
        );
      }
    }

    // Llamar al servicio
    const result = await exchange_intelligence_service.calculate_debt_exposure(fecha_corte || undefined);

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error en GET /api/contabilidad/exchange/debt-exposure:", error);

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        message: "Ocurrió un error al procesar la solicitud"
      },
      { status: 500 }
    );
  }
}