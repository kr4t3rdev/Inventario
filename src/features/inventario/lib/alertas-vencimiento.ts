/**
 * @description Calculador puro de alertas de vencimiento de lotes (fase 5.4).
 * No depende de Prisma ni del reloj: recibe los lotes, la fecha actual y la
 * ventana configurada, y devuelve las alertas ordenadas por urgencia.
 *
 * @module features/inventario/lib/alertas-vencimiento
 */

/** Ventana por defecto (días) para avisar el vencimiento de un lote. */
export const DIAS_ALERTA_VENCIMIENTO_DEFAULT = 30;

/** Ventana mínima configurable (días). */
export const DIAS_ALERTA_VENCIMIENTO_MINIMO = 1;

/** Ventana máxima configurable (días). */
export const DIAS_ALERTA_VENCIMIENTO_MAXIMO = 30;

const MS_POR_DIA = 86_400_000;

/** Estado de la alerta según el vencimiento del lote. */
export type EstadoAlertaLote = 'VENCIDO' | 'POR_VENCER';

/**
 * @description Lote mínimo necesario para evaluar una alerta de vencimiento.
 */
export interface LoteParaAlerta {
  id: string;
  codigo: string;
  fechaVencimiento: Date | null;
  cantidadDisponible: number;
  producto?: { id: string; nombre: string } | null;
}

/**
 * @description Alerta calculada para un lote con stock disponible.
 */
export interface AlertaVencimientoLote {
  loteId: string;
  codigo: string;
  productoId: string;
  productoNombre: string;
  fechaVencimiento: Date;
  cantidadDisponible: number;
  /** Días hasta el vencimiento; negativo cuando el lote ya venció. */
  diasRestantes: number;
  estado: EstadoAlertaLote;
}

/**
 * @description Trunca una fecha al inicio de su día UTC para comparar días completos.
 * @param {Date} fecha - Fecha a truncar.
 * @returns {Date} Misma fecha a las 00:00 UTC.
 */
function truncarAlDiaUTC(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

/**
 * @description Normaliza la ventana de alerta configurable por el tenant.
 * Valores fuera de rango se acotan al máximo (30) o al mínimo (1); los valores
 * no numéricos caen en el valor por defecto (30).
 * @param {number | null | undefined} valor - Días configurados por el tenant o la llamada.
 * @returns {number} Días efectivos de la ventana de alerta.
 */
export function resolverDiasAlertaVencimiento(valor?: number | null): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || !Number.isInteger(valor)) {
    return DIAS_ALERTA_VENCIMIENTO_DEFAULT;
  }
  if (valor < DIAS_ALERTA_VENCIMIENTO_MINIMO) return DIAS_ALERTA_VENCIMIENTO_MINIMO;
  if (valor > DIAS_ALERTA_VENCIMIENTO_MAXIMO) return DIAS_ALERTA_VENCIMIENTO_MAXIMO;
  return valor;
}

/**
 * @description Calcula los días completos hasta el vencimiento de un lote.
 * @param {Date} fechaVencimiento - Fecha de vencimiento del lote.
 * @param {Date} hoy - Fecha de referencia.
 * @returns {number} Días restantes; negativo si el lote ya venció.
 */
export function diasHastaVencimiento(fechaVencimiento: Date, hoy: Date): number {
  const diferencia =
    truncarAlDiaUTC(fechaVencimiento).getTime() - truncarAlDiaUTC(hoy).getTime();
  return Math.round(diferencia / MS_POR_DIA);
}

/**
 * @description Calcula las alertas de vencimiento de los lotes con stock disponible.
 * Solo entran los lotes con fecha de vencimiento y cantidad disponible mayor que
 * cero: vencidos (fecha anterior a hoy) o por vencer dentro de la ventana.
 * @param {LoteParaAlerta[]} lotes - Lotes candidatos del tenant.
 * @param {Object} opciones - Fecha de referencia y ventana de alerta.
 * @param {Date} opciones.hoy - Fecha de referencia.
 * @param {number} opciones.diasAlerta - Ventana de aviso en días.
 * @returns {AlertaVencimientoLote[]} Alertas ordenadas por urgencia y código.
 */
export function calcularAlertasVencimientoLotes(
  lotes: LoteParaAlerta[],
  opciones: { hoy: Date; diasAlerta: number },
): AlertaVencimientoLote[] {
  const diasAlerta = resolverDiasAlertaVencimiento(opciones.diasAlerta);

  const alertas = lotes
    .filter((lote) => lote.cantidadDisponible > 0 && lote.fechaVencimiento instanceof Date)
    .map((lote) => {
      const fechaVencimiento = lote.fechaVencimiento as Date;
      const diasRestantes = diasHastaVencimiento(fechaVencimiento, opciones.hoy);
      return {
        loteId: lote.id,
        codigo: lote.codigo,
        productoId: lote.producto?.id ?? '',
        productoNombre: lote.producto?.nombre ?? '',
        fechaVencimiento,
        cantidadDisponible: lote.cantidadDisponible,
        diasRestantes,
        estado: (diasRestantes < 0 ? 'VENCIDO' : 'POR_VENCER') as EstadoAlertaLote,
      };
    })
    .filter((alerta) => alerta.estado === 'VENCIDO' || alerta.diasRestantes <= diasAlerta);

  return alertas.sort((a, b) => {
    if (a.diasRestantes !== b.diasRestantes) return a.diasRestantes - b.diasRestantes;
    return a.codigo.localeCompare(b.codigo);
  });
}
