import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * @description Obtiene el historial de reportes del Dashboard de Inteligencia Cambiaria
 * @param {NextRequest} request - Request con parámetros de query para filtrar
 * @returns {NextResponse} Response con el historial de reportes
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipoReporte = searchParams.get("tipoReporte");
    const formato = searchParams.get("formato");
    const fechaDesde = searchParams.get("fechaDesde");
    const fechaHasta = searchParams.get("fechaHasta");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    const where: Record<string, unknown> = {};

    if (tipoReporte) {
      where.tipoReporte = tipoReporte;
    }

    if (formato) {
      where.formato = formato;
    }

    if (fechaDesde || fechaHasta) {
      if (fechaDesde && isNaN(new Date(fechaDesde).getTime())) {
        return NextResponse.json(
          { success: false, error: "fechaDesde inválida" },
          { status: 400 }
        );
      }
      if (fechaHasta && isNaN(new Date(fechaHasta).getTime())) {
        return NextResponse.json(
          { success: false, error: "fechaHasta inválida" },
          { status: 400 }
        );
      }
      where.fechaGeneracion = {};
      if (fechaDesde) {
        (where.fechaGeneracion as Record<string, Date>).gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        (where.fechaGeneracion as Record<string, Date>).lte = new Date(fechaHasta);
      }
    }

    const reportes = await prisma.reportHistory.findMany({
      where,
      orderBy: { fechaGeneracion: "desc" },
      take: limit ? parseInt(limit) : undefined,
      skip: offset ? parseInt(offset) : undefined,
    });

    const total = await prisma.reportHistory.count({ where });

    return NextResponse.json({
      success: true,
      data: reportes,
      total,
      limit: limit ? parseInt(limit) : reportes.length,
      offset: offset ? parseInt(offset) : 0,
    });
  } catch (error) {
    console.error("Error al obtener historial de reportes:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener historial de reportes" },
      { status: 500 }
    );
  }
}

/**
 * @description Registra un nuevo reporte en el historial
 * @param {NextRequest} request - Request con los datos del reporte
 * @returns {NextResponse} Response con el reporte creado
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      tipoReporte,
      formato,
      nombre,
      descripcion,
      parametros,
      resumenEjecutivo,
      numeroAlertas,
      metricasClave,
      rutaArchivo,
      tamanhoArchivo,
      generadoPor,
      reporteBaseId,
      comparacion,
    } = body;

    if (!tipoReporte || !formato || !nombre || !generadoPor) {
      return NextResponse.json(
        {
          success: false,
          error: "tipoReporte, formato, nombre y generadoPor son requeridos",
        },
        { status: 400 }
      );
    }

    const reporte = await prisma.reportHistory.create({
      data: {
        tipoReporte,
        formato,
        nombre,
        descripcion: descripcion || null,
        parametros: parametros ? JSON.stringify(parametros) : null,
        resumenEjecutivo: resumenEjecutivo || null,
        numeroAlertas: numeroAlertas || 0,
        metricasClave: metricasClave ? JSON.stringify(metricasClave) : null,
        rutaArchivo: rutaArchivo || null,
        tamanhoArchivo: tamanhoArchivo ? parseInt(String(tamanhoArchivo)) : null,
        generadoPor,
        reporteBaseId: reporteBaseId || null,
        comparacion: comparacion ? JSON.stringify(comparacion) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: reporte,
    }, { status: 201 });
  } catch (error) {
    console.error("Error al registrar reporte:", error);
    return NextResponse.json(
      { success: false, error: "Error al registrar reporte" },
      { status: 500 }
    );
  }
}
