/**
 * @description Paleta global de colores para graficos del dashboard Wanda.
 */
export const chartPalette = {
  neutral: '#64748b',
  accentPrimary: '#2563eb',
  accentSecondary: '#14b8a6',
  alert: '#f43f5e'
}

export const chartOpacity = {
  default: 1,
  hover: 0.95,
  muted: 0.6
}

export const chartTooltipStyle = {
  borderRadius: '10px',
  border: '1px solid hsl(var(--border))',
  backgroundColor: 'hsl(var(--card))',
  color: 'hsl(var(--card-foreground))',
  boxShadow: '0 10px 25px -10px rgb(0 0 0 / 0.25)',
  padding: '8px 10px',
  fontSize: '12px'
}

export const chartTooltipLabelStyle = {
  color: 'hsl(var(--muted-foreground))',
  fontSize: '11px',
  fontWeight: 600
}

export const chartTooltipItemStyle = {
  color: 'hsl(var(--foreground))',
  fontSize: '12px',
  fontWeight: 600
}

/**
 * @description Formatea un valor monetario en pesos con separador de miles.
 * @param {number} value - Valor numerico.
 * @returns {string} Valor formateado en moneda.
 */
export function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`
}

/**
 * @description Formatea un valor porcentual.
 * @param {number} value - Valor numerico en porcentaje.
 * @param {number} digits - Cantidad de decimales.
 * @returns {string} Valor formateado en porcentaje.
 */
export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

/**
 * @description Formatea un valor de conteo sin moneda.
 * @param {number} value - Valor numerico.
 * @returns {string} Valor formateado con separador de miles.
 */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString()
}

/**
 * @description Formatea horas decimales a HH:MM.
 * @param {number} hours - Horas en formato decimal.
 * @returns {string} Hora en formato HH:MM.
 */
export function formatHoursMinutes(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60))
  const hh = Math.floor(totalMinutes / 60)
  const mm = totalMinutes % 60
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
}

/**
 * @description Agrega etiqueta estandar para horas (hrs).
 * @param {string} time - Tiempo formateado.
 * @returns {string} Tiempo con sufijo.
 */
export function withHoursLabel(time: string): string {
  return `${time} hrs`
}

/**
 * @description Devuelve un color de la paleta segun el indice.
 * @param {number} index - Indice del elemento.
 * @returns {string} Color hexadecimal.
 */
export function getChartColor(index: number): string {
  const colors = [
    chartPalette.accentPrimary,
    chartPalette.accentSecondary,
    chartPalette.alert,
    chartPalette.neutral
  ]

  return colors[index % colors.length]
}
