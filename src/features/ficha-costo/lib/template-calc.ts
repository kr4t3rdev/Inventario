/**
 * @description Funciones puras de cálculo para plantillas de ficha de costo.
 *   No dependen de Prisma ni del servidor. Testeables en aislamiento.
 */

/**
 * @description Calcula el precio sugerido a partir del costo total y el
 *   margen objetivo deseado.
 *
 *   Fórmula: precioSugerido = costoTotal / (1 - margenObjetivo)
 *
 *   Ejemplos:
 *     - costoTotal=100, margen=0.30 → precio=142.86
 *     - costoTotal=100, margen=0.50 → precio=200.00
 *     - costoTotal=100, margen=0 → precio=100.00
 *
 *   @throws Error si margenObjetivo <= 0 o >= 1
 */
export function calcularPrecioSugerido(
  costoTotal: number,
  margenObjetivo: number,
): number {
  if (!Number.isFinite(margenObjetivo) || margenObjetivo <= 0 || margenObjetivo >= 1) {
    throw new Error('margenObjetivo debe estar entre 0 y 1 (exclusivo)')
  }
  if (!Number.isFinite(costoTotal) || costoTotal < 0) {
    throw new Error('costoTotal debe ser un número >= 0')
  }
  return costoTotal / (1 - margenObjetivo)
}

/**
 * @description Calcula el costo total de una plantilla sumando materiales,
 *   mano de obra e indirectos.
 */
export function calcularCostoTotalPlantilla(
  costoMateriales: number,
  costoManoObra: number,
  costoIndirectos: number,
): number {
  const m = Number.isFinite(costoMateriales) ? costoMateriales : 0
  const mo = Number.isFinite(costoManoObra) ? costoManoObra : 0
  const i = Number.isFinite(costoIndirectos) ? costoIndirectos : 0
  return m + mo + i
}

/**
 * @description Compara los valores de una plantilla contra los valores
 *   actuales del producto (costo estándar y precio de venta).
 *
 *   @returns Objeto con deltas y márgenes calculados.
 */
export function compararPlantillaVsActual(
  costoPlantilla: number,
  precioSugerido: number,
  margenObjetivo: number,
  costoActual: number,
  precioVentaActual: number,
): {
  deltaCostoVsActual: number
  deltaPrecioVsVenta: number
  margenActual: number | null
} {
  const deltaCosto = costoPlantilla - costoActual
  const deltaPrecio = precioSugerido - precioVentaActual
  const margenActual =
    precioVentaActual > 0
      ? ((precioVentaActual - costoActual) / precioVentaActual) * 100
      : null

  return {
    deltaCostoVsActual: deltaCosto,
    deltaPrecioVsVenta: deltaPrecio,
    margenActual,
  }
}
