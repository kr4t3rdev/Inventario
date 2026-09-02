/**
 * @description Claves de período rápido para el dashboard de contabilidad.
 */
export type PeriodoClave = 'hoy' | 'semana' | 'mes';

export interface RangoPeriodo {
  fechaInicio: string;
  fechaFin: string;
  etiqueta: string;
}

function toCivilString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * @description Resuelve el rango de fechas civiles para una clave de período rápido.
 * Usa la hora local del navegador para construir fechas YYYY-MM-DD sin desfase UTC.
 * @param {PeriodoClave} clave - Clave del período solicitado.
 * @param {Date} ahora - Fecha de referencia para el cálculo (inyectable en tests).
 * @returns {RangoPeriodo} Rango con fechaInicio, fechaFin y etiqueta legible.
 */
export function getRangoPeriodo(clave: PeriodoClave, ahora: Date): RangoPeriodo {
  const hoyStr = toCivilString(ahora);

  if (clave === 'hoy') {
    return { fechaInicio: hoyStr, fechaFin: hoyStr, etiqueta: 'Hoy' };
  }

  if (clave === 'semana') {
    const lunes = new Date(ahora);
    const dayOfWeek = lunes.getDay();
    // getDay(): domingo=0, lunes=1, ... sábado=6 → para la semana que empieza en lunes
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    lunes.setDate(lunes.getDate() + diff);
    return {
      fechaInicio: toCivilString(lunes),
      fechaFin: hoyStr,
      etiqueta: 'Esta semana',
    };
  }

  // mes
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  return {
    fechaInicio: toCivilString(inicioMes),
    fechaFin: hoyStr,
    etiqueta: 'Este mes',
  };
}
