import { prisma } from "@/lib/prisma";
import type { ScheduledReport } from "@/generated/prisma";

/**
 * @description Servicio de scheduler para reportes programados del dashboard de inteligencia cambiaria
 * Maneja la programación, ejecución y gestión de reportes automáticos
 */

// Tipo para el callback de generación de reporte
type ReporteGeneratorFn = (reporteId: string, parametros: Record<string, unknown>) => Promise<void>;

// Callback para generar el reporte (se asigna desde fuera del módulo)
let reportGeneratorCallback: ReporteGeneratorFn | null = null;

/**
 * @description Registra el callback para generar reportes
 * @param {ReporteGeneratorFn} callback - Función que genera el reporte
 */
export function registerReportGenerator(callback: ReporteGeneratorFn): void {
  reportGeneratorCallback = callback;
}

/**
 * @description Obtiene el callback de generación de reportes
 * @returns {ReporteGeneratorFn | null} El callback registrado o null
 */
export function getReportGenerator(): ReporteGeneratorFn | null {
  return reportGeneratorCallback;
}

/**
 * @description Calcula la próxima fecha de ejecución basada en la frecuencia
 * @param {string} frecuencia - Frecuencia del reporte (diaria, semanal, quincenal, mensual)
 * @param {number | null | undefined} diaSemana - Día de la semana (0-6)
 * @param {number | null | undefined} diaMes - Día del mes (1-31)
 * @param {string} hora - Hora en formato HH:MM
 * @param {string} zonaHoraria - Zona horaria
 * @returns {Date} Próxima fecha de ejecución
 */
export function calcularProximaEjecucion(
  frecuencia: string,
  diaSemana: number | null | undefined,
  diaMes: number | null | undefined,
  hora: string,
  zonaHoraria: string = "America/Havana"
): Date {
  const ahora = new Date();
  const [hours, minutes] = hora.split(":").map(Number);

  let proxima = new Date(ahora);
  proxima.setHours(hours, minutes, 0, 0);

  // Ajuste para zona horaria
  const offsetZona = getTimezoneOffset(zonaHoraria);
  proxima = new Date(proxima.getTime() + offsetZona * 60 * 1000);

  switch (frecuencia) {
    case "diaria":
      if (proxima <= ahora) {
        proxima.setDate(proxima.getDate() + 1);
      }
      break;

    case "semanal":
      if (diaSemana !== null && diaSemana !== undefined) {
        const diaActual = proxima.getDay();
        const diasParaSumar = (diaSemana - diaActual + 7) % 7 || 7;
        if (diasParaSumar === 0 && proxima <= ahora) {
          proxima.setDate(proxima.getDate() + 7);
        } else {
          proxima.setDate(proxima.getDate() + diasParaSumar);
        }
      }
      break;

    case "quincenal":
      const diaDelMesQuincenal = proxima.getDate();
      if (diaDelMesQuincenal < 15) {
        proxima.setDate(15);
      } else {
        proxima.setMonth(proxima.getMonth() + 1);
        proxima.setDate(15);
      }
      break;

    case "mensual":
      if (diaMes !== null && diaMes !== undefined) {
        const ultimoDiaMes = new Date(proxima.getFullYear(), proxima.getMonth() + 1, 0).getDate();
        const diaObjetivo = Math.min(diaMes, ultimoDiaMes);
        const diaActualMes = proxima.getDate();

        if (diaActualMes < diaObjetivo) {
          proxima.setDate(diaObjetivo);
        } else if (diaActualMes > diaObjetivo) {
          proxima.setMonth(proxima.getMonth() + 1);
          const nuevoUltimoDia = new Date(proxima.getFullYear(), proxima.getMonth() + 1, 0).getDate();
          proxima.setDate(Math.min(diaMes, nuevoUltimoDia));
        } else {
          if (proxima <= ahora) {
            proxima.setMonth(proxima.getMonth() + 1);
            const nuevoUltimoDia = new Date(proxima.getFullYear(), proxima.getMonth() + 1, 0).getDate();
            proxima.setDate(Math.min(diaMes, nuevoUltimoDia));
          }
        }
      }
      break;
  }

  return proxima;
}

/**
 * @description Obtiene el offset de zona horaria en minutos
 * @param {string} zonaHoraria - Nombre de la zona horaria
 * @returns {number} Offset en minutos
 */
function getTimezoneOffset(zonaHoraria: string): number {
  const zonas: Record<string, number> = {
    "America/Havana": -300,
    "America/New_York": -300,
    "America/Chicago": -360,
    "America/Denver": -420,
    "America/Los_Angeles": -480,
    "Europe/Madrid": 60,
    "UTC": 0,
  };

  return zonas[zonaHoraria] || 0;
}

/**
 * @description Crea un nuevo reporte programado
 * @param {Object} datos - Datos del reporte programado
 * @returns {Promise<ScheduledReport>} El reporte programado creado
 */
