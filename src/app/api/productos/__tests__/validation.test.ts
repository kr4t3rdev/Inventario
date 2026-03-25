import { describe, it, expect } from 'vitest'

// Validation function extracted from the API logic
const validateStockMinimo = (stockMinimo: any): { valid: boolean; error?: string } => {
  if (stockMinimo !== undefined && (typeof stockMinimo !== 'number' || stockMinimo < 0 || !Number.isInteger(stockMinimo))) {
    return {
      valid: false,
      error: 'El stock mínimo debe ser un número entero mayor o igual a 0'
    }
  }
  return { valid: true }
}

const validateCodigoInterno = (codigoInterno: any): { valid: boolean; error?: string } => {
  if (codigoInterno === undefined || codigoInterno === null || codigoInterno === '') {
    return { valid: true }
  }

  if (typeof codigoInterno !== 'string') {
    return {
      valid: false,
      error: 'El código interno debe enviarse como texto',
    }
  }

  if (!/^[0-9]{11}$/.test(codigoInterno)) {
    return {
      valid: false,
      error: 'El código interno debe contener exactamente 11 números',
    }
  }

  return { valid: true }
}

describe('Product API Validation - stockMinimo', () => {
  describe('validateStockMinimo', () => {
    it('should accept valid positive integers', () => {
      expect(validateStockMinimo(0)).toEqual({ valid: true })
      expect(validateStockMinimo(1)).toEqual({ valid: true })
      expect(validateStockMinimo(10)).toEqual({ valid: true })
      expect(validateStockMinimo(100)).toEqual({ valid: true })
    })

    it('should accept undefined (optional field)', () => {
      expect(validateStockMinimo(undefined)).toEqual({ valid: true })
    })

    it('should reject negative numbers', () => {
      const result = validateStockMinimo(-1)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('stock mínimo debe ser un número entero mayor o igual a 0')
    })

    it('should reject decimal numbers', () => {
      const result = validateStockMinimo(5.5)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('stock mínimo debe ser un número entero mayor o igual a 0')
    })

    it('should reject non-numeric values', () => {
      expect(validateStockMinimo('10').valid).toBe(false)
      expect(validateStockMinimo(null).valid).toBe(false)
      expect(validateStockMinimo(true).valid).toBe(false)
      expect(validateStockMinimo({}).valid).toBe(false)
      expect(validateStockMinimo([]).valid).toBe(false)
    })

    it('should reject NaN and Infinity', () => {
      expect(validateStockMinimo(NaN).valid).toBe(false)
      expect(validateStockMinimo(Infinity).valid).toBe(false)
      expect(validateStockMinimo(-Infinity).valid).toBe(false)
    })
  })

  describe('validateCodigoInterno', () => {
    it('should accept undefined, null or empty values (optional field)', () => {
      expect(validateCodigoInterno(undefined)).toEqual({ valid: true })
      expect(validateCodigoInterno(null)).toEqual({ valid: true })
      expect(validateCodigoInterno('')).toEqual({ valid: true })
    })

    it('should accept exactly 11 digits', () => {
      expect(validateCodigoInterno('12345678901')).toEqual({ valid: true })
      expect(validateCodigoInterno('00000000000')).toEqual({ valid: true })
    })

    it('should reject non-string values', () => {
      expect(validateCodigoInterno(12345678901).valid).toBe(false)
      expect(validateCodigoInterno(true).valid).toBe(false)
      expect(validateCodigoInterno({}).valid).toBe(false)
    })

    it('should reject invalid lengths', () => {
      expect(validateCodigoInterno('1234567890').valid).toBe(false)
      expect(validateCodigoInterno('123456789012').valid).toBe(false)
    })

    it('should reject non-numeric characters', () => {
      expect(validateCodigoInterno('ABCDEFGHIJK').valid).toBe(false)
      expect(validateCodigoInterno('12345-78901').valid).toBe(false)
    })
  })

  describe('API request body validation scenarios', () => {
    it('should handle typical product creation payload', () => {
      const payload = {
        nombre: 'Test Product',
        descripcion: 'Test description',
        precioCosto: 100,
        precioVenta: 150,
        stock: 50,
        stockMinimo: 10,
        categoriaId: 'cat-1',
        unidadId: 'unit-1',
        vendorId: 'vendor-1',
        almacenId: 'almacen-1'
      }

      const validation = validateStockMinimo(payload.stockMinimo)
      expect(validation.valid).toBe(true)
      expect(validateCodigoInterno('12345678901').valid).toBe(true)
    })

    it('should handle product creation without stockMinimo', () => {
      const payload = {
        nombre: 'Test Product',
        descripcion: 'Test description',
        precioCosto: 100,
        precioVenta: 150,
        stock: 50,
        // stockMinimo not provided
        categoriaId: 'cat-1',
        unidadId: 'unit-1',
        vendorId: 'vendor-1',
        almacenId: 'almacen-1'
      }

      const validation = validateStockMinimo(payload.stockMinimo)
      expect(validation.valid).toBe(true)
      expect(validateCodigoInterno(payload.codigoInterno).valid).toBe(true)
    })

    it('should handle product update with only stockMinimo', () => {
      const payload = {
        stockMinimo: 15,
        codigoInterno: '12345678901',
      }

      const validation = validateStockMinimo(payload.stockMinimo)
      expect(validation.valid).toBe(true)
      expect(validateCodigoInterno(payload.codigoInterno).valid).toBe(true)
    })

    it('should reject malformed requests', () => {
      const invalidPayloads = [
        { stockMinimo: -5, codigoInterno: '12345678901' },
        { stockMinimo: 3.14, codigoInterno: '12345678901' },
        { stockMinimo: '10', codigoInterno: '12345678901' },
        { stockMinimo: null, codigoInterno: '12345678901' },
        { stockMinimo: true, codigoInterno: '12345678901' },
        { stockMinimo: 10, codigoInterno: '1234' },
        { stockMinimo: 10, codigoInterno: 'ABCDEFGHIJK' }
      ]

      invalidPayloads.forEach(payload => {
        const validation = validateStockMinimo(payload.stockMinimo)
        const codigoValidation = validateCodigoInterno(payload.codigoInterno)

        expect(validation.valid && codigoValidation.valid).toBe(false)
      })
    })
  })
})
