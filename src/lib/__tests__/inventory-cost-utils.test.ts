import { describe, expect, it } from 'vitest'

import { calcularPrecioCostoCompra } from '@/lib/inventory-cost-utils'

describe('inventory-cost-utils', () => {
  it('usa costo unitario cuando es primera compra', () => {
    const result = calcularPrecioCostoCompra({
      stockAntes: 0,
      precioCostoActual: 0,
      cantidadCompra: 10,
      costoUnitario: 120
    })

    expect(result.metodoCosto).toBe('PRIMERA_COMPRA')
    expect(result.precioCostoNuevo).toBe(120)
  })

  it('calcula costo promedio ponderado para compras sucesivas', () => {
    const result = calcularPrecioCostoCompra({
      stockAntes: 10,
      precioCostoActual: 100,
      cantidadCompra: 3,
      costoUnitario: 120
    })

    expect(result.metodoCosto).toBe('PONDERADO')
    expect(result.precioCostoNuevo).toBeCloseTo(104.61538461538461)
  })

  it('lanza error con cantidad inválida', () => {
    expect(() =>
      calcularPrecioCostoCompra({
        stockAntes: 10,
        precioCostoActual: 100,
        cantidadCompra: 0,
        costoUnitario: 120
      })
    ).toThrow('INVALID_CANTIDAD_COMPRA')
  })
})
