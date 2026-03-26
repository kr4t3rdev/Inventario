import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  AssembleEan13Code,
  ValidateAssembledCode,
  calculateEan13CheckDigit,
} from './ean13-utils'

describe('EAN-13 Segment Generation Functions', () => {
  describe('AssembleEan13Code()', () => {
    it('should assemble a valid 13-digit EAN code', () => {
      const code = AssembleEan13Code('01', '14', '0285', '0001')
      expect(code).toHaveLength(13)
      expect(code).toMatch(/^\d{13}$/)
    })

    it('should assemble correct code from segments', () => {
      // Provider: 01, Section: 14, Specific: 0285, Surtido: 0001
      // Base12: 011402850001
      // DC: should be calculated
      const code = AssembleEan13Code('01', '14', '0285', '0001')
      
      // Verify structure: 01 + 14 + 0285 + 0001 + DC = 0114028500012
      expect(code).toBe('0114028500012')
    })

    it('should handle padding correctly', () => {
      // Input with minimal digits should pad correctly
      const code = AssembleEan13Code('1', '1', '1', '1')
      expect(code).toHaveLength(13)
      // Normalized: 01-01-0001-0001, Base12: 010100010001, DC: 8
      expect(code).toBe('0101000100018')
    })

    it('should handle max values', () => {
      const code = AssembleEan13Code('99', '99', '9999', '9999')
      expect(code).toHaveLength(13)
      expect(code).toMatch(/^\d{13}$/)
    })

    it('should throw on invalid provider code (non-numeric)', () => {
      expect(() => AssembleEan13Code('AB', '14', '0285', '0001')).toThrow()
    })

    it('should throw on invalid section code (non-numeric)', () => {
      expect(() => AssembleEan13Code('01', 'XY', '0285', '0001')).toThrow()
    })

    it('should throw on invalid specific code (non-numeric)', () => {
      expect(() => AssembleEan13Code('01', '14', 'ABCD', '0001')).toThrow()
    })

    it('should throw on invalid surtido code (non-numeric)', () => {
      expect(() => AssembleEan13Code('01', '14', '0285', 'WXYZ')).toThrow()
    })

    it('should throw on oversized provider code', () => {
      expect(() => AssembleEan13Code('999', '14', '0285', '0001')).toThrow()
    })

    it('should throw on oversized section code', () => {
      expect(() => AssembleEan13Code('01', '999', '0285', '0001')).toThrow()
    })

    it('should throw on oversized specific code', () => {
      expect(() => AssembleEan13Code('01', '14', '99999', '0001')).toThrow()
    })

    it('should throw on oversized surtido code', () => {
      expect(() => AssembleEan13Code('01', '14', '0285', '99999')).toThrow()
    })
  })

  describe('ValidateAssembledCode()', () => {
    it('should validate a correct EAN-13 code', () => {
      const code = '0114028500012'
      expect(ValidateAssembledCode(code)).toBe(true)
    })

    it('should reject a code with wrong length', () => {
      expect(ValidateAssembledCode('011402850001')).toBe(false) // Only 12 digits
      expect(ValidateAssembledCode('01140285000123')).toBe(false) // 14 digits
    })

    it('should reject a code with non-numeric characters', () => {
      expect(ValidateAssembledCode('011402850001A')).toBe(false)
      expect(ValidateAssembledCode('0114028500AB2')).toBe(false)
    })

    it('should reject a code with wrong check digit', () => {
      // Correct code is 0114028500012, but we provide wrong DC
      expect(ValidateAssembledCode('0114028500011')).toBe(false)
      expect(ValidateAssembledCode('0114028500013')).toBe(false)
    })

    it('should accept a valid code with leading zeros', () => {
      const code = '0000000000000' // All zeros — should have valid DC
      const validCode = AssembleEan13Code('00', '00', '0000', '0000')
      expect(ValidateAssembledCode(validCode)).toBe(true)
    })

    it('should accept max value code', () => {
      const code = AssembleEan13Code('99', '99', '9999', '9999')
      expect(ValidateAssembledCode(code)).toBe(true)
    })

    it('should handle null/undefined gracefully', () => {
      expect(ValidateAssembledCode(null as any)).toBe(false)
      expect(ValidateAssembledCode(undefined as any)).toBe(false)
      expect(ValidateAssembledCode('')).toBe(false)
    })
  })

  describe('Integration: AssembleEan13Code → ValidateAssembledCode', () => {
    it('should validate codes it generates', () => {
      const testCases = [
        { provider: '01', section: '14', specific: '0285', surtido: '0001' },
        { provider: '02', section: '15', specific: '0301', surtido: '0002' },
        { provider: '03', section: '16', specific: '0501', surtido: '0003' },
        { provider: '99', section: '99', specific: '9999', surtido: '9999' },
      ]

      testCases.forEach(tc => {
        const code = AssembleEan13Code(tc.provider, tc.section, tc.specific, tc.surtido)
        expect(ValidateAssembledCode(code)).toBe(true)
      })
    })

    it('should generate unique codes for different surtidos', () => {
      const codes = new Set()
      for (let i = 1; i <= 10; i++) {
        const surtido = String(i).padStart(4, '0')
        const code = AssembleEan13Code('01', '14', '0285', surtido)
        codes.add(code)
      }
      expect(codes.size).toBe(10) // All unique
    })
  })
})
