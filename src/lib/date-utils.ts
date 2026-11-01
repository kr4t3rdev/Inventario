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

/**
 * @description Normaliza una fecha a string ISO aceptando tanto `Date` como
 * string ISO. Las Server Actions envueltas en `withAction` ya serializan los
 * `Date` de Prisma a string (ver `serializePrismaData`), por lo que llamar a
 * `.toISOString()` sobre ese resultado lanza `TypeError` y rompe el render del
 * Server Component. Este helper tolera ambos formatos.
 * @param {Date | string} value - Fecha a normalizar.
 * @returns {string} Fecha en formato ISO; si el string no es parseable se
 * devuelve tal cual para no interrumpir el render.
 */
export function toIsoString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}

/**
 * @description Normaliza una fecha opcional a string ISO, aceptando `Date`,
 * string ISO, `null` o `undefined`.
 * @param {Date | string | null | undefined} value - Fecha a normalizar.
 * @returns {string | null} Fecha en formato ISO o `null` si no hay valor.
 */
export function toIsoStringOrNull(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return toIsoString(value)
}
