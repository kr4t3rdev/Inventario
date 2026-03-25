/**
 * @description Utilidades para el módulo de producción.
 * @module produccion
 */

/**
 * @description Interfaz para un ingrediente de receta.
 */
export interface IngredienteReceta {
  productoId: string
  cantidad: number
  producto?: {
    nombre: string
    precioCosto: number
    stock: number
  }
}

/**
 * @description Interfaz para el resultado de materiales faltantes.
 */
export interface MaterialFaltante {
  productoId: string
  productoNombre: string
  requerido: number
  disponible: number
}

/**
 * @description Interfaz para el resultado del cálculo de costo.
 */
export interface ResultadoCostoProduccion {
  costoMateriales: number
  costoUnitario: number
  detalle: Array<{
    productoId: string
    productoNombre: string
    cantidad: number
    costoUnitario: number
    costoTotal: number
  }>
}

/**
 * @description Calcula el costo total de materiales para una orden de producción.
 * @param {IngredienteReceta[]} ingredientes - Lista de ingredientes con sus cantidades.
 * @param {number} cantidadProducir - Cantidad de unidades a producir.
 * @returns {ResultadoCostoProduccion} Objeto con el costo total, costo unitario y detalle.
 */
export function calcularCostoProduccion(
  ingredientes: IngredienteReceta[],
  cantidadProducir: number
): ResultadoCostoProduccion {
  const detalle: ResultadoCostoProduccion['detalle'] = []
  let costoMateriales = 0

  for (const ingrediente of ingredientes) {
    const cantidadUsada = ingrediente.cantidad * cantidadProducir
    const costoUnitario = ingrediente.producto?.precioCosto || 0
    const costoTotal = costoUnitario * cantidadUsada

    costoMateriales += costoTotal

    detalle.push({
      productoId: ingrediente.productoId,
      productoNombre: ingrediente.producto?.nombre || 'Desconocido',
      cantidad: cantidadUsada,
      costoUnitario,
      costoTotal,
    })
  }

  const costoUnitario = cantidadProducir > 0 
    ? Math.round(costoMateriales / cantidadProducir) 
    : 0

  return {
    costoMateriales,
    costoUnitario,
    detalle,
  }
}

/**
 * @description Valida si hay suficientes materiales en stock para una orden de producción.
 * @param {IngredienteReceta[]} ingredientes - Lista de ingredientes con sus cantidades.
 * @param {number} cantidadProducir - Cantidad de unidades a producir.
 * @returns {MaterialFaltante[]} Array vacío si hay suficientes materiales, o lista de materiales faltantes.
 */
export function validarDisponibilidadMateriales(
  ingredientes: IngredienteReceta[],
  cantidadProducir: number
): MaterialFaltante[] {
  const materialesFaltantes: MaterialFaltante[] = []

  for (const ingrediente of ingredientes) {
    const cantidadRequerida = ingrediente.cantidad * cantidadProducir
    const disponible = ingrediente.producto?.stock || 0

    if (disponible < cantidadRequerida) {
      materialesFaltantes.push({
        productoId: ingrediente.productoId,
        productoNombre: ingrediente.producto?.nombre || 'Desconocido',
        requerido: cantidadRequerida,
        disponible,
      })
    }
  }

  return materialesFaltantes
}

/**
 * @description Calcula el rendimiento final considerando mermas.
 * @param {number} cantidadBase - Cantidad base de producción.
 * @param {number} porcentajeMerma - Porcentaje de merma (0-100).
 * @returns {number} Cantidad final после merma.
 */
export function calcularRendimientoConMerma(
  cantidadBase: number,
  porcentajeMerma: number
): number {
  if (porcentajeMerma < 0 || porcentajeMerma > 100) {
    throw new Error('El porcentaje de merma debe estar entre 0 y 100')
  }
  return Math.round(cantidadBase * (1 - porcentajeMerma / 100))
}
