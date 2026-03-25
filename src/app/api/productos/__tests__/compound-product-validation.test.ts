import { describe, it, expect } from 'vitest'

// Validation functions extracted from the API logic
const validateCompoundProduct = (data: {
  esCompuesto?: boolean
  cantidadEnPack?: number
  nombreHijo?: string
  codigoNegocioHijo?: string
}): { valid: boolean; error?: string } => {
  if (data.esCompuesto === true) {
    if (!data.cantidadEnPack || data.cantidadEnPack <= 0) {
      return {
        valid: false,
        error: 'La cantidad en pack debe ser mayor a 0 para productos compuestos'
      }
    }

    if (!data.nombreHijo || data.nombreHijo.trim() === '') {
      return {
        valid: false,
        error: 'El nombre del producto hijo es requerido para productos compuestos'
      }
    }

    if (!data.codigoNegocioHijo || data.codigoNegocioHijo.trim() === '') {
      return {
        valid: false,
        error: 'El código de negocio del producto hijo es requerido para productos compuestos'
      }
    }
  }
  return { valid: true }
}

const calculateChildPrice = (precioVenta: number, cantidadEnPack: number): number => {
  return Math.round(precioVenta / cantidadEnPack)
}

const calculateChildCost = (precioCosto: number, cantidadEnPack: number): number => {
  return Math.round(precioCosto / cantidadEnPack)
}

