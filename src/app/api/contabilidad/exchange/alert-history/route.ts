import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * @description Obtiene el historial de alertas del Dashboard de Inteligencia Cambiaria
 * @param {NextRequest} request - Request con parámetros de query para filtrar
 * @returns {NextResponse} Response con el historial de alertas
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipoAlerta = searchParams.get("tipoAlerta");
    const severidad = searchParams.get("severidad");
    const estado = searchParams.get("estado");
    const moneda = searchParams.get("moneda");
    const fechaDesde = searchParams.get("fechaDesde");
    const fechaHasta = searchParams.get("fechaHasta");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    const where: Record<string, unknown> = {};

    if (tipoAlerta) {
      where.tipoAlerta = tipoAlerta;
    }

    if (severidad) {
      where.severidad = severidad;
    }

    if (estado) {
      where.estado = estado;
    }

    if (moneda) {
      where.moneda = moneda;
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
      where.fechaAlerta = {};
      if (fechaDesde) {
        (where.fechaAlerta as Record<string, Date>).gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        (where.fechaAlerta as Record<string, Date>).lte = new Date(fechaHasta);
      }
    }

    const alertas = await prisma.alertHistory.findMany({
      where,
      orderBy: { fechaAlerta: "desc" },
      take: limit ? parseInt(limit) : undefined,
      skip: offset ? parseInt(offset) : undefined,
    });

    const total = await prisma.alertHistory.count({ where });

    // Obtener estadísticas por severidad
    const estadisticas = await prisma.alertHistory.groupBy({
      by: ["severidad"],
      where,
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: alertas,
      total,
      limit: limit ? parseInt(limit) : alertas.length,
      offset: offset ? parseInt(offset) : 0,
      estadisticas,
    });
  } catch (error) {
    console.error("Error al obtener historial de alertas:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener historial de alertas" },
      { status: 500 }
    );
  }
}

/**
 * @description Registra una nueva alerta en el historial
 * @param {NextRequest} request - Request con los datos de la alerta
 * @returns {NextResponse} Response con la alerta creada
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      tipoAlerta,
      severidad,
      titulo,
      mensaje,
      metric,
      umbral,
      entidadTipo,
      entidadId,
      moneda,
    } = body;

    if (!tipoAlerta || !severidad || !titulo || !mensaje) {
      return NextResponse.json(
        {
          success: false,
          error: "tipoAlerta, severidad, titulo y mensaje son requeridos",
        },
        { status: 400 }
      );
    }

    const alerta = await prisma.alertHistory.create({
      data: {
        tipoAlerta,
        severidad,
        titulo,
        mensaje,
        metric: metric ? String(metric) : null,
        umbral: umbral ? parseFloat(umbral) : null,
        entidadTipo,
        entidadId,
        moneda,
      },
    });

    return NextResponse.json({
      success: true,
      data: alerta,
    });
  } catch (error) {
    console.error("Error al registrar alerta:", error);
    return NextResponse.json(
      { success: false, error: "Error al registrar alerta" },
      { status: 500 }
    );
  }
}
