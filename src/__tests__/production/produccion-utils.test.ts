import * as fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import {
  calculateCostoUnitarioReceta,
  filterProductos,
  ProductoAgregado,
  ProductoInventario,
} from '@/lib/utils/produccion'

const moneyArbitrary = fc.double({
  min: 0,
  max: 10_000,
  noNaN: true,
  noDefaultInfinity: true,
})

const quantityArbitrary = fc.double({
  min: 0,
  max: 500,
  noNaN: true,
  noDefaultInfinity: true,
})

const rendimientoArbitrary = fc.integer({ min: 1, max: 250 })

const productoAgregadoArbitrary = fc.record({
  productoId: fc.uuid(),
  cantidad: quantityArbitrary,
  producto: fc.record({
    id: fc.uuid(),
    nombre: fc.string({ minLength: 1, maxLength: 30 }),
    precioCosto: moneyArbitrary,
  }),
}) satisfies fc.Arbitrary<ProductoAgregado>

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

describe('calculateCostoUnitarioReceta', () => {
  it('calcula correctamente con un producto agregado', () => {
    const productosAgregados: ProductoAgregado[] = [
      {
        productoId: 'prod1',
        cantidad: 2,
        producto: { id: 'prod1', nombre: 'Harina', precioCosto: 100 },
      },
    ]

    const resultado = calculateCostoUnitarioReceta(50, productosAgregados, 1)
    // (50 + (2 * 100)) / 1 = 250
    expect(resultado).toBe(250)
  })

  it('divide por rendimiento correctamente', () => {
    const productosAgregados: ProductoAgregado[] = [
      {
        productoId: 'prod1',
        cantidad: 3,
        producto: { id: 'prod1', nombre: 'Azúcar', precioCosto: 50 },
      },
    ]

    const resultado = calculateCostoUnitarioReceta(100, productosAgregados, 2)
    // (100 + (3 * 50)) / 2 = 250 / 2 = 125
    expect(resultado).toBe(125)
  })

  it('maneja múltiples productos agregados', () => {
    const productosAgregados: ProductoAgregado[] = [
      {
        productoId: 'prod1',
        cantidad: 1,
        producto: { id: 'prod1', nombre: 'Harina', precioCosto: 100 },
      },
      {
        productoId: 'prod2',
        cantidad: 2,
        producto: { id: 'prod2', nombre: 'Azúcar', precioCosto: 50 },
      },
      {
        productoId: 'prod3',
        cantidad: 0.5,
        producto: { id: 'prod3', nombre: 'Sal', precioCosto: 20 },
      },
    ]

    const resultado = calculateCostoUnitarioReceta(30, productosAgregados, 1)
    // (30 + (1 * 100) + (2 * 50) + (0.5 * 20)) / 1 = 30 + 100 + 100 + 10 = 240
    expect(resultado).toBe(240)
  })

  it('redondea a 2 decimales', () => {
    const productosAgregados: ProductoAgregado[] = [
      {
        productoId: 'prod1',
        cantidad: 1,
        producto: { id: 'prod1', nombre: 'Producto', precioCosto: 100 },
      },
    ]

    const resultado = calculateCostoUnitarioReceta(10, productosAgregados, 3)
    // (10 + 100) / 3 = 110 / 3 = 36.6666... -> 36.67
    expect(resultado).toBe(36.67)
  })

  it('maneja costo de producto final 0', () => {
    const productosAgregados: ProductoAgregado[] = [
      {
        productoId: 'prod1',
        cantidad: 1,
        producto: { id: 'prod1', nombre: 'Producto', precioCosto: 100 },
      },
    ]

    const resultado = calculateCostoUnitarioReceta(0, productosAgregados, 1)
    // (0 + 100) / 1 = 100
    expect(resultado).toBe(100)
  })

  it('maneja array vacío de productos', () => {
    const resultado = calculateCostoUnitarioReceta(200, [], 1)
    // (200 + 0) / 1 = 200
    expect(resultado).toBe(200)
  })

  it('lanza error si rendimiento es 0', () => {
    expect(() => {
      calculateCostoUnitarioReceta(100, [], 0)
    }).toThrow('El rendimiento debe ser mayor a 0')
  })

  it('lanza error si rendimiento es negativo', () => {
    expect(() => {
      calculateCostoUnitarioReceta(100, [], -1)
    }).toThrow('El rendimiento debe ser mayor a 0')
  })

  it('ignora producto agregado sin precio de costo', () => {
    const productosAgregados: ProductoAgregado[] = [
      {
        productoId: 'prod1',
        cantidad: 1,
        producto: { id: 'prod1', nombre: 'Producto', precioCosto: 0 },
      },
    ]

    const resultado = calculateCostoUnitarioReceta(50, productosAgregados, 1)
    // (50 + 0) / 1 = 50
    expect(resultado).toBe(50)
  })

  it('respeta la fórmula exacta para cualquier combinación válida', () => {
    fc.assert(
      fc.property(
        moneyArbitrary,
        fc.array(productoAgregadoArbitrary, { maxLength: 12 }),
        rendimientoArbitrary,
        (precioCostoProductoFinal, productosAgregados, rendimiento) => {
          const expected = roundToTwoDecimals(
            (
              precioCostoProductoFinal +
              productosAgregados.reduce(
                (total, producto) => total + producto.cantidad * (producto.producto?.precioCosto ?? 0),
                0
              )
            ) / rendimiento
          )

          expect(
            calculateCostoUnitarioReceta(
              precioCostoProductoFinal,
              productosAgregados,
              rendimiento
            )
          ).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('es invariante al orden de los productos agregados', () => {
    fc.assert(
      fc.property(
        moneyArbitrary,
        fc.array(productoAgregadoArbitrary, { maxLength: 12 }),
        rendimientoArbitrary,
        (precioCostoProductoFinal, productosAgregados, rendimiento) => {
          const original = calculateCostoUnitarioReceta(
            precioCostoProductoFinal,
            productosAgregados,
            rendimiento
          )

          const reversed = calculateCostoUnitarioReceta(
            precioCostoProductoFinal,
            [...productosAgregados].reverse(),
            rendimiento
          )

          expect(reversed).toBe(original)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no disminuye si aumenta el costo del producto final', () => {
    fc.assert(
      fc.property(
        moneyArbitrary,
        moneyArbitrary,
        fc.array(productoAgregadoArbitrary, { maxLength: 12 }),
        rendimientoArbitrary,
        (precioBase, incremento, productosAgregados, rendimiento) => {
          const costoBase = calculateCostoUnitarioReceta(
            precioBase,
            productosAgregados,
            rendimiento
          )

          const costoIncrementado = calculateCostoUnitarioReceta(
            precioBase + incremento,
            productosAgregados,
            rendimiento
          )

          expect(costoIncrementado).toBeGreaterThanOrEqual(costoBase)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('filterProductos', () => {
  const productos: ProductoInventario[] = [
    { id: 'p1', nombre: 'Harina de Trigo', precioCosto: 100, stock: 50 },
    { id: 'p2', nombre: 'Azúcar Blanca', precioCosto: 50, stock: 100 },
    { id: 'p3', nombre: 'Sal de Mar', precioCosto: 20, stock: 200 },
    { id: 'p4', nombre: 'Aceite de Oliva', precioCosto: 300, stock: 30 },
    { id: 'p5', nombre: 'Leche Fresca', precioCosto: 80, stock: 150 },
  ]

  it('retorna todos los productos si la búsqueda está vacía', () => {
    const resultado = filterProductos('', productos)
    expect(resultado).toHaveLength(5)
    expect(resultado).toEqual(productos)
  })

  it('filtra por búsqueda case-insensitive', () => {
    const resultado = filterProductos('harina', productos)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].nombre).toBe('Harina de Trigo')
  })

  it('filtra por búsqueda en mayúsculas', () => {
    const resultado = filterProductos('AZÚCAR', productos)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].nombre).toBe('Azúcar Blanca')
  })

  it('filtra por búsqueda parcial', () => {
    const resultado = filterProductos('de', productos)
    // "Harina de Trigo", "Sal de Mar", "Aceite de Oliva"
    expect(resultado).toHaveLength(3)
  })

  it('retorna array vacío si no hay coincidencias', () => {
    const resultado = filterProductos('cemento', productos)
    expect(resultado).toHaveLength(0)
    expect(resultado).toEqual([])
  })

  it('ignora espacios en blanco al inicio y final', () => {
    const resultado = filterProductos('  sal  ', productos)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].nombre).toBe('Sal de Mar')
  })

  it('filtra por una sola letra', () => {
    const resultado = filterProductos('a', productos)
    // "Harina de Trigo", "Azúcar Blanca", "Sal de Mar", "Aceite de Oliva", "Leche Fresca"
    expect(resultado).toHaveLength(5)
  })

  it('es sensible a coincidencias en cualquier parte del nombre', () => {
    const resultado = filterProductos('oliva', productos)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].nombre).toBe('Aceite de Oliva')
  })

  it('retorna todos los productos si la búsqueda es solo espacios', () => {
    const resultado = filterProductos('   ', productos)
    expect(resultado).toHaveLength(5)
  })
})
