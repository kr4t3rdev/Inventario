import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verify_token } from "@/lib/auth-utils";
import { AuditLogService } from "@/lib/services/audit-log-service";

/**
 * @description Endpoint para gestionar reportes programados del dashboard de inteligencia cambiaria
 * @route GET /api/contabilidad/exchange/scheduled-reports - Obtener reportes programados
 * @route POST /api/contabilidad/exchange/scheduled-reports - Crear nuevo reporte programado
 */

// GET /api/contabilidad/exchange/scheduled-reports
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parámetros de filtrado
    const activo = searchParams.get("activo");
    const frecuencia = searchParams.get("frecuencia");
    const tipoReporte = searchParams.get("tipoReporte");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Construir filtros
    const where: Record<string, unknown> = {};

    if (activo !== null && activo !== "") {
      where.activo = activo === "true";
    }

    if (frecuencia) {
      where.frecuencia = frecuencia;
    }

    if (tipoReporte) {
      where.tipoReporte = tipoReporte;
    }

    // Obtener reportes programados con paginación
    const [reportes, total] = await Promise.all([
      prisma.scheduledReport.findMany({
        where,
        orderBy: { fechaCreacion: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.scheduledReport.count({ where }),
    ]);

    // Obtener estadísticas
    const estadisticas = await prisma.scheduledReport.groupBy({
      by: ["frecuencia", "activo"],
      _count: true,
      where,
    });

    return NextResponse.json({
      success: true,
      data: reportes,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + reportes.length < total,
      },
      estadisticas,
    });
  } catch (error) {
    console.error("Error al obtener reportes programados:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener reportes programados" },
      { status: 500 }
    );
  }
}

// POST /api/contabilidad/exchange/scheduled-reports
export async function POST(request: NextRequest) {
  try {
    const user = await verify_token(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

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
      enviarEmail,
      destinatarios,
      asuntoEmail,
      cuerpoEmail,
      creadoPor,
    } = body;

    // Validar campos requeridos
    if (!nombre || !tipoReporte || !formato || !frecuencia || !hora || !creadoPor) {
      return NextResponse.json(
        { success: false, error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    // Validar frecuencia
    const frecuenciasValidas = ["diaria", "semanal", "quincenal", "mensual"];
    if (!frecuenciasValidas.includes(frecuencia)) {
      return NextResponse.json(
        { success: false, error: "Frecuencia inválida" },
        { status: 400 }
      );
    }

    // Validar día de la semana para reportes semanales
    if (frecuencia === "semanal" && (diaSemana === undefined || diaSemana === null)) {
      return NextResponse.json(
        { success: false, error: "Debe especificar el día de la semana para reportes semanales" },
        { status: 400 }
      );
    }

    // Validar día del mes para reportes mensuales
    if (frecuencia === "mensual" && (diaMes === undefined || diaMes === null)) {
      return NextResponse.json(
        { success: false, error: "Debe especificar el día del mes para reportes mensuales" },
        { status: 400 }
      );
    }

    // Calcular próxima ejecución
    const proximaEjecucion = calcularProximaEjecucion(frecuencia, diaSemana, diaMes, hora, zonaHoraria);

    // Crear el reporte programado
    const reporte = await prisma.scheduledReport.create({
      data: {
        nombre,
        descripcion,
        tipoReporte,
        formato,
        parametros: parametros ? JSON.stringify(parametros) : null,
        frecuencia,
        diaSemana: frecuencia === "semanal" ? diaSemana : null,
        diaMes: frecuencia === "mensual" || frecuencia === "quincenal" ? diaMes : null,
        hora,
        zonaHoraria: zonaHoraria || "America/Havana",
        activo: true,
        enviarEmail: enviarEmail || false,
        destinatarios: destinatarios ? JSON.stringify(destinatarios) : null,
        asuntoEmail,
        cuerpoEmail,
        proximaEjecucion,
        creadoPor,
      },
    });

    await AuditLogService.log({
      accion: "CREATE",
      entidad: "REPORTE_PROGRAMADO",
      entidadId: reporte.id,
      usuarioId: user.userId,
      detalles: {
        nombre,
        tipoReporte
      }
    });

    return NextResponse.json({
      success: true,
      data: reporte,
    });
  } catch (error) {
    console.error("Error al crear reporte programado:", error);
    return NextResponse.json(
      { success: false, error: "Error al crear reporte programado" },
      { status: 500 }
    );
  }
}

/**
 * @description Calcula la próxima fecha de ejecución basada en la frecuencia
 */
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
      // Si ya pasó la hora de hoy, programar para mañana
      if (proxima <= ahora) {
        proxima.setDate(proxima.getDate() + 1);
      }
      break;

    case "semanal":
      // Programar para el día de la semana especificado
      const diaActual = proxima.getDay();
      const diasParaSumar = (diaSemana! - diaActual + 7) % 7 || 7;
      proxima.setDate(proxima.getDate() + diasParaSumar);
      break;

    case "quincenal":
      // Programar para el día 15 o último día del mes
      if (diaDelMes < 15) {
        proxima.setDate(15);
      } else {
        // Ir al día 15 del próximo mes
        proxima.setMonth(proxima.getMonth() + 1);
        proxima.setDate(15);
      }
      break;

    case "mensual":
      // Programar para el día especificado del mes
      const ultimoDiaMes = new Date(proxima.getFullYear(), proxima.getMonth() + 1, 0).getDate();
      const diaObjetivo = Math.min(diaMes!, ultimoDiaMes);
      if (diaDelMes < diaObjetivo) {
        proxima.setDate(diaObjetivo);
      } else {
        // Ir al mismo día del próximo mes
        proxima.setMonth(proxima.getMonth() + 1);
        const nuevoUltimoDia = new Date(proxima.getFullYear(), proxima.getMonth() + 1, 0).getDate();
        proxima.setDate(Math.min(diaMes!, nuevoUltimoDia));
      }
      break;
  }

  return proxima;
}
