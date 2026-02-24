import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * @description Endpoint para obtener y comparar reportes individuales
 * @route GET /api/contabilidad/exchange/report-history/[id]
 * @route GET /api/contabilidad/exchange/report-history/[id]/compare - Comparar con otro reporte
 */

// GET /api/contabilidad/exchange/report-history/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const compareWith = searchParams.get("compareWith");

    // Obtener el reporte
    const reporte = await prisma.reportHistory.findUnique({
      where: { id },
    });

    if (!reporte) {
      return NextResponse.json(
        { success: false, error: "Reporte no encontrado" },
        { status: 404 }
      );
    }

    // Parsear campos JSON
    const reporteParsed = {
      ...reporte,
      parametros: reporte.parametros ? JSON.parse(reporte.parametros) : null,
      metricasClave: reporte.metricasClave ? JSON.parse(reporte.metricasClave) : null,
      comparacion: reporte.comparacion ? JSON.parse(reporte.comparacion) : null,
    };

    // Si se solicita comparación
    if (compareWith) {
      const reporteBase = await prisma.reportHistory.findUnique({
        where: { id: compareWith },
      });

      if (!reporteBase) {
        return NextResponse.json(
          { success: false, error: "Reporte base para comparación no encontrado" },
          { status: 404 }
        );
      }

      // Calcular diferencias
      const diferenciaAlertas = reporte.numeroAlertas - reporteBase.numeroAlertas;
      const tendenciaAlertas = diferenciaAlertas > 0 ? "aumento" : diferenciaAlertas < 0 ? "disminucion" : "estable";

      return NextResponse.json({
        success: true,
        reporteActual: reporteParsed,
        reporteBase: {
          ...reporteBase,
          parametros: reporteBase.parametros ? JSON.parse(reporteBase.parametros) : null,
          metricasClave: reporteBase.metricasClave ? JSON.parse(reporteBase.metricasClave) : null,
        },
        comparacion: {
          diferenciaAlertas,
          tendenciaAlertas,
          diferenciaDias: Math.ceil(
            (reporte.fechaGeneracion.getTime() - reporteBase.fechaGeneracion.getTime()) /
              (1000 * 60 * 60 * 24)
          ),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: reporteParsed,
    });
  } catch (error) {
    console.error("Error al obtener reporte:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener reporte" },
      { status: 500 }
    );
  }
}

// DELETE /api/contabilidad/exchange/report-history/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.reportHistory.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Reporte eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar reporte:", error);
    return NextResponse.json(
      { success: false, error: "Error al eliminar reporte" },
      { status: 500 }
    );
  }
}
