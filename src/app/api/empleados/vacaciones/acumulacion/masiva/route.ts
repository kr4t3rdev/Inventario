import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { VacationAccrualService } from "@/lib/vacation-accrual-service";

/**
 * Esquema de validación para cálculo masivo de acumulación
 */
const massAccrualSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "Formato de período inválido (YYYY-MM)"),
  employeeIds: z.array(z.string()).optional(),
  fechaCalculo: z.string().optional(),
  incluirSinFechaContratacion: z.boolean().default(false)
});

/**
 * Calcula y aplica acumulación de vacaciones para todos o varios empleados
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = massAccrualSchema.parse(body);

    const { periodo, employeeIds, fechaCalculo, incluirSinFechaContratacion = false } = validatedData;

    // Obtener empleados
    const whereClause: any = {};
    
    if (employeeIds && employeeIds.length > 0) {
      whereClause.empleadoId = { in: employeeIds };
    }
    
    if (!incluirSinFechaContratacion) {
      whereClause.fechaContratacion = { not: undefined };
    }

    const empleados = await prisma.empleado.findMany({
      where: whereClause
    });

    if (empleados.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron empleados para procesar" },
        { status: 404 }
      );
    }

    const vacationService = new VacationAccrualService();
    const fechaCalculoDate = fechaCalculo ? new Date(fechaCalculo) : new Date();

    const results = [];
    
    for (const empleado of empleados) {
      try {
        const result = await vacationService.calculateAccrualForEmployee(
          empleado.empleadoId,
          fechaCalculoDate,
          periodo
        );
        
        results.push({
          empleadoId: empleado.empleadoId,
          empleado: `${empleado.nombre} ${empleado.apellido}`,
          ...result
        });
      } catch (error) {
        console.error(`Error procesando empleado ${empleado.empleadoId}:`, error);
        results.push({
          empleadoId: empleado.empleadoId,
          empleado: `${empleado.nombre} ${empleado.apellido}`,
          error: error instanceof Error ? error.message : "Error desconocido",
          processed: false
        });
      }
    }

    const successCount = results.filter(r => r.processed !== false).length;
    const errorCount = results.length - successCount;

    return NextResponse.json({
      results,
      summary: {
        totalEmpleados: results.length,
        exitosos: successCount,
        errores: errorCount,
        periodo,
        fechaCalculo: fechaCalculoDate.toISOString()
      },
      message: `Procesamiento completado: ${successCount} empleados procesados exitosamente${errorCount > 0 ? `, ${errorCount} con errores` : ''}`
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error en cálculo masivo de acumulación:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * Obtiene estadísticas de acumulación para el período actual
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo") || new Date().toISOString().slice(0, 7);

    // Obtener estadísticas de acumulaciones
    const acumulaciones = await prisma.vacationAccrual.findMany({
      where: { periodo },
      include: {
        employee: {
          select: {
            nombre: true,
            apellido: true,
            cargo: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Obtener empleados con información de vacaciones
    const empleados = await prisma.empleado.findMany({
      where: { fechaContratacion: { not: undefined } },
      select: {
        empleadoId: true,
        nombre: true,
        apellido: true,
        cargo: true,
        vacationDaysAccrued: true,
        vacationDaysUsed: true,
        fechaContratacion: true,
        diasVacacionesAnuales: true
      }
    });

    const estadisticas = {
      periodo,
      totalEmpleados: empleados.length,
      empleadosConAcumulacion: acumulaciones.length,
      totalDiasAcumulados: acumulaciones.reduce((sum: number, acc: { diasAcumulados: number }) => sum + acc.diasAcumulados, 0),
      totalDiasUsados: empleados.reduce((sum: number, emp: { vacationDaysUsed: number }) => sum + emp.vacationDaysUsed, 0),
      totalDiasDisponibles: empleados.reduce((sum: number, emp: { vacationDaysAccrued: number; vacationDaysUsed: number }) => sum + (emp.vacationDaysAccrued - emp.vacationDaysUsed), 0),
      acumulaciones: acumulaciones.map((acc: any) => ({
        empleadoId: acc.employeeId,
        empleado: `${acc.employee.nombre} ${acc.employee.apellido}`,
        cargo: acc.employee.cargo,
        diasAcumulados: acc.diasAcumulados,
        tipoAcumulacion: acc.tipoAcumulacion,
        fechaCalculo: acc.fechaCalculo,
        procesado: acc.procesado
      })),
      empleadosSinAcumulacion: empleados
        .filter((emp: any) => !acumulaciones.find((acc: any) => acc.employeeId === emp.empleadoId))
        .map((emp: any) => ({
          empleadoId: emp.empleadoId,
          empleado: `${emp.nombre} ${emp.apellido}`,
          cargo: emp.cargo,
          diasDisponibles: emp.vacationDaysAccrued - emp.vacationDaysUsed,
          diasAnualesAsignados: emp.diasVacacionesAnuales
        }))
    };

    return NextResponse.json(estadisticas);

  } catch (error) {
    console.error("Error obteniendo estadísticas de acumulación:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}