import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  normalizeVendorCode,
  isValidVendorCode,
  generateVendorEan13,
  validateVendorCodeState,
} from '@/lib/vendor-code-utils'

describe('Vendor Code Utilities', () => {
  describe('normalizeVendorCode()', () => {
    it('should pad single digit to 2 digits', () => {
      expect(normalizeVendorCode(1)).toBe('01')
      expect(normalizeVendorCode(5)).toBe('05')
      expect(normalizeVendorCode(9)).toBe('09')
    })

    it('should keep 2-digit codes intact', () => {
      expect(normalizeVendorCode(10)).toBe('10')
      expect(normalizeVendorCode(50)).toBe('50')
      expect(normalizeVendorCode(99)).toBe('99')
    })

    it('should throw on numbers outside 1-99 range', () => {
      expect(() => normalizeVendorCode(0)).toThrow()
      expect(() => normalizeVendorCode(100)).toThrow()
      expect(() => normalizeVendorCode(-1)).toThrow()
      expect(() => normalizeVendorCode(200)).toThrow()
    })

    it('should throw on non-integer values', () => {
      expect(() => normalizeVendorCode(1.5)).toThrow()
      expect(() => normalizeVendorCode(NaN)).toThrow()
    })
  })

  describe('isValidVendorCode()', () => {
    it('should validate correct vendor codes', () => {
      expect(isValidVendorCode('01')).toBe(true)
      expect(isValidVendorCode('05')).toBe(true)
      expect(isValidVendorCode('99')).toBe(true)
    })

    it('should reject invalid formats', () => {
      expect(isValidVendorCode('0')).toBe(false) // Single digit
      expect(isValidVendorCode('001')).toBe(false) // 3 digits
      expect(isValidVendorCode('AB')).toBe(false) // Non-numeric
      expect(isValidVendorCode('0A')).toBe(false) // Mixed
      expect(isValidVendorCode('')).toBe(false) // Empty
    })

    it('should reject non-string types', () => {
      expect(isValidVendorCode(1)).toBe(false)
      expect(isValidVendorCode(null)).toBe(false)
      expect(isValidVendorCode(undefined)).toBe(false)
      expect(isValidVendorCode({})).toBe(false)
    })
  })

  describe('generateVendorEan13()', () => {
    it('should generate valid EAN13 for vendor code 01', () => {
      const ean = generateVendorEan13('01')
      // 01 + 0000000001 = 010000000001 (12 dígitos)
      // Check digit calculation: odd(0+0+0+0+0+0)=0, even(1+0+0+0+0+1)*3=6, total=6, dc=(10-6)%10=4
      // Final EAN13: 0100000000014
      expect(ean).toHaveLength(13)
      expect(/^\d{13}$/.test(ean)).toBe(true)
      expect(ean).toBe('0100000000014')
    })

    it('should generate valid EAN13 for vendor code 05', () => {
      const ean = generateVendorEan13('05')
      // 05 + 0000000001 = 050000000001 (12 dígitos)
      // Check digit calculation: odd(0+0+0+0+0+0)=0, even(5+0+0+0+0+1)*3=18, total=18, dc=(10-8)%10=2
      // Final EAN13: 0500000000012
      expect(ean).toHaveLength(13)
      expect(/^\d{13}$/.test(ean)).toBe(true)
      expect(ean).toBe('0500000000012')
    })

    it('should generate valid EAN13 for vendor code 99', () => {
      const ean = generateVendorEan13('99')
      expect(ean).toHaveLength(13)
      expect(/^\d{13}$/.test(ean)).toBe(true)
    })

    it('should throw on invalid vendor code', () => {
      expect(() => generateVendorEan13('0')).toThrow()
      expect(() => generateVendorEan13('001')).toThrow()
      expect(() => generateVendorEan13('AB')).toThrow()
      expect(() => generateVendorEan13('')).toThrow()
    })

    it('should have correct check digit structure', () => {
      const ean = generateVendorEan13('01')
      // DC should be last digit (position 12)
      expect(ean.length).toBe(13)
      // Verify DC is between 0-9
      expect(/^\d$/.test(ean[12])).toBe(true)
    })
  })

  describe('validateVendorCodeState()', () => {
    it('should validate vendor with code', () => {
      const result = validateVendorCodeState({ vendorCode: '05' })
      expect(result.isValid).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should reject vendor without code', () => {
      const result = validateVendorCodeState({ vendorCode: null })
      expect(result.isValid).toBe(false)
      expect(result.reason).toContain('sin código')
    })

    it('should reject vendor with undefined code', () => {
      const result = validateVendorCodeState({ vendorCode: undefined })
      expect(result.isValid).toBe(false)
    })

    it('should reject null vendor', () => {
      const result = validateVendorCodeState(null)
      expect(result.isValid).toBe(false)
      expect(result.reason).toContain('no encontrado')
    })

    it('should reject malformed code', () => {
      const result = validateVendorCodeState({ vendorCode: 'AB' })
      expect(result.isValid).toBe(false)
      expect(result.reason).toContain('malformado')
    })
  })
})
