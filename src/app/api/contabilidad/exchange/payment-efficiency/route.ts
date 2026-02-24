import { NextRequest, NextResponse } from "next/server";
import { exchange_intelligence_service } from "@/lib/services/exchange_intelligence_service";

/**
 * @description Endpoint para obtener el análisis de eficiencia de pagos en transacciones de cambio
 * GET /api/contabilidad/exchange/payment-efficiency
 *
 * Query parameters:
 * - fecha_inicio: string (ISO date) - Fecha de inicio del período (requerido)
 * - fecha_fin: string (ISO date) - Fecha de fin del período (requerido)
 * - moneda?: string - Código de moneda para filtrar (opcional, ej. "USD", "EUR")
 *
 * @returns Transacciones con spreads, spread_promedio, mejor/peor tasa, y recomendación de renegociación
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extraer parámetros
    const fecha_inicio = searchParams.get("fecha_inicio");
    const fecha_fin = searchParams.get("fecha_fin");
    const moneda = searchParams.get("moneda");

    // Validar parámetros requeridos
    if (!fecha_inicio || !fecha_fin) {
      return NextResponse.json(
        {
          error: "Parámetros requeridos faltantes",
          message: "fecha_inicio y fecha_fin son obligatorios",
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
          message: "Las fechas deben estar en formato ISO válido",
        },
        { status: 400 }
      );
    }

    if (fecha_inicio_date > fecha_fin_date) {
      return NextResponse.json(
        {
          error: "Rango de fechas inválido",
          message: "La fecha de inicio debe ser anterior a la fecha de fin",
        },
        { status: 400 }
      );
    }

    // Validar longitud máxima de fechas (para evitar períodos excesivamente largos)
    const MAX_DIAS_PERIODO = 365;
    const diff_dias = Math.floor(
      (fecha_fin_date.getTime() - fecha_inicio_date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diff_dias > MAX_DIAS_PERIODO) {
      return NextResponse.json(
        {
          error: "Período demasiado extenso",
          message: `El período máximo permitido es de ${MAX_DIAS_PERIODO} días`,
        },
        { status: 400 }
      );
    }

    // Validar moneda si se proporciona
    if (moneda && typeof moneda === "string") {
      const monedas_validas = ["USD", "EUR", "GBP", "CAD", "MXN", "CUP"];
      if (!monedas_validas.includes(moneda.toUpperCase())) {
        return NextResponse.json(
          {
            error: "Moneda no válida",
            message: `Las monedas válidas son: ${monedas_validas.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Llamar al servicio
    const result = await exchange_intelligence_service.calculate_payment_efficiency(
      fecha_inicio,
      fecha_fin,
      moneda || undefined
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error en GET /api/contabilidad/exchange/payment-efficiency:", error);

    // Manejar errores específicos
    if (error instanceof Error) {
      if (error.message.includes("fecha de inicio")) {
        return NextResponse.json(
          {
            error: "Error de validación",
            message: error.message,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        message: "Ocurrió un error al procesar la solicitud de eficiencia de pagos",
      },
      { status: 500 }
    );
  }
}
