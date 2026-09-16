/**
 * @description Umbral mínimo de participación para pintar etiqueta en un pie chart.
 * Recharts no detecta colisiones entre etiquetas; las rebanadas pequeñas se
 * solapan garantizadamente, así que solo las rebanadas grandes etiquetan.
 */
export const PIE_LABEL_MIN_PERCENT = 0.05;

/**
 * @description Formatea la etiqueta de una rebanada de pie chart como porcentaje,
 * o la omite cuando la rebanada es demasiado pequeña para ser etiquetada sin solapes.
 * Los nombres de categoría siempre están disponibles en la leyenda del gráfico.
 * @param {number} percent - Participación de la rebanada (0-1)
 * @param {number} [minPercent] - Participación mínima para mostrar etiqueta
 * @returns {string} Etiqueta "NN%" o cadena vacía si debe omitirse
 */
export function formatPiePercentLabel(
  percent: number,
  minPercent: number = PIE_LABEL_MIN_PERCENT,
): string {
  if (!Number.isFinite(percent) || percent < minPercent) return '';
  return `${(percent * 100).toFixed(0)}%`;
}
