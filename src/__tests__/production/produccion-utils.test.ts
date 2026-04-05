import { describe, it, expect } from 'vitest'
import {
  calculateCostoUnitarioReceta,
  filterProductos,
  ProductoAgregado,
  ProductoInventario,
} from '@/lib/utils/produccion'

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
