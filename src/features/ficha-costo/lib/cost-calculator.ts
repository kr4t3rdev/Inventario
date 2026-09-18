/**
 * @description Funciones puras de cálculo para la ficha de costo.
 *
 *   Ninguna de estas funciones depende de Prisma, del sistema de archivos ni
 *   del contexto del servidor. Toda la entrada llega ya normalizada y
 *   consultada por las Server Actions; los helpers de este módulo solo
 *   combinan números siguiendo fórmulas explícitas.
 *
 *   Esto permite testearlas en aislamiento y reutilizarlas en otros flujos
 *   (reportes, exports, etc.) sin arrastrar dependencias del servidor.
 */

export interface CompraInput {
  /** Cantidad comprada del producto en la línea. */
  cantidad: number
  /** Precio unitario de la línea, ya normalizado a la moneda base. */
  precioUnitario: number
  /** Gasto proporcional asignado a esta línea (parte del gastoCompra). */
  gastoProporcional: number
}

export interface IngredienteInput {
  productoId: string
  /** Cantidad del ingrediente por unidad de receta. */
  cantidad: number
  /** Desperdicio esperado en porcentaje (0-100). */
  desperdicio: number
  /** Costo promedio ponderado del ingrediente; null si no se pudo calcular. */
  cppIngrediente: number | null
}

export interface CostoMaterialesResult {
  /** Suma efectiva del costo de materiales. */
  total: number
  /** Cantidad de ingredientes excluidos por no tener CPP. */
  ingredientesSinCosto: number
}

export type EstadoMargen = 'SALUDABLE' | 'BAJO' | 'PERDIDA' | 'SIN_PRECIO' | 'SIN_DATOS'

export interface MargenResult {
  /** Margen absoluto = precioVenta - costo. Null si no se puede calcular. */
  absoluto: number | null
  /** Margen porcentual. Null si precioVenta es 0. */
  porcentaje: number | null
  estado: EstadoMargen
}

export type EstadoVariacion = 'OK' | 'MAYOR' | 'MENOR' | 'SIN_DATOS'

export interface VariacionResult {
  /** Variación absoluta = costoReal - costoEstandar. Null si no se puede calcular. */
  absoluto: number | null
  /** Variación porcentual. Null si costoEstandar es 0 o null. */
  porcentaje: number | null
  estado: EstadoVariacion
}

export interface TasaCambioLookup {
  /**
   * @description Devuelve la tasa vigente para convertir de `monedaOrigen` a
   *   `monedaDestino` en o antes de la fecha indicada, junto con la fecha
   *   real de la tasa usada. Si no hay tasa, retorna null.
   */
  (fecha: Date, monedaOrigen: string, monedaDestino: string): {
    tasa: number
    fechaTasa: Date
  } | null
}

export interface NormalizarMonedaResult {
  /** Monto ya convertido a la moneda destino. */
  valor: number | null
  /** Tasa aplicada (si hubo conversión real). */
  tasaUsada?: number
  /** Fecha efectiva de la tasa (ISO). */
  fechaTasa?: string
  /** Mensaje si la tasa fue aproximada o no se encontró. */
  nota?: 'TASA_APROXIMADA' | 'SIN_TASA' | null
}

/**
 * @description Normaliza un monto a la moneda destino. Si la moneda origen
 *   es la misma que la destino, retorna el mismo valor. La conversión es
 *   un cálculo puro: la búsqueda de la tasa se inyecta vía callback para
 *   que esta función sea testeable sin servidor.
 *
 *   El callback de lookup se llama con la fecha del documento; si la fecha
 *   no tiene tasa exacta, el caller puede implementar la estrategia de
 *   fallback (tasa más cercana) y devolverla con `fechaTasa` diferente.
 */
export function normalizarMoneda(
  monto: number,
  monedaOrigen: string,
  monedaDestino: string,
  lookup: TasaCambioLookup,
  fecha: Date = new Date(),
): NormalizarMonedaResult {
  if (!Number.isFinite(monto)) return { valor: null, nota: 'SIN_TASA' }
  if (monedaOrigen === monedaDestino) {
    return { valor: monto }
  }
  const resultado = lookup(fecha, monedaOrigen, monedaDestino)
  if (!resultado) {
    return { valor: null, nota: 'SIN_TASA' }
  }
  const fechaDoc = fecha.getTime()
  const fechaTasa = resultado.fechaTasa.getTime()
  const diasDiferencia = Math.abs(fechaDoc - fechaTasa) / (1000 * 60 * 60 * 24)
  return {
    valor: monto * resultado.tasa,
    tasaUsada: resultado.tasa,
    fechaTasa: resultado.fechaTasa.toISOString(),
    nota: diasDiferencia > 1 ? 'TASA_APROXIMADA' : null,
  }
}