describe('Product API Validation - Compound Products', () => {
  describe('validateCompoundProduct', () => {
    it('should accept regular product (esCompuesto not set)', () => {
      const data = {
        nombre: 'Regular Product',
        precioCosto: 100,
        precioVenta: 150
      }
      expect(validateCompoundProduct(data).valid).toBe(true)
    })

    it('should accept compound product with all required fields', () => {
      const data = {
        esCompuesto: true,
        cantidadEnPack: 20,
        nombreHijo: 'Cigarro (unidad)',
        codigoNegocioHijo: '1234567890128'
      }
      expect(validateCompoundProduct(data).valid).toBe(true)
    })

    it('should reject compound product with quantity = 0', () => {
      const data = {
        esCompuesto: true,
        cantidadEnPack: 0,
        nombreHijo: 'Cigarro (unidad)',
        codigoNegocioHijo: '1234567890128'
      }
      const result = validateCompoundProduct(data)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('mayor a 0')
    })

    it('should reject compound product with negative quantity', () => {
      const data = {
        esCompuesto: true,
        cantidadEnPack: -5,
        nombreHijo: 'Cigarro (unidad)',
        codigoNegocioHijo: '1234567890128'
      }
      const result = validateCompoundProduct(data)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('mayor a 0')
    })

    it('should reject compound product without nombreHijo', () => {
      const data = {
        esCompuesto: true,
        cantidadEnPack: 20,
        nombreHijo: '',
        codigoNegocioHijo: '1234567890128'
      }
      const result = validateCompoundProduct(data)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('nombre del producto hijo')
    })

    it('should reject compound product without codigoNegocioHijo', () => {
      const data = {
        esCompuesto: true,
        cantidadEnPack: 20,
        nombreHijo: 'Cigarro (unidad)',
        codigoNegocioHijo: ''
      }
      const result = validateCompoundProduct(data)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('código de negocio del producto hijo')
    })

    it('should reject compound product with quantity = undefined', () => {
      const data = {
        esCompuesto: true,
        cantidadEnPack: undefined,
        nombreHijo: 'Cigarro (unidad)',
        codigoNegocioHijo: '1234567890128'
      }
      const result = validateCompoundProduct(data)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('mayor a 0')
    })
  })

  describe('calculateChildPrice', () => {
    it('should calculate exact division', () => {
      // 500 / 20 = 25
      expect(calculateChildPrice(500, 20)).toBe(25)
    })

    it('should round up when result is decimal', () => {
      // 100 / 3 = 33.333... → rounds to 33
      expect(calculateChildPrice(100, 3)).toBe(33)
    })

    it('should handle price less than quantity', () => {
      // 10 / 20 = 0.5 → rounds to 1
      expect(calculateChildPrice(10, 20)).toBe(1)
    })

    it('should handle zero quantity edge case', () => {
      // When quantity is 0, result is Infinity - this should be handled by validation first
      expect(calculateChildPrice(100, 0)).toBe(Infinity)
    })
  })

  describe('calculateChildCost', () => {
    it('should calculate exact division for cost', () => {
      // 400 / 20 = 20
      expect(calculateChildCost(400, 20)).toBe(20)
    })

    it('should round for decimal cost', () => {
      // 100 / 3 = 33.333... → rounds to 33
      expect(calculateChildCost(100, 3)).toBe(33)
    })
  })

  describe('Price calculation edge cases', () => {
    it('should handle divisible price scenario (cigarette box)', () => {
      const precioCaja = 500
      const cantidad = 20
      const precioUnitario = calculateChildPrice(precioCaja, cantidad)
      
      expect(precioUnitario).toBe(25)
      expect(precioCaja % cantidad).toBe(0) // Exact division
    })

    it('should handle non-divisible price scenario with rounding', () => {
      const precioCaja = 100
      const cantidad = 3
      const precioUnitario = calculateChildPrice(precioCaja, cantidad)
      
      expect(precioUnitario).toBe(33) // Rounded down
      expect(precioCaja % cantidad).toBe(1) // Not exact
    })

    it('should handle beer case (24 units)', () => {
      const precioCaja = 240
      const cantidad = 24
      const precioUnitario = calculateChildPrice(precioCaja, cantidad)
      
      expect(precioUnitario).toBe(10)
      expect(precioCaja % cantidad).toBe(0)
    })
  })

  describe('API request body validation scenarios', () => {
    it('should handle typical compound product payload', () => {
      const payload = {
        nombre: 'Caja de Cigarrillos',
        precioCosto: 400,
        precioVenta: 500,
        stock: 10,
        categoriaId: 'cat-1',
        unidadId: 'unit-1',
        almacenId: 'almacen-1',
        esCompuesto: true,
        cantidadEnPack: 20,
        nombreHijo: 'Cigarro (unidad)',
        codigoNegocioHijo: '1234567890128'
      }

      const validation = validateCompoundProduct(payload)
      expect(validation.valid).toBe(true)

      const childPrice = calculateChildPrice(payload.precioVenta, payload.cantidadEnPack)
      expect(childPrice).toBe(25)
    })

    it('should handle compound product with non-divisible price', () => {
      const payload = {
        nombre: 'Pack de Cerveza',
        precioCosto: 90,
        precioVenta: 100,
        stock: 5,
        categoriaId: 'cat-1',
        unidadId: 'unit-1',
        almacenId: 'almacen-1',
        esCompuesto: true,
        cantidadEnPack: 6,
        nombreHijo: 'Cerveza (unidad)',
        codigoNegocioHijo: '9876543210987'
      }

      const validation = validateCompoundProduct(payload)
      expect(validation.valid).toBe(true)

      const childPrice = calculateChildPrice(payload.precioVenta, payload.cantidadEnPack)
      expect(childPrice).toBe(17) // 100/6 = 16.66... rounded
    })

    it('should reject invalid compound product payloads', () => {
      const invalidPayloads = [
        { esCompuesto: true, cantidadEnPack: 0, nombreHijo: 'Test', codigoNegocioHijo: '123' },
        { esCompuesto: true, cantidadEnPack: -1, nombreHijo: 'Test', codigoNegocioHijo: '123' },
        { esCompuesto: true, cantidadEnPack: 10, nombreHijo: '', codigoNegocioHijo: '123' },
        { esCompuesto: true, cantidadEnPack: 10, nombreHijo: 'Test', codigoNegocioHijo: '' },
        { esCompuesto: true, cantidadEnPack: undefined, nombreHijo: 'Test', codigoNegocioHijo: '123' }
      ]

      invalidPayloads.forEach(payload => {
        const validation = validateCompoundProduct(payload)
        expect(validation.valid).toBe(false)
      })
    })
  })
})
