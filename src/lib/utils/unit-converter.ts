/**
 * @description Unidades de masa soportadas para conversion a gramos.
 */
export const MASS_UNITS = ['g', 'kg', 'lb', 'oz'] as const

/**
 * @description Unidades de volumen soportadas para conversion a mililitros.
 */
export const VOLUME_UNITS = ['ml', 'L', 'fl oz', 'tsp', 'tbsp', 'cup'] as const

/**
 * @description Alias de tipo para unidades de masa.
 */
export type MassUnit = typeof MASS_UNITS[number]

/**
 * @description Alias de tipo para unidades de volumen.
 */
export type VolumeUnit = typeof VOLUME_UNITS[number]

/**
 * @description Alias de tipo para cualquier unidad conocida por el convertidor.
 */
export type KnownUnit = MassUnit | VolumeUnit

const MASS_TO_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
  lb: 453.592,
  oz: 28.3495,
}

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  'fl oz': 29.5735,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 240,
}

/**
 * @description Normaliza simbolos para aplicar conversiones de forma consistente.
 * @param {string | null | undefined} simbolo - Simbolo de unidad ingresado por el usuario.
 * @returns {string} Simbolo normalizado en minuscula y sin espacios extra.
 */
function normalizeSymbol(simbolo: string | null | undefined): string {
  if (!simbolo) {
    return ''
  }

  return simbolo.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * @description Formatea cantidades removiendo decimales innecesarios.
 * @param {number} cantidad - Cantidad a mostrar.
 * @returns {string} Cantidad como string con precision legible.
 */
function formatCantidad(cantidad: number): string {
  if (Number.isInteger(cantidad)) {
    return String(cantidad)
  }

  return parseFloat(cantidad.toFixed(3)).toString()
}

/**
 * @description Convierte una cantidad a unidad base (gramos o mililitros).
 * @param {number} cantidad - Cantidad original.
 * @param {string | null | undefined} simbolo - Simbolo de unidad origen.
 * @returns {number} Cantidad convertida a unidad base o la misma cantidad si no aplica conversion.
 */
export function convertToBase(cantidad: number, simbolo: string | null | undefined): number {
  const normalized = normalizeSymbol(simbolo)

  if (!normalized || normalized === 'unidad' || normalized === 'pieza') {
    return cantidad
  }

  const massFactor = MASS_TO_GRAMS[normalized]
  if (massFactor) {
    return cantidad * massFactor
  }

  const volumeFactor = VOLUME_TO_ML[normalized]
  if (volumeFactor) {
    return cantidad * volumeFactor
  }

  return cantidad
}

/**
 * @description Convierte desde unidad base a una unidad destino cuando es conocida.
 * @param {number} cantidad - Cantidad en unidad base.
 * @param {string | null | undefined} simbolo - Simbolo de unidad destino.
 * @returns {number} Cantidad convertida a la unidad destino o pass-through si no aplica.
 */
export function convertFromBase(cantidad: number, simbolo: string | null | undefined): number {
  const normalized = normalizeSymbol(simbolo)

  if (!normalized || normalized === 'unidad' || normalized === 'pieza') {
    return cantidad
  }

  const massFactor = MASS_TO_GRAMS[normalized]
  if (massFactor) {
    return cantidad / massFactor
  }

  const volumeFactor = VOLUME_TO_ML[normalized]
  if (volumeFactor) {
    return cantidad / volumeFactor
  }

  return cantidad
}

/**
 * @description Construye la descripcion de un ingrediente en formato legible.
 * @param {number} cantidad - Cantidad del ingrediente.
 * @param {string | null | undefined} simbolo - Simbolo de unidad a mostrar.
 * @param {string} nombre - Nombre del producto ingrediente.
 * @returns {string} Texto descriptivo, por ejemplo: "2 lb Arroz".
 */
export function formatIngrediente(
  cantidad: number,
  simbolo: string | null | undefined,
  nombre: string
): string {
  const cantidadFormateada = formatCantidad(cantidad)
  const unidad = simbolo?.trim()

  if (!unidad) {
    return `${cantidadFormateada} ${nombre}`
  }

  return `${cantidadFormateada} ${unidad} ${nombre}`
}

/**
 * @description Formatea una lista de ingredientes para mostrarla en tabla de recetas.
 * @param {Array<{ cantidad: number; unidadSimbolo?: string | null; Producto?: { nombre?: string }; producto?: { nombre?: string } }>} ingredientes - Ingredientes de receta.
 * @param {number} [maxVisible=3] - Maximo de ingredientes a mostrar antes de truncar.
 * @returns {string} Lista textual de ingredientes o mensaje por defecto si no hay elementos.
 */
export function formatIngredientesList(
  ingredientes: Array<{
    cantidad: number
    unidadSimbolo?: string | null
    Producto?: { nombre?: string | null } | null
    producto?: { nombre?: string | null } | null
  }>,
  maxVisible = 3
): string {
  if (!ingredientes || ingredientes.length === 0) {
    return 'Sin ingredientes'
  }

  const visible = ingredientes.slice(0, maxVisible)
  const baseText = visible
    .map((ing) => {
      const nombre = ing.Producto?.nombre || ing.producto?.nombre || 'Ingrediente'
      return formatIngrediente(ing.cantidad, ing.unidadSimbolo, nombre)
    })
    .join(', ')

  if (ingredientes.length <= maxVisible) {
    return baseText
  }

  return `${baseText} ... +${ingredientes.length - maxVisible} mas`
}
