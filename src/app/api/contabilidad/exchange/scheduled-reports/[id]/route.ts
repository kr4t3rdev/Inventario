import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateUser } from "@/lib/auth-middleware";
import { AuditLogService } from "@/lib/services/audit-log-service";

/**
 * @description Endpoint para gestionar reportes programados individuales
 * @route GET /api/contabilidad/exchange/scheduled-reports/[id]
 * @route PATCH /api/contabilidad/exchange/scheduled-reports/[id]
 * @route DELETE /api/contabilidad/exchange/scheduled-reports/[id]
 * @route POST /api/contabilidad/exchange/scheduled-reports/[id]/execute
 */

// GET /api/contabilidad/exchange/scheduled-reports/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reporte = await prisma.scheduledReport.findUnique({
      where: { id },
    });

    if (!reporte) {
      return NextResponse.json(
        { success: false, error: "Reporte programado no encontrado" },
        { status: 404 }
      );
    }

    const reporteParsed = {
      ...reporte,
      parametros: reporte.parametros ? JSON.parse(reporte.parametros) : null,
      destinatarios: reporte.destinatarios ? JSON.parse(reporte.destinatarios) : null,
    };

    return NextResponse.json({
      success: true,
      data: reporteParsed,
    });
  } catch (error) {
    console.error("Error al obtener reporte programado:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener reporte programado" },
      { status: 500 }
    );
  }
}

// PATCH /api/contabilidad/exchange/scheduled-reports/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { id } = await params;
    const body = await request.json();

    const {
      nombre,
      descripcion,
      tipoReporte,
      formato,
      parametros,
      frecuencia,
      diaSemana,
      diaMes,
      hora,
      zonaHoraria,
      activo,
      enviarEmail,
      destinatarios,
      asuntoEmail,
      cuerpoEmail,
    } = body;

    const frecuenciasValidas = ["diaria", "semanal", "quincenal", "mensual"];
    if (frecuencia && !frecuenciasValidas.includes(frecuencia)) {
      return NextResponse.json(
        { success: false, error: "Frecuencia inválida" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (nombre) updateData.nombre = nombre;
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (tipoReporte) updateData.tipoReporte = tipoReporte;
    if (formato) updateData.formato = formato;
    if (parametros) updateData.parametros = JSON.stringify(parametros);
    if (frecuencia) updateData.frecuencia = frecuencia;
    if (diaSemana !== undefined) updateData.diaSemana = diaSemana;
    if (diaMes !== undefined) updateData.diaMes = diaMes;
    if (hora) updateData.hora = hora;
    if (zonaHoraria) updateData.zonaHoraria = zonaHoraria;
    if (activo !== undefined) updateData.activo = activo;
    if (enviarEmail !== undefined) updateData.enviarEmail = enviarEmail;
    if (destinatarios) updateData.destinatarios = JSON.stringify(destinatarios);
    if (asuntoEmail !== undefined) updateData.asuntoEmail = asuntoEmail;
    if (cuerpoEmail !== undefined) updateData.cuerpoEmail = cuerpoEmail;

    const reporte = await prisma.scheduledReport.update({
      where: { id },
      data: updateData,
    });

    await AuditLogService.log({
      accion: "UPDATE",
      entidad: "REPORTE_PROGRAMADO",
      entidadId: id,
      usuarioId: user.userId,
      detalles: { nombre: reporte.nombre }
    });

    return NextResponse.json({
      success: true,
      data: reporte,
    });
  } catch (error) {
    console.error("Error al actualizar reporte programado:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar reporte programado" },
      { status: 500 }
    );
  }
}

// DELETE /api/contabilidad/exchange/scheduled-reports/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { id } = await params;

    await prisma.scheduledReport.delete({
      where: { id },
    });

    await AuditLogService.log({
      accion: "DELETE",
      entidad: "REPORTE_PROGRAMADO",
      entidadId: id,
      usuarioId: user.userId,
      detalles: {}
    });

    return NextResponse.json({
      success: true,
      message: "Reporte programado eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar reporte programado:", error);
    return NextResponse.json(
      { success: false, error: "Error al eliminar reporte programado" },
      { status: 500 }
    );
  }
}

// POST /api/contabilidad/exchange/scheduled-reports/[id]/execute
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reporte = await prisma.scheduledReport.findUnique({
      where: { id },
    });

    if (!reporte) {
      return NextResponse.json(
        { success: false, error: "Reporte programado no encontrado" },
        { status: 404 }
      );
    }

    const resultado = {
      success: true,
      message: "Reporte ejecutado correctamente",
      reporteId: reporte.id,
      tipo: reporte.tipoReporte,
      formato: reporte.formato,
      generadoEn: new Date().toISOString(),
    };

    await prisma.scheduledReport.update({
      where: { id },
      data: {
        ultimaEjecucion: new Date(),
        totalEjecuciones: reporte.totalEjecuciones + 1,
        ultimaEjecucionExitosa: true,
      },
    });

    const proxima = calcularProximaEjecucion(
      reporte.frecuencia,
      reporte.diaSemana,
      reporte.diaMes,
      reporte.hora,
      reporte.zonaHoraria
    );

    await prisma.scheduledReport.update({
      where: { id },
      data: {
        proximaEjecucion: proxima,
      },
    });

    return NextResponse.json({
      success: true,
      data: resultado,
    });
  } catch (error) {
    console.error("Error al ejecutar reporte programado:", error);
    return NextResponse.json(
      { success: false, error: "Error al ejecutar reporte programado" },
      { status: 500 }
    );
  }
}

function calcularProximaEjecucion(
  frecuencia: string,
  diaSemana: number | null | undefined,
  diaMes: number | null | undefined,
  hora: string,
  zonaHoraria: string
): Date {
  const ahora = new Date();
  const [hours, minutes] = hora.split(":").map(Number);

  const proxima = new Date(ahora);
  proxima.setHours(hours, minutes, 0, 0);

  const diaDelMes = proxima.getDate();

  switch (frecuencia) {
    case "diaria":
      if (proxima <= ahora) {
        proxima.setDate(proxima.getDate() + 1);
      }
      break;
    case "semanal":
      const diaActual = proxima.getDay();
      const diasParaSumar = ((diaSemana || 0) - diaActual + 7) % 7 || 7;
      proxima.setDate(proxima.getDate() + diasParaSumar);
      break;
    case "quincenal":
      if (diaDelMes < 15) {
        proxima.setDate(15);
      } else {
        proxima.setMonth(proxima.getMonth() + 1);
        proxima.setDate(15);
      }
      break;
    case "mensual":
      const ultimoDiaMes = new Date(proxima.getFullYear(), proxima.getMonth() + 1, 0).getDate();
      const diaObjetivo = Math.min(diaMes || 1, ultimoDiaMes);
      if (diaDelMes < diaObjetivo) {
        proxima.setDate(diaObjetivo);
      } else {
        proxima.setMonth(proxima.getMonth() + 1);
        const nuevoUltimoDia = new Date(proxima.getFullYear(), proxima.getMonth() + 1, 0).getDate();
        proxima.setDate(Math.min(diaMes || 1, nuevoUltimoDia));
      }
      break;
  }

  return proxima;
}
