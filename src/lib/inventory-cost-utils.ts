interface CalcularPrecioCostoCompraInput {
  stockAntes: number
  precioCostoActual: number
  cantidadCompra: number
  costoUnitario: number
}

type MetodoCostoCompra = 'PRIMERA_COMPRA' | 'PONDERADO'

interface CalcularPrecioCostoCompraResult {
  precioCostoNuevo: number
  metodoCosto: MetodoCostoCompra
}

/**
 * @description Calcula el nuevo precio de costo del producto al registrar una compra.
 * @param {CalcularPrecioCostoCompraInput} input - Datos de stock/costo previos y de la compra.
 * @returns {CalcularPrecioCostoCompraResult} Nuevo precio de costo y método aplicado.
 */
export function calcularPrecioCostoCompra(
  input: CalcularPrecioCostoCompraInput
): CalcularPrecioCostoCompraResult {
  const { stockAntes, precioCostoActual, cantidadCompra, costoUnitario } = input

  if (!Number.isFinite(cantidadCompra) || cantidadCompra <= 0) {
    throw new Error('INVALID_CANTIDAD_COMPRA')
  }

  if (!Number.isFinite(costoUnitario) || costoUnitario <= 0) {
    throw new Error('INVALID_COSTO_UNITARIO')
  }

  if (stockAntes <= 0) {
    return {
      precioCostoNuevo: costoUnitario,
      metodoCosto: 'PRIMERA_COMPRA'
    }
  }

  const valorInventarioAnterior = stockAntes * precioCostoActual
  const valorCompraNueva = cantidadCompra * costoUnitario
  const stockTotal = stockAntes + cantidadCompra

  if (!Number.isFinite(stockTotal) || stockTotal <= 0) {
    throw new Error('INVALID_STOCK_TOTAL')
  }

  const precioCostoNuevo = (valorInventarioAnterior + valorCompraNueva) / stockTotal
  if (!Number.isFinite(precioCostoNuevo) || precioCostoNuevo <= 0) {
    throw new Error('INVALID_PRECIO_COSTO_RESULT')
  }

  return {
    precioCostoNuevo,
    metodoCosto: 'PONDERADO'
  }
}
