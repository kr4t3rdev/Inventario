/**
 * @description Convierte una fecha inclusiva en el último instante de ese día en UTC.
 * @param {string} value - Fecha en formato ISO o YYYY-MM-DD.
 * @returns {Date} Último milisegundo del día indicado.
 */
export function endOfDay(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T23:59:59.999Z`);
  }

  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}
