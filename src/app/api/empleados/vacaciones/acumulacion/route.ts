import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { VacationAccrualService } from "@/lib/vacation-accrual-service";

/**
 * Esquema de validación para cálculo manual de acumulación
 */
const manualAccrualSchema = z.object({
  employeeId: z.string().min(1, "ID de empleado requerido"),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "Formato de período inválido (YYYY-MM)"),
  fechaCalculo: z.string().optional()
});

/**
 * Esquema para configuración de acumulación
 */
const configSchema = z.object({
  diasAnualesBase: z.number().min(1).max(30),
  diasMaximosPorAntiguedad: z.number().min(0).max(15),
  mesesParaPrimerPeriodo: z.number().min(1).max(12),
  incrementoAnual: z.number().min(0).max(5)
});

/**
 * Obtiene el resumen de acumulación de vacaciones de un empleado
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { error: "ID de empleado requerido" },
        { status: 400 }
      );
    }

    const vacationService = new VacationAccrualService();
    const summary = await vacationService.getAccrualSummary(employeeId);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error obteniendo resumen de vacaciones:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * Calcula y aplica acumulación de vacaciones para un empleado específico
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = manualAccrualSchema.parse(body);

    const { employeeId, periodo, fechaCalculo } = validatedData;

    const vacationService = new VacationAccrualService();
    const fechaCalculoDate = fechaCalculo ? new Date(fechaCalculo) : new Date();

    const result = await vacationService.calculateAccrualForEmployee(
      employeeId,
      fechaCalculoDate,
      periodo
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error calculando acumulación manual:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}