/**
 * @description Costo Promedio Ponderado a partir de líneas de compra ya
 *   normalizadas a la moneda base. Devuelve 0 si la lista está vacía o si
 *   las cantidades suman 0 (evita división por cero).
 *
 *   Fórmula: CPP = Σ(cantidad × precioUnitario + gastoProporcional) / Σ(cantidad)
 */
export function calcularCPP(compras: CompraInput[]): number {
  if (compras.length === 0) return 0

  let cantidadTotal = 0
  let valorTotal = 0

  for (const compra of compras) {
    if (!Number.isFinite(compra.cantidad) || !Number.isFinite(compra.precioUnitario)) {
      continue
    }
    if (compra.cantidad <= 0) continue
    cantidadTotal += compra.cantidad
    valorTotal += compra.cantidad * compra.precioUnitario + (compra.gastoProporcional ?? 0)
  }

  if (cantidadTotal === 0) return 0
  return valorTotal / cantidadTotal
}

/**
 * @description Costo de materiales de un producto compuesto a partir de su
 *   receta. Aplica desperdicio como porcentaje sobre la cantidad efectiva
 *   y excluye cualquier ingrediente sin CPP (se reportan en el contador).
 */
export function calcularCostoMateriales(
  ingredientes: IngredienteInput[],
): CostoMaterialesResult {
  let total = 0
  let sinCosto = 0

  for (const ingrediente of ingredientes) {
    if (ingrediente.cppIngrediente === null || ingrediente.cppIngrediente <= 0) {
      sinCosto += 1
      continue
    }
    const factorDesperdicio = 1 + (Number(ingrediente.desperdicio) || 0) / 100
    const cantidadEfectiva = ingrediente.cantidad * factorDesperdicio
    total += cantidadEfectiva * ingrediente.cppIngrediente
  }

  return { total, ingredientesSinCosto: sinCosto }
}

/**
 * @description Margen bruto entre el costo calculado y el precio de venta.
 *   Estado:
 *     - SALUDABLE: margen >= 10%
 *     - BAJO: margen entre 0% y 10% exclusivo
 *     - PERDIDA: margen < 0%
 *     - SIN_PRECIO: precioVenta es 0
 */
export function calcularMargen(costo: number, precioVenta: number): MargenResult {
  if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
    return { absoluto: null, porcentaje: null, estado: 'SIN_PRECIO' }
  }
  if (!Number.isFinite(costo) || costo < 0) {
    return { absoluto: null, porcentaje: null, estado: 'SIN_DATOS' }
  }
  const absoluto = precioVenta - costo
  const porcentaje = (absoluto / precioVenta) * 100
  let estado: EstadoMargen
  if (porcentaje < 0) estado = 'PERDIDA'
  else if (porcentaje < 10) estado = 'BAJO'
  else estado = 'SALUDABLE'
  return { absoluto, porcentaje, estado }
}

/**
 * @description Variación entre el costo real (calculado) y el costo estándar
 *   (cargado manualmente como `Producto.precioCosto`).
 *   Estado:
 *     - OK: |variación| <= 5%
 *     - MAYOR: costo real > estándar en más del 5%
 *     - MENOR: costo real < estándar en más del 5%
 *     - SIN_DATOS: no hay costo estándar o real para comparar
 */
export function calcularVariacion(
  costoReal: number,
  costoEstandar: number | null | undefined,
): VariacionResult {
  if (costoEstandar === null || costoEstandar === undefined) {
    return { absoluto: null, porcentaje: null, estado: 'SIN_DATOS' }
  }
  if (!Number.isFinite(costoEstandar) || costoEstandar <= 0) {
    return { absoluto: null, porcentaje: null, estado: 'SIN_DATOS' }
  }
  if (!Number.isFinite(costoReal) || costoReal <= 0) {
    return { absoluto: null, porcentaje: null, estado: 'SIN_DATOS' }
  }
  const absoluto = costoReal - costoEstandar
  const porcentaje = (absoluto / costoEstandar) * 100
  let estado: EstadoVariacion
  if (porcentaje > 5) estado = 'MAYOR'
  else if (porcentaje < -5) estado = 'MENOR'
  else estado = 'OK'
  return { absoluto, porcentaje, estado }
}
