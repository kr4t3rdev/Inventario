import { NextRequest, NextResponse } from "next/server";
import { exchange_intelligence_service } from "@/lib/services/exchange_intelligence_service";

/**
 * @description Endpoint para obtener todos los KPIs del dashboard
 * GET /api/contabilidad/exchange/kpis
 *
 * Query parameters:
 * - fecha_inicio: string (ISO date)
 * - fecha_fin: string (ISO date)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extraer parámetros
    const fecha_inicio = searchParams.get("fecha_inicio");
    const fecha_fin = searchParams.get("fecha_fin");

    // Validar parámetros requeridos
    if (!fecha_inicio || !fecha_fin) {
      return NextResponse.json(
        {
          error: "Parámetros requeridos faltantes",
          message: "fecha_inicio y fecha_fin son obligatorios"
        },
        { status: 400 }
      );
    }

    // Validar formato de fechas
    const fecha_inicio_date = new Date(fecha_inicio);
    const fecha_fin_date = new Date(fecha_fin);

    if (isNaN(fecha_inicio_date.getTime()) || isNaN(fecha_fin_date.getTime())) {
      return NextResponse.json(
        {
          error: "Formato de fecha inválido",
          message: "Las fechas deben estar en formato ISO válido"
        },
        { status: 400 }
      );
    }

    if (fecha_inicio_date > fecha_fin_date) {
      return NextResponse.json(
        {
          error: "Rango de fechas inválido",
          message: "La fecha de inicio debe ser anterior a la fecha de fin"
        },
        { status: 400 }
      );
    }

    // Llamar al servicio
    const result = await exchange_intelligence_service.calculate_kpis(fecha_inicio, fecha_fin);

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error en GET /api/contabilidad/exchange/kpis:", error);

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        message: "Ocurrió un error al procesar la solicitud"
      },
      { status: 500 }
    );
  }
}