/**
 * @description Utilidades para el módulo de producción.
 * @module produccion
 */

import { convertToBase } from '@/lib/utils/unit-converter'

/**
 * @description Interfaz para un ingrediente de receta.
 */
export interface IngredienteReceta {
  productoId: string
  cantidad: number
  unidadSimbolo?: string | null
  desperdicio?: number
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
 * @description Calcula la cantidad requerida de un ingrediente considerando unidad y desperdicio.
 * @param {IngredienteReceta} ingrediente - Ingrediente de receta.
 * @param {number} cantidadProducir - Cantidad de producto a producir.
 * @returns {number} Cantidad requerida normalizada.
 */
export function calcularCantidadRequeridaMaterial(
  ingrediente: IngredienteReceta,
  cantidadProducir: number
): number {
  const cantidadBase = convertToBase(ingrediente.cantidad, ingrediente.unidadSimbolo)
  const factorDesperdicio = 1 + (ingrediente.desperdicio ?? 0)
  return Math.ceil((cantidadBase * factorDesperdicio * cantidadProducir) - 1e-9)
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
    const factorDesperdicio = 1 + (ingrediente.desperdicio ?? 0)
    const cantidadUsada = ingrediente.cantidad * factorDesperdicio * cantidadProducir
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
    ? Math.round((costoMateriales / cantidadProducir) * 100) / 100
    : 0

  return {
    costoMateriales: Math.round(costoMateriales * 100) / 100,
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
    const cantidadRequerida = calcularCantidadRequeridaMaterial(ingrediente, cantidadProducir)
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

/**
 * @description Interfaz para un producto agregado a receta (renombrado de ingrediente).
 */
export interface ProductoAgregado {
  productoId: string
  cantidad: number
  unidadSimbolo?: string | null
  producto?: {
    id: string
    nombre: string
    precioCosto: number
  }
}

/**
 * @description Calcula el costo unitario de una receta.
 * Fórmula: (precioCosto_ProductoFinal + Σ(cantidadProducto × precioCosto_Producto)) / rendimiento
 * @param {number} precioCostoProductoFinal - Precio de costo del producto final (si existe).
 * @param {ProductoAgregado[]} productosAgregados - Productos agregados a la receta.
 * @param {number} rendimiento - Rendimiento de la receta (cantidad producida).
 * @returns {number} Costo unitario redondeado a 2 decimales.
 */
export function calculateCostoUnitarioReceta(
  precioCostoProductoFinal: number,
  productosAgregados: ProductoAgregado[],
  rendimiento: number
): number {
  if (rendimiento <= 0) {
    throw new Error('El rendimiento debe ser mayor a 0')
  }

  // Sumar costo del producto final
  let costoTotal = precioCostoProductoFinal

  // Sumar costos de productos agregados
  for (const producto of productosAgregados) {
    const costoUnitarioProducto = producto.producto?.precioCosto || 0
    const costoProducto = producto.cantidad * costoUnitarioProducto
    costoTotal += costoProducto
  }

  // Dividir por rendimiento y redondear a 2 decimales
  const costoUnitario = costoTotal / rendimiento
  return Math.round(costoUnitario * 100) / 100
}

/**
 * @description Interfaz para un producto en inventario (para búsqueda).
 */
export interface ProductoInventario {
  id: string
  nombre: string
  precioCosto: number
  stock: number
}

/**
 * @description Filtra productos por término de búsqueda.
 * La búsqueda es case-insensitive y busca en el nombre del producto.
 * @param {string} searchQuery - Término de búsqueda (puede estar vacío).
 * @param {ProductoInventario[]} productos - Lista completa de productos.
 * @returns {ProductoInventario[]} Productos filtrados.
 */
export function filterProductos(
  searchQuery: string,
  productos: ProductoInventario[]
): ProductoInventario[] {
  if (!searchQuery || searchQuery.trim() === '') {
    return productos
  }

  const query = searchQuery.toLowerCase().trim()
  return productos.filter((p) => p.nombre.toLowerCase().includes(query))
}
