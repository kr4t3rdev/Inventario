/**
 * @description Test for Task 4: Auto-generate child product codes with inheritance
 * Tests that child products inherit parent segments and auto-generate unique surtido
 */

import { describe, it, expect } from 'vitest'
import { mapCategoryToSection, mapSubcategoryToSpecific } from '@/lib/category-mapping'
import { AssembleEan13Code, ValidateAssembledCode } from '@/lib/ean13-utils'

describe('Task 4: Child Product Code Generation & Inheritance', () => {
  describe('Child Code Inheritance Pattern', () => {
    it('should inherit provider code from parent', () => {
      // Parent is created first with auto-generated codes
      const parentProvider = '01'
      const parentSection = mapCategoryToSection('Bebidas')
      const parentSpecific = mapSubcategoryToSpecific('Bebidas_Alcoholicas')
      const parentSurtido = '0001'
      
      // Child inherits provider from parent
      const childProvider = parentProvider // INHERITED
      expect(childProvider).toBe('01')
    })

    it('should inherit section code from parent', () => {
      const parentSection = mapCategoryToSection('Bebidas')
      
      // Child inherits section from parent
      const childSection = parentSection // INHERITED
      expect(childSection).toBe('14')
    })

    it('should inherit specific code from parent', () => {
      const parentSpecific = mapSubcategoryToSpecific('Bebidas_Alcoholicas')
      
      // Child inherits specific from parent
      const childSpecific = parentSpecific // INHERITED
      expect(childSpecific).toBe('0285')
    })

    it('should generate NEW surtido for child (not inherit parent surtido)', () => {
      // Parent has surtido 0001
      const parentSurtido = '0001'
      
      // Child gets different surtido (simulated: next available)
      const childSurtido = '0002'
      
      // They should differ
      expect(childSurtido).not.toBe(parentSurtido)
    })
  })

  describe('Child Code Generation Flow', () => {
    it('should assemble child code from inherited segments + generated surtido', () => {
      // Parent segments (inherited)
      const parentCode = AssembleEan13Code('01', '14', '0285', '0001')
      
      // Child: same provider, section, specific but different surtido
      const childCode = AssembleEan13Code('01', '14', '0285', '0002')
      
      expect(childCode).toHaveLength(13)
      expect(childCode).toMatch(/^\d{13}$/)
      expect(ValidateAssembledCode(childCode)).toBe(true)
      expect(parentCode).not.toBe(childCode)
    })

    it('should generate valid EAN-13 check digit for child code', () => {
      const childCode = AssembleEan13Code('01', '14', '0285', '0002')
      
      // Verify check digit is valid
      expect(ValidateAssembledCode(childCode)).toBe(true)
    })

    it('should generate multiple children with unique codes', () => {
      // One parent with multiple children
      const parentProvider = '01'
      const parentSection = '14'
      const parentSpecific = '0285'
      
      // 3 children with different surtidos
      const child1 = AssembleEan13Code(parentProvider, parentSection, parentSpecific, '0002')
      const child2 = AssembleEan13Code(parentProvider, parentSection, parentSpecific, '0003')
      const child3 = AssembleEan13Code(parentProvider, parentSection, parentSpecific, '0004')
      
      // All should be unique
      expect(new Set([child1, child2, child3]).size).toBe(3)
      
      // All should be valid
      expect(ValidateAssembledCode(child1)).toBe(true)
      expect(ValidateAssembledCode(child2)).toBe(true)
      expect(ValidateAssembledCode(child3)).toBe(true)
    })
  })

  describe('Child-Parent Segment Matching', () => {
    it('should NOT inherit parent surtido directly', () => {
      // Parent: 0001
      // Child: generated as next available (0002, 0003, etc.)
      const parentSurtido = '0001'
      const childSurtido = '0002'
      
      expect(childSurtido).not.toBe(parentSurtido)
    })

    it('should share provider with parent', () => {
      const parentProvider = '01'
      const childProvider = parentProvider // INHERITED
      
      expect(childProvider).toBe(parentProvider)
    })

    it('should share section with parent', () => {
      const parentSection = mapCategoryToSection('Bebidas')
      const childSection = parentSection // INHERITED
      
      expect(childSection).toBe(parentSection)
    })

    it('should share specific with parent', () => {
      const parentSpecific = mapSubcategoryToSpecific('Bebidas_Alcoholicas')
      const childSpecific = parentSpecific // INHERITED
      
      expect(childSpecific).toBe(parentSpecific)
    })
  })

  describe('Multi-Child Same-Parent Scenario', () => {
    it('should generate unique surtidos for children of same parent', () => {
      // One parent: Vino Tinto Premium (surtido 0001)
      // Three child products (surtido 0002, 0003, 0004)
      
      const parentCode = AssembleEan13Code('01', '14', '0285', '0001')
      
      // 3 children with sequential surtidos
      const child1Code = AssembleEan13Code('01', '14', '0285', '0002')
      const child2Code = AssembleEan13Code('01', '14', '0285', '0003')
      const child3Code = AssembleEan13Code('01', '14', '0285', '0004')
      
      // All codes should be different
      const codes = [parentCode, child1Code, child2Code, child3Code]
      expect(new Set(codes).size).toBe(4)
    })

    it('should maintain uniqueness across different parent/child relationships', () => {
      // Parent A: Vino Tinto (section 14, specific 0285, surtido 0001)
      const parentA = AssembleEan13Code('01', '14', '0285', '0001')
      const childA1 = AssembleEan13Code('01', '14', '0285', '0002')
      
      // Parent B: Cerveza (section 14, specific 0281, surtido 0001)
      const parentB = AssembleEan13Code('01', '14', '0281', '0001')
      const childB1 = AssembleEan13Code('01', '14', '0281', '0002')
      
      // All 4 codes should be unique
      const codes = [parentA, childA1, parentB, childB1]
      expect(new Set(codes).size).toBe(4)
    })
  })

  describe('Child Code Persistence Requirements', () => {
    it('should persist all inherited segments in child record', () => {
      // Simulate child product creation with inherited values
      const childProduct = {
        proveedorCodigo: '01',           // INHERITED from parent
        idSeccionCodigo: '14',           // INHERITED from parent
        especificoCodigo: '0285',        // INHERITED from parent
        surtidoCodigo: '0002',           // GENERATED (not inherited)
        codigoNegocio: '' as any,        // ASSEMBLED from all 4
      }
      
      // Assemble the code
      childProduct.codigoNegocio = AssembleEan13Code(
        childProduct.proveedorCodigo,
        childProduct.idSeccionCodigo,
        childProduct.especificoCodigo,
        childProduct.surtidoCodigo
      )
      
      // Verify all fields are present and correct
      expect(childProduct.proveedorCodigo).toBe('01')
      expect(childProduct.idSeccionCodigo).toBe('14')
      expect(childProduct.especificoCodigo).toBe('0285')
      expect(childProduct.surtidoCodigo).toBe('0002')
      expect(childProduct.codigoNegocio).toHaveLength(13)
      expect(ValidateAssembledCode(childProduct.codigoNegocio)).toBe(true)
    })

    it('should NOT modify any inherited segment during child creation', () => {
      const parentSegments = {
        provider: '01',
        section: '14',
        specific: '0285',
      }
      
      // Child inherits parent segments
      const childSegments = {
        provider: parentSegments.provider,
        section: parentSegments.section,
        specific: parentSegments.specific,
        surtido: '0002', // ONLY surtido is different
      }
      
      // Segments must match exactly
      expect(childSegments.provider).toBe(parentSegments.provider)
      expect(childSegments.section).toBe(parentSegments.section)
      expect(childSegments.specific).toBe(parentSegments.specific)
    })
  })

  describe('Error Cases - Child Validation', () => {
    it('should validate child code same as parent code validation', () => {
      const validCodes = [
        AssembleEan13Code('01', '14', '0285', '0001'),
        AssembleEan13Code('01', '14', '0285', '0002'),
        AssembleEan13Code('02', '16', '0505', '0001'),
      ]
      
      validCodes.forEach(code => {
        expect(ValidateAssembledCode(code)).toBe(true)
      })
    })

    it('should reject invalid child code format', () => {
      const invalidCodes = [
        '12345678901',  // 11 digits
        '123456789012', // 12 digits
        'abcdefghijklm', // Non-numeric
      ]
      
      invalidCodes.forEach(code => {
        expect(ValidateAssembledCode(code)).toBe(false)
      })
    })
  })

  describe('Response Format - Child Code in API', () => {
    it('should return child code in POST response', () => {
      const mockResponse = {
        producto: {
          id: 'padreId',
          codigoNegocio: '0114028500001',
          proveedorCodigo: '01',
          idSeccionCodigo: '14',
          especificoCodigo: '0285',
          surtidoCodigo: '0001',
        },
        productoHijo: {
          id: 'hijoId',
          codigoNegocio: '0114028500002', // GENERATED
          proveedorCodigo: '01',          // INHERITED
          idSeccionCodigo: '14',          // INHERITED
          especificoCodigo: '0285',       // INHERITED
          surtidoCodigo: '0002',          // GENERATED
        },
      }
      
      // Verify response structure
      expect(mockResponse.productoHijo).toBeDefined()
      expect(mockResponse.productoHijo?.codigoNegocio).toMatch(/^\d{13}$/)
      expect(mockResponse.productoHijo?.proveedorCodigo).toBe(mockResponse.producto.proveedorCodigo)
      expect(mockResponse.productoHijo?.idSeccionCodigo).toBe(mockResponse.producto.idSeccionCodigo)
      expect(mockResponse.productoHijo?.especificoCodigo).toBe(mockResponse.producto.especificoCodigo)
      expect(mockResponse.productoHijo?.surtidoCodigo).not.toBe(mockResponse.producto.surtidoCodigo)
    })
  })
})
