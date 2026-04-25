/**
 * @description Normaliza un valor decimal ingresado con coma o punto para su uso en formularios.
 * @param {string} value - Valor ingresado por el usuario.
 * @returns {string} Valor normalizado para coerción numérica.
 */
export function normalizeLocaleDecimalInput(value: string): string {
  return value.trim().replace(/,/g, '.')
}

/**
 * @description Normaliza un valor desconocido antes de pasarlo a Zod o a parseo numérico.
 * @param {unknown} value - Valor original.
 * @returns {unknown} Valor normalizado si era string; en otro caso el mismo valor.
 */
export function normalizeLocaleDecimalValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  return normalizeLocaleDecimalInput(value)
}

/**
 * @description Convierte un valor localizable a número usando coma o punto decimal.
 * @param {unknown} value - Valor a convertir.
 * @returns {number} Número parseado o NaN si no es válido.
 */
export function parseLocaleNumber(value: unknown): number {
  const normalized = normalizeLocaleDecimalValue(value)

  if (typeof normalized === 'number') {
    return normalized
  }

  return Number(normalized)
}