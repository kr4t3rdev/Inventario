import { describe, expect, it } from 'vitest'

import {
  assertServerOwnedCodeFields,
  buildProductBusinessCodeFromSegments,
  buildProductBusinessCodePreview,
  calculateCompoundUnitPrices,
  normalizeProveedorCodigo,
} from '@/lib/product-business-code'

describe('product-business-code helpers', () => {
  describe('normalizeProveedorCodigo', () => {
    it('normaliza a 2 dígitos', () => {
      expect(normalizeProveedorCodigo('1')).toBe('01')
      expect(normalizeProveedorCodigo('01')).toBe('01')
    })

    it('rechaza valores vacíos o no numéricos', () => {
      expect(() => normalizeProveedorCodigo('')).toThrow(/requerido/i)
      expect(() => normalizeProveedorCodigo('abc')).toThrow(/dígitos/i)
    })
  })

  describe('assertServerOwnedCodeFields', () => {
    it('acepta payloads sin segmentos manuales', () => {
      expect(() => {
        assertServerOwnedCodeFields({
          idSeccionCodigo: '',
          especificoCodigo: '',
          surtidoCodigo: '',
          codigoNegocioHijo: '',
        })
      }).not.toThrow()
    })

    it('rechaza segmentos manuales del padre', () => {
      expect(() => {
        assertServerOwnedCodeFields({
          idSeccionCodigo: '14',
        })
      }).toThrow(/generan automáticamente/i)
    })

    it('rechaza código manual del hijo', () => {
      expect(() => {
        assertServerOwnedCodeFields({
          codigoNegocioHijo: '0114028500029',
        })
      }).toThrow(/producto hijo/i)
    })
  })

  describe('buildProductBusinessCodeFromSegments', () => {
    it('arma un EAN-13 válido a partir de segmentos resueltos', () => {
      expect(
        buildProductBusinessCodeFromSegments({
          proveedorCodigo: '01',
          idSeccionCodigo: '14',
          especificoCodigo: '0285',
          surtidoCodigo: '0001',
        })
      ).toEqual({
        proveedorCodigo: '01',
        idSeccionCodigo: '14',
        especificoCodigo: '0285',
        surtidoCodigo: '0001',
        dcCodigo: '2',
        codigoNegocio: '0114028500012',
      })
    })
  })

  describe('buildProductBusinessCodePreview', () => {
    it('resuelve categoría y subcategoría a segmentos conocidos', () => {
      const preview = buildProductBusinessCodePreview({
        proveedorCodigo: '01',
        categoriaNombre: 'Bebidas',
        subcategoriaNombre: 'Bebidas_Alcoholicas',
        surtidoCodigo: '0002',
      })

      expect(preview.idSeccionCodigo).toBe('14')
      expect(preview.especificoCodigo).toBe('0285')
      expect(preview.codigoNegocio).toBe('0114028500029')
    })
  })

  describe('calculateCompoundUnitPrices', () => {
    it('calcula precios unitarios redondeados', () => {
      expect(calculateCompoundUnitPrices(400, 500, 20)).toEqual({
        precioCostoUnitario: 20,
        precioVentaUnitario: 25,
      })
    })

    it('rechaza cantidad inválida', () => {
      expect(() => calculateCompoundUnitPrices(100, 150, 0)).toThrow(/mayor a 0/i)
    })
  })
})
