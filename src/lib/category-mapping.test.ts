import { describe, it, expect } from 'vitest'
import {
  CATEGORY_TO_SECTION,
  SUBCATEGORY_TO_SPECIFIC,
  mapCategoryToSection,
  mapSubcategoryToSpecific,
} from './category-mapping'

/**
 * @description Primera clave de un mapeo, conservando su tipo literal.
 *
 * `Object.keys()` devuelve `string[]`, que no es indexable contra los mapeos
 * importados desde JSON (claves literales). El helper acota ese punto unico;
 * el runtime es el mismo `Object.keys(...)[0]` de antes.
 *
 * @param {T} mapping - Mapeo del que se toma la primera clave.
 * @returns {keyof T} Primera clave con tipo literal.
 */
function firstKey<T extends Record<string, string>>(mapping: T): keyof T {
  return Object.keys(mapping)[0] as keyof T
}

describe('Category Mapping', () => {
  describe('CATEGORY_TO_SECTION', () => {
    it('should export a mapping object with category names as keys', () => {
      expect(CATEGORY_TO_SECTION).toBeDefined()
      expect(typeof CATEGORY_TO_SECTION).toBe('object')
    })

    it('should return 2-digit section codes', () => {
      Object.values(CATEGORY_TO_SECTION).forEach(code => {
        expect(code).toMatch(/^\d{2}$/)
      })
    })

    it('should have at least one mapping', () => {
      expect(Object.keys(CATEGORY_TO_SECTION).length).toBeGreaterThan(0)
    })
  })

  describe('SUBCATEGORY_TO_SPECIFIC', () => {
    it('should export a mapping object with subcategory names as keys', () => {
      expect(SUBCATEGORY_TO_SPECIFIC).toBeDefined()
      expect(typeof SUBCATEGORY_TO_SPECIFIC).toBe('object')
    })

    it('should return 4-digit specific codes', () => {
      Object.values(SUBCATEGORY_TO_SPECIFIC).forEach(code => {
        expect(code).toMatch(/^\d{4}$/)
      })
    })

    it('should have unique specific codes', () => {
      const codes = Object.values(SUBCATEGORY_TO_SPECIFIC)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(codes.length)
    })
  })

  describe('mapCategoryToSection()', () => {
    it('should return the section code for a valid category', () => {
      const categoryName = firstKey(CATEGORY_TO_SECTION)
      const expected = CATEGORY_TO_SECTION[categoryName]
      const result = mapCategoryToSection(categoryName)
      expect(result).toBe(expected)
    })

    it('should throw an error for an unknown category', () => {
      expect(() => mapCategoryToSection('UnknownCategory')).toThrow(
        /no encontrada en mapeo/i
      )
    })

    it('should be case-insensitive', () => {
      const categoryName = firstKey(CATEGORY_TO_SECTION)
      const lowercase = mapCategoryToSection(categoryName.toLowerCase())
      const uppercase = mapCategoryToSection(categoryName.toUpperCase())
      expect(lowercase).toBe(uppercase)
    })

    it('should trim whitespace', () => {
      const categoryName = firstKey(CATEGORY_TO_SECTION)
      const result = mapCategoryToSection(`  ${categoryName}  `)
      expect(result).toBe(CATEGORY_TO_SECTION[categoryName])
    })
  })

  describe('mapSubcategoryToSpecific()', () => {
    it('should return the specific code for a valid subcategory', () => {
      const subcategoryName = firstKey(SUBCATEGORY_TO_SPECIFIC)
      const expected = SUBCATEGORY_TO_SPECIFIC[subcategoryName]
      const result = mapSubcategoryToSpecific(subcategoryName)
      expect(result).toBe(expected)
    })

    it('should throw an error for an unknown subcategory', () => {
      expect(() => mapSubcategoryToSpecific('UnknownSubcategory')).toThrow(
        /no encontrada en mapeo/i
      )
    })

    it('should be case-insensitive', () => {
      const subcategoryName = firstKey(SUBCATEGORY_TO_SPECIFIC)
      const lowercase = mapSubcategoryToSpecific(subcategoryName.toLowerCase())
      const uppercase = mapSubcategoryToSpecific(subcategoryName.toUpperCase())
      expect(lowercase).toBe(uppercase)
    })

    it('should trim whitespace', () => {
      const subcategoryName = firstKey(SUBCATEGORY_TO_SPECIFIC)
      const result = mapSubcategoryToSpecific(`  ${subcategoryName}  `)
      expect(result).toBe(SUBCATEGORY_TO_SPECIFIC[subcategoryName])
    })
  })
})
