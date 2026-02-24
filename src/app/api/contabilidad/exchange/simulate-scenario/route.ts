import { NextRequest, NextResponse } from "next/server";
import { exchange_intelligence_service } from "@/lib/services/exchange_intelligence_service";

/**
 * @description Endpoint para simular escenarios de cambio en tasas de cambio
 * POST /api/contabilidad/exchange/simulate-scenario
 *
 * Body:
 * {
 *   "tasas_simuladas": { "USD": 22.5, "EUR": 24.8 },
 *   "fecha_proyeccion": "2024-12-31"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar estructura del body
    const { tasas_simuladas, fecha_proyeccion } = body;

    if (!tasas_simuladas || typeof tasas_simuladas !== 'object') {
      return NextResponse.json(
        {
          error: "Parámetros inválidos",
          message: "tasas_simuladas es obligatorio y debe ser un objeto"
        },
        { status: 400 }
      );
    }

    if (!fecha_proyeccion) {
      return NextResponse.json(
        {
          error: "Parámetros inválidos",
          message: "fecha_proyeccion es obligatorio"
        },
        { status: 400 }
      );
    }

    // Validar fecha
    const fecha_proyeccion_date = new Date(fecha_proyeccion);
    if (isNaN(fecha_proyeccion_date.getTime())) {
      return NextResponse.json(
        {
          error: "Formato de fecha inválido",
          message: "fecha_proyeccion debe estar en formato ISO válido"
        },
        { status: 400 }
      );
    }

    // Validar tasas simuladas
    for (const [moneda, tasa] of Object.entries(tasas_simuladas)) {
      if (typeof tasa !== 'number' || tasa <= 0) {
        return NextResponse.json(
          {
            error: "Tasa inválida",
            message: `La tasa para ${moneda} debe ser un número positivo`
          },
          { status: 400 }
        );
      }
    }

    // Llamar al servicio
    const result = await exchange_intelligence_service.simulate_scenario(
      tasas_simuladas,
      fecha_proyeccion
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error en POST /api/contabilidad/exchange/simulate-scenario:", error);

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        message: "Ocurrió un error al procesar la solicitud"
      },
      { status: 500 }
    );
  }
}