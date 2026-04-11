import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mapCategoryToSection,
  mapSubcategoryToSpecific
} from '@/lib/category-mapping'

/**
 * Unit tests for CLAS mapping validation functions
 * These tests ensure that category and subcategory names are validated
 * against the CLAS (Clasificador) standards when EAN-13 mode is enabled
 */

describe('CLAS validation functions for category forms', () => {
  describe('mapCategoryToSection', () => {
    it('should accept valid root categories', () => {
      expect(() => mapCategoryToSection('CONFECCIONES')).not.toThrow()
      expect(() => mapCategoryToSection('ALIMENTOS')).not.toThrow()
    })

    it('should reject invalid root categories', () => {
      expect(() => mapCategoryToSection('InvalidCategory')).toThrow(
        /no encontrada/i
      )
      expect(() => mapCategoryToSection('RandomName')).toThrow(
        /no encontrada/i
      )
    })

    it('should be case-insensitive', () => {
      expect(() => mapCategoryToSection('confecciones')).not.toThrow()
      expect(() => mapCategoryToSection('CONFECCIONES')).not.toThrow()
      expect(() => mapCategoryToSection('ConFecciones')).not.toThrow()
    })

    it('should trim whitespace', () => {
      expect(() => mapCategoryToSection('  CONFECCIONES  ')).not.toThrow()
      expect(() => mapCategoryToSection('\tALIMENTOS\n')).not.toThrow()
    })

    it('should return correct section code for valid categories', () => {
      expect(mapCategoryToSection('CONFECCIONES')).toBe('30')
      expect(mapCategoryToSection('ALIMENTOS')).toBe('21')
    })
  })

  describe('mapSubcategoryToSpecific', () => {
    it('should accept valid subcategories', () => {
      expect(() =>
        mapSubcategoryToSpecific('PANTALONES DE VESTIR (HOMBRE)')
      ).not.toThrow()
      expect(() => mapSubcategoryToSpecific('CAMISAS CON MANGAS CORTAS (HOMBRE)')).not.toThrow()
    })

    it('should reject invalid subcategories', () => {
      expect(() => mapSubcategoryToSpecific('InvalidSubcategory')).toThrow(
        /no encontrada/i
      )
      expect(() => mapSubcategoryToSpecific('CAMISAS')).toThrow(
        /no encontrada/i
      )
    })

    it('should be case-insensitive', () => {
      expect(() =>
        mapSubcategoryToSpecific('pantalones de vestir (hombre)')
      ).not.toThrow()
      expect(() =>
        mapSubcategoryToSpecific('PANTALONES DE VESTIR (HOMBRE)')
      ).not.toThrow()
      expect(() =>
        mapSubcategoryToSpecific('Pantalones De Vestir (Hombre)')
      ).not.toThrow()
    })

    it('should trim whitespace', () => {
      expect(() =>
        mapSubcategoryToSpecific('  PANTALONES DE VESTIR (HOMBRE)  ')
      ).not.toThrow()
      expect(() => mapSubcategoryToSpecific('  CAMISAS CON MANGAS CORTAS (HOMBRE)\n')).not.toThrow()
    })

    it('should return correct specific code for valid subcategories', () => {
      expect(mapSubcategoryToSpecific('PANTALONES DE VESTIR (HOMBRE)')).toBe(
        '1448'
      )
      expect(mapSubcategoryToSpecific('CAMISAS CON MANGAS CORTAS (HOMBRE)')).toBe('1451')
    })
  })

  /**
   * Integration test demonstrating form validation logic
   * This simulates what the useCategoryForm hook should do
   */
  describe('Form validation integration', () => {
    function validateForCLAS(
      nombre: string,
      parentId: string | null,
      usaEan13: boolean
    ): {
      isValid: boolean
      errorMessage?: string
    } {
      // Skip validation if EAN-13 is disabled
      if (!usaEan13) {
        return { isValid: true }
      }

      try {
        if (!parentId) {
          // Root category validation
          mapCategoryToSection(nombre)
        } else {
          // Subcategory validation
          mapSubcategoryToSpecific(nombre)
        }
        return { isValid: true }
      } catch (error) {
        const isRootCategory = !parentId
        const errorMessage = isRootCategory
          ? 'Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador'
          : 'Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador'
        return {
          isValid: false,
          errorMessage
        }
      }
    }

    it('should reject invalid root category when EAN-13 is enabled', () => {
      const result = validateForCLAS('InvalidCategory', null, true)
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe(
        'Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador'
      )
    })

    it('should accept valid root category when EAN-13 is enabled', () => {
      const result = validateForCLAS('CONFECCIONES', null, true)
      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBeUndefined()
    })

    it('should reject invalid subcategory when EAN-13 is enabled', () => {
      const result = validateForCLAS('InvalidSubcategory', 'parent-123', true)
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe(
        'Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador'
      )
    })

    it('should accept valid subcategory when EAN-13 is enabled', () => {
      const result = validateForCLAS(
        'CAMISAS CON MANGAS CORTAS (HOMBRE)',
        'parent-123',
        true
      )
      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBeUndefined()
    })

    it('should allow any name when EAN-13 is disabled', () => {
      const result1 = validateForCLAS('InvalidCategory', null, false)
      const result2 = validateForCLAS('RandomName', 'parent-123', false)
      expect(result1.isValid).toBe(true)
      expect(result2.isValid).toBe(true)
    })

    it('should be case-insensitive when EAN-13 is enabled', () => {
      const result1 = validateForCLAS('confecciones', null, true)
      const result2 = validateForCLAS('CONFECCIONES', null, true)
      const result3 = validateForCLAS('ConFecciones', null, true)
      expect(result1.isValid).toBe(true)
      expect(result2.isValid).toBe(true)
      expect(result3.isValid).toBe(true)
    })
  })
})
