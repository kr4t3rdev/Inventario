/**
 * @description Formatea una fecha como hora corta HH:mm en locale es-ES (24h).
 * @param {Date} fecha - Fecha a formatear.
 * @returns {string} Hora formateada, p. ej. "14:32".
 */
export function formatHoraCorta(fecha: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha);
}