export async function crearReporteProgramado(datos: {
  nombre: string;
  descripcion?: string;
  tipoReporte: string;
  formato: string;
  parametros?: Record<string, unknown>;
  frecuencia: string;
  diaSemana?: number;
  diaMes?: number;
  hora: string;
  zonaHoraria?: string;
  enviarEmail?: boolean;
  destinatarios?: string[];
  asuntoEmail?: string;
  cuerpoEmail?: string;
  creadoPor: string;
}): Promise<ScheduledReport> {
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
  } = datos;

  const frecuenciasValidas = ["diaria", "semanal", "quincenal", "mensual"];
  if (!frecuenciasValidas.includes(frecuencia)) {
    throw new Error(`Frecuencia inválida: ${frecuencia}`);
  }

  if (frecuencia === "semanal" && (diaSemana === undefined || diaSemana === null)) {
    throw new Error("Debe especificar el día de la semana para reportes semanales");
  }

  if (frecuencia === "mensual" && (diaMes === undefined || diaMes === null)) {
    throw new Error("Debe especificar el día del mes para reportes mensuales");
  }

  const proximaEjecucion = calcularProximaEjecucion(frecuencia, diaSemana, diaMes, hora, zonaHoraria);

  return prisma.scheduledReport.create({
    data: {
      nombre,
      descripcion,
      tipoReporte,
      formato,
      parametros: parametros ? JSON.stringify(parametros) : null,
      frecuencia,
      diaSemana: frecuencia === "semanal" ? diaSemana ?? null : null,
      diaMes: frecuencia === "mensual" || frecuencia === "quincenal" ? diaMes ?? null : null,
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
}

/**
 * @description Actualiza un reporte programado
 * @param {string} id - ID del reporte programado
 * @param {Object} datos - Datos a actualizar
 * @returns {Promise<ScheduledReport>} El reporte programado actualizado
 */
export async function actualizarReporteProgramado(
  id: string,
  datos: Partial<{
    nombre: string;
    descripcion: string;
    tipoReporte: string;
    formato: string;
    parametros: Record<string, unknown>;
    frecuencia: string;
    diaSemana: number;
    diaMes: number;
    hora: string;
    zonaHoraria: string;
    activo: boolean;
    enviarEmail: boolean;
    destinatarios: string[];
    asuntoEmail: string;
    cuerpoEmail: string;
  }>
): Promise<ScheduledReport> {
  let proximaEjecucion: Date | undefined;
  
  if (datos.frecuencia || datos.diaSemana !== undefined || datos.diaMes !== undefined || datos.hora) {
    const reporte = await prisma.scheduledReport.findUnique({ where: { id } });
    if (reporte) {
      const frecuencia = datos.frecuencia || reporte.frecuencia;
      const diaSemana = datos.diaSemana !== undefined ? datos.diaSemana : reporte.diaSemana;
      const diaMes = datos.diaMes !== undefined ? datos.diaMes : reporte.diaMes;
      const hora = datos.hora || reporte.hora;
      const zonaHoraria = datos.zonaHoraria || reporte.zonaHoraria;

      proximaEjecucion = calcularProximaEjecucion(frecuencia, diaSemana, diaMes, hora, zonaHoraria);
    }
  }

  const datosActualizacion: Record<string, unknown> = { ...datos };
  
  if (datos.parametros) {
    datosActualizacion.parametros = JSON.stringify(datos.parametros);
    delete datosActualizacion.parametros;
  }
  
  if (datos.destinatarios) {
    datosActualizacion.destinatarios = JSON.stringify(datos.destinatarios);
    delete datosActualizacion.destinatarios;
  }

  if (proximaEjecucion) {
    datosActualizacion.proximaEjecucion = proximaEjecucion;
  }

  return prisma.scheduledReport.update({
    where: { id },
    data: datosActualizacion,
  });
}

/**
 * @description Activa o desactiva un reporte programado
 * @param {string} id - ID del reporte programado
 * @param {boolean} activo - Estado de activación
 * @returns {Promise<ScheduledReport>} El reporte programado actualizado
 */
export async function activarReporteProgramado(id: string, activo: boolean): Promise<ScheduledReport> {
  const reporte = await prisma.scheduledReport.findUnique({ where: { id } });
  
  if (!reporte) {
    throw new Error("Reporte programado no encontrado");
  }

  let proximaEjecucion: Date | undefined;
  if (activo) {
    proximaEjecucion = calcularProximaEjecucion(
      reporte.frecuencia,
      reporte.diaSemana,
      reporte.diaMes,
      reporte.hora,
      reporte.zonaHoraria
    );
  }

  return prisma.scheduledReport.update({
    where: { id },
    data: {
      activo,
      proximaEjecucion,
    },
  });
}

/**
 * @description Ejecuta un reporte programado manualmente
 * @param {string} id - ID del reporte programado
 * @returns {Promise<{success: boolean; message: string}>} Resultado de la ejecución
 */
export async function ejecutarReporteProgramado(id: string): Promise<{ success: boolean; message: string }> {
  const reporte = await prisma.scheduledReport.findUnique({ where: { id } });
  
  if (!reporte) {
    return { success: false, message: "Reporte programado no encontrado" };
  }

  if (!reporte.activo) {
    return { success: false, message: "El reporte programado está desactivado" };
  }

  try {
    const parametros = reporte.parametros ? JSON.parse(reporte.parametros) : {};

    if (reportGeneratorCallback) {
      await reportGeneratorCallback(id, parametros);
    } else {
      await generarReporteSimulado(reporte, parametros);
    }

    await prisma.scheduledReport.update({
      where: { id },
      data: {
        ultimaEjecucion: new Date(),
        totalEjecuciones: { increment: 1 },
        ultimaEjecucionExitosa: true,
        proximaEjecucion: calcularProximaEjecucion(
          reporte.frecuencia,
          reporte.diaSemana,
          reporte.diaMes,
          reporte.hora,
          reporte.zonaHoraria
        ),
      },
    });

    return { success: true, message: "Reporte ejecutado exitosamente" };
  } catch (error) {
    await prisma.scheduledReport.update({
      where: { id },
      data: {
        ultimaEjecucion: new Date(),
        totalEjecuciones: { increment: 1 },
        ultimaEjecucionExitosa: false,
      },
    });

    return { success: false, message: `Error al ejecutar reporte: ${(error as Error).message}` };
  }
}

/**
 * @description Genera un reporte simulado
 * @param {ScheduledReport} reporte - El reporte programado
 * @param {Record<string, unknown>} parametros - Parámetros del reporte
 */
async function generarReporteSimulado(
  reporte: ScheduledReport,
  _parametros: Record<string, unknown>
): Promise<void> {
  await prisma.reportHistory.create({
    data: {
      tipoReporte: reporte.tipoReporte,
      formato: reporte.formato,
      nombre: `Programado: ${reporte.nombre}`,
      descripcion: reporte.descripcion,
      parametros: reporte.parametros,
      resumenEjecutivo: `Reporte programado generado automáticamente el ${new Date().toISOString()}`,
      numeroAlertas: 0,
      metricasClave: JSON.stringify({
        tipoReporte: reporte.tipoReporte,
        frecuencia: reporte.frecuencia,
      }),
      generadoPor: reporte.creadoPor,
    },
  });
}

/**
 * @description Obtiene reportes programados pendientes de ejecución
 * @returns {Promise<ScheduledReport[]>} Lista de reportes pendientes
 */
export async function obtenerReportesPendientes(): Promise<ScheduledReport[]> {
  const ahora = new Date();
  
  return prisma.scheduledReport.findMany({
    where: {
      activo: true,
      proximaEjecucion: {
        lte: ahora,
      },
    },
    orderBy: {
      proximaEjecucion: "asc",
    },
  });
}

/**
 * @description Ejecuta todos los reportes programados pendientes
 * @returns {Promise<{ejecutados: number; fallidos: number}>} Resultado de las ejecuciones
 */
export async function ejecutarReportesPendientes(): Promise<{ ejecutados: number; fallidos: number }> {
  const pendientes = await obtenerReportesPendientes();
  let ejecutados = 0;
  let fallidos = 0;

  for (const reporte of pendientes) {
    const resultado = await ejecutarReporteProgramado(reporte.id);
    if (resultado.success) {
      ejecutados++;
    } else {
      fallidos++;
    }
  }

  return { ejecutados, fallidos };
}

/**
 * @description Elimina un reporte programado
 * @param {string} id - ID del reporte programado
 * @returns {Promise<ScheduledReport>} El reporte eliminado
 */
export async function eliminarReporteProgramado(id: string): Promise<ScheduledReport> {
  return prisma.scheduledReport.delete({
    where: { id },
  });
}

/**
 * @description Obtiene un reporte programado por ID
 * @param {string} id - ID del reporte programado
 * @returns {Promise<ScheduledReport | null>} El reporte programado o null
 */
export async function obtenerReporteProgramado(id: string): Promise<ScheduledReport | null> {
  return prisma.scheduledReport.findUnique({
    where: { id },
  });
}

/**
 * @description Obtiene estadísticas de reportes programados
 * @returns {Promise<Object>} Estadísticas de reportes
 */
export async function obtenerEstadisticasScheduler(): Promise<{
  total: number;
  activos: number;
  inactivos: number;
  porFrecuencia: Record<string, number>;
  proximasEjecuciones: ScheduledReport[];
}> {
  const [total, activos, inactivos, porFrecuencia, proximasEjecuciones] = await Promise.all([
    prisma.scheduledReport.count(),
    prisma.scheduledReport.count({ where: { activo: true } }),
    prisma.scheduledReport.count({ where: { activo: false } }),
    prisma.scheduledReport.groupBy({
      by: ["frecuencia"],
      _count: true,
      where: { activo: true },
    }),
    prisma.scheduledReport.findMany({
      where: {
        activo: true,
        proximaEjecucion: {
          gte: new Date(),
        },
      },
      orderBy: {
        proximaEjecucion: "asc",
      },
      take: 10,
    }),
  ]);

  return {
    total,
    activos,
    inactivos,
    porFrecuencia: Object.fromEntries(porFrecuencia.map((f: { frecuencia: string; _count: number }) => [f.frecuencia, f._count])),
    proximasEjecuciones,
  };
}
