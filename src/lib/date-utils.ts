/**
 * @description Utilidades de fechas para el cálculo de expiración y vigencia
 *              de licencias (evita duplicar la matemática de días en ms).
 *
 * @module lib/date-utils
 */

export const MS_PER_DAY = 86400000

/**
 * @description Suma días a una fecha base sin mutarla.
 * @param {Date} date - Fecha base.
 * @param {number} days - Días a sumar (puede ser negativo).
 * @returns {Date} Nueva fecha con los días sumados.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}
