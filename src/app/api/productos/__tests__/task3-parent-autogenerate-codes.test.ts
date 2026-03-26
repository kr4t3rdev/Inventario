/**
 * @description Test for Task 3: Auto-generate parent product codes
 * Tests that parent product codes are auto-generated from category/subcategory mappings
 */

import { describe, it, expect } from 'vitest'
import { mapCategoryToSection, mapSubcategoryToSpecific } from '@/lib/category-mapping'
import { AssembleEan13Code, FindNextAvailableSurtido, ValidateAssembledCode } from '@/lib/ean13-utils'

describe('Task 3: Parent Product Auto-Code Generation', () => {
  describe('Category → Section mapping', () => {
    it('should map "Bebidas" category to section "14"', () => {
      const section = mapCategoryToSection('Bebidas')
      expect(section).toBe('14')
    })

    it('should map "Frutas" category to section "16"', () => {
      const section = mapCategoryToSection('Frutas')
      expect(section).toBe('16')
    })

    it('should throw for unmapped category', () => {
      expect(() => {
        mapCategoryToSection('NONEXISTENT')
      }).toThrow(/no encontrada en mapeo de secciones/)
    })

    it('should be case-insensitive', () => {
      const section1 = mapCategoryToSection('bebidas')
      const section2 = mapCategoryToSection('BEBIDAS')
      expect(section1).toBe(section2)
      expect(section1).toBe('14')
    })

    it('should trim whitespace', () => {
      const section = mapCategoryToSection('  Bebidas  ')
      expect(section).toBe('14')
    })
  })

  describe('Subcategory → Specific mapping', () => {
    it('should map "Bebidas_Alcoholicas" to specific "0285"', () => {
      const specific = mapSubcategoryToSpecific('Bebidas_Alcoholicas')
      expect(specific).toBe('0285')
    })

    it('should map "Cerveza" to specific "0281"', () => {
      const specific = mapSubcategoryToSpecific('Cerveza')
      expect(specific).toBe('0281')
    })

    it('should map "Fresas" to specific "0505"', () => {
      const specific = mapSubcategoryToSpecific('Fresas')
      expect(specific).toBe('0505')
    })

    it('should throw for unmapped subcategory', () => {
      expect(() => {
        mapSubcategoryToSpecific('NONEXISTENT')
      }).toThrow(/no encontrada en mapeo de específicos/)
    })

    it('should be case-insensitive', () => {
      const specific1 = mapSubcategoryToSpecific('bebidas_alcoholicas')
      const specific2 = mapSubcategoryToSpecific('BEBIDAS_ALCOHOLICAS')
      expect(specific1).toBe(specific2)
      expect(specific1).toBe('0285')
    })

    it('should trim whitespace', () => {
      const specific = mapSubcategoryToSpecific('  Cerveza  ')
      expect(specific).toBe('0281')
    })
  })

  describe('EAN-13 Code Assembly', () => {
    it('should assemble 13-digit code from provider + section + specific + surtido', () => {
      const code = AssembleEan13Code('01', '14', '0285', '0001')
      expect(code).toHaveLength(13)
      expect(code).toMatch(/^\d{13}$/) // All numeric
    })

    it('should pad segments with zeros if needed', () => {
      const code = AssembleEan13Code('1', '2', '3', '4')
      expect(code).toHaveLength(13)
      expect(code).toMatch(/^\d{13}$/)
    })

    it('should validate assembled code', () => {
      const code = AssembleEan13Code('01', '14', '0285', '0001')
      const isValid = ValidateAssembledCode(code)
      expect(isValid).toBe(true)
    })

    it('should have valid check digit (last digit)', () => {
      const code = AssembleEan13Code('01', '14', '0285', '0001')
      // Last digit should be a valid EAN-13 check digit
      expect(code).toMatch(/^\d{13}$/)
      expect(ValidateAssembledCode(code)).toBe(true)
    })
  })

  describe('Parent Code Generation Flow', () => {
    it('should generate unique codes for same section/specific with different surtido', () => {
      // Same provider, category, subcategory but different surtido
      const code1 = AssembleEan13Code('01', '14', '0285', '0001')
      const code2 = AssembleEan13Code('01', '14', '0285', '0002')
      
      expect(code1).not.toBe(code2)
      // Surtido is at positions 9-12 (based on EAN-13 structure)
      expect(code1).not.toEqual(code2)
    })

    it('should generate codes for multiple categories', () => {
      // Test data from different categories (using real mappings)
      const testCases = [
        { cat: 'Bebidas', subcat: 'Bebidas_Alcoholicas', expectedSec: '14', expectedSpec: '0285' },
        { cat: 'Frutas', subcat: 'Fresas', expectedSec: '16', expectedSpec: '0505' },
        { cat: 'Productos_Lacteos', subcat: 'Leche_Pasteurizada', expectedSec: '15', expectedSpec: '0301' },
      ]

      testCases.forEach(({ cat, subcat, expectedSec, expectedSpec }) => {
        const section = mapCategoryToSection(cat)
        const specific = mapSubcategoryToSpecific(subcat)
        
        expect(section).toBe(expectedSec)
        expect(specific).toBe(expectedSpec)
        
        const code = AssembleEan13Code('01', section, specific, '0001')
        expect(code).toHaveLength(13)
        expect(code).toMatch(/^\d{13}$/)
        expect(ValidateAssembledCode(code)).toBe(true)
      })
    })

    it('should generate codes with different provider codes', () => {
      const code1 = AssembleEan13Code('01', '14', '0285', '0001')
      const code2 = AssembleEan13Code('02', '14', '0285', '0001')
      
      expect(code1).not.toBe(code2)
      // First two digits should differ (provider)
      expect(code1.slice(0, 2)).not.toEqual(code2.slice(0, 2))
    })
  })

  describe('Error Cases - Invalid Mappings', () => {
    it('should throw if category not found', () => {
      expect(() => {
        mapCategoryToSection('INVALID_CATEGORY')
      }).toThrow()
    })

    it('should throw if subcategory not found', () => {
      expect(() => {
        mapSubcategoryToSpecific('INVALID_SUBCAT')
      }).toThrow()
    })

    it('should handle invalid assembled code validation', () => {
      const invalidCode = '000000000000' // 12 digits, not 13
      const isValid = ValidateAssembledCode(invalidCode)
      expect(isValid).toBe(false)
    })
  })

  describe('Parent Product Code Persistence', () => {
    it('should have all required segment fields after generation', () => {
      // Simulate a generated parent product
      const generatedProduct = {
        proveedorCodigo: '01',
        idSeccionCodigo: mapCategoryToSection('Bebidas'),
        especificoCodigo: mapSubcategoryToSpecific('Bebidas_Alcoholicas'),
        surtidoCodigo: '0001',
      }

      // Verify all fields exist and have values
      expect(generatedProduct).toHaveProperty('proveedorCodigo')
      expect(generatedProduct).toHaveProperty('idSeccionCodigo')
      expect(generatedProduct).toHaveProperty('especificoCodigo')
      expect(generatedProduct).toHaveProperty('surtidoCodigo')

      // All should have truthy values
      expect(generatedProduct.proveedorCodigo).toBeTruthy()
      expect(generatedProduct.idSeccionCodigo).toBeTruthy()
      expect(generatedProduct.especificoCodigo).toBeTruthy()
      expect(generatedProduct.surtidoCodigo).toBeTruthy()
    })

    it('should assemble correct code from generated segments', () => {
      const provider = '01'
      const section = mapCategoryToSection('Bebidas')
      const specific = mapSubcategoryToSpecific('Bebidas_Alcoholicas')
      const surtido = '0001'
      
      const code = AssembleEan13Code(provider, section, specific, surtido)
      
      // Code should be valid EAN-13
      expect(code).toHaveLength(13)
      expect(code).toMatch(/^\d{13}$/)
      expect(ValidateAssembledCode(code)).toBe(true)
    })
  })

  describe('Code Generation Determinism', () => {
    it('should generate same code for same input', () => {
      const code1 = AssembleEan13Code('01', '14', '0285', '0001')
      const code2 = AssembleEan13Code('01', '14', '0285', '0001')
      
      expect(code1).toBe(code2) // Deterministic
    })

    it('should generate different codes for different surtido', () => {
      const code1 = AssembleEan13Code('01', '14', '0285', '0001')
      const code2 = AssembleEan13Code('01', '14', '0285', '0002')
      const code3 = AssembleEan13Code('01', '14', '0285', '0003')
      
      // All should be different
      expect(new Set([code1, code2, code3]).size).toBe(3)
    })
  })
})
