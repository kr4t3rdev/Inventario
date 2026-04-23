import { describe, expect, it } from 'vitest'
import type { Categoria } from '@/app/models/model'
import type { CLASClassifierData } from '@/lib/clas-classifier'
import {
  buildAvailableClasSections,
  filterSpecifics,
  resolveClasParentCategoryId,
} from '../subcategory-form'

const mockClassifierData: CLASClassifierData = {
  sections: [
    { id: '30', name: 'CONFECCIONES' },
    { id: '21', name: 'ALIMENTOS' },
  ],
  specifics: [
    { id: '1451', name: 'CAMISAS CON MANGAS CORTAS (HOMBRE)', sectionId: '30' },
  ],
  sectionNameById: {
    '21': 'ALIMENTOS',
    '30': 'CONFECCIONES',
  },
  specificNameById: {
    '1451': 'CAMISAS CON MANGAS CORTAS (HOMBRE)',
  },
  specificSectionById: {
    '1451': '30',
  },
}

const mockCategorias: Categoria[] = [
  {
    catId: 'cat-root-1',
    nombre: 'CONFECCIONES',
    descripcion: 'Sección creada',
    createdAt: '2026-04-17',
    updatedAt: '2026-04-17',
  },
  {
    catId: 'cat-root-2',
    nombre: 'Categoría libre',
    descripcion: 'No pertenece al clasificador',
    createdAt: '2026-04-17',
    updatedAt: '2026-04-17',
  },
  {
    catId: 'cat-child-1',
    nombre: 'CAMISAS CON MANGAS CORTAS (HOMBRE)',
    descripcion: 'Subcategoría existente',
    parentId: 'cat-root-1',
    createdAt: '2026-04-17',
    updatedAt: '2026-04-17',
  },
]

const mockSpecifics = [
  { id: '0101', name: 'LECHE ENTERA', sectionId: '21' },
  { id: '0102', name: 'LECHE DESCREMADA', sectionId: '21' },
  { id: '1451', name: 'CAMISAS CON MANGAS CORTAS (HOMBRE)', sectionId: '30' },
]

describe('subcategory-form helpers', () => {
  it('should expose only created root CLAS sections', () => {
    const sections = buildAvailableClasSections(mockCategorias, mockClassifierData)

    expect(sections).toEqual([
      {
        parentCategoryId: 'cat-root-1',
        parentCategoryName: 'CONFECCIONES',
        sectionId: '30',
        sectionName: 'CONFECCIONES',
      },
    ])
  })

  it('should resolve the real parent category id for a selected section', () => {
    const sections = buildAvailableClasSections(mockCategorias, mockClassifierData)

    expect(resolveClasParentCategoryId(sections, '30')).toBe('cat-root-1')
    expect(resolveClasParentCategoryId(sections, '21')).toBeNull()
  })

  describe('filterSpecifics', () => {
    it('should return all specifics when search term is empty', () => {
      const result = filterSpecifics(mockSpecifics, '')
      expect(result).toEqual(mockSpecifics)
    })

    it('should filter by name partial match (case-insensitive)', () => {
      const result = filterSpecifics(mockSpecifics, 'leche')
      expect(result).toHaveLength(2)
      expect(result.map((s) => s.id)).toEqual(['0101', '0102'])
    })

    it('should filter by ID partial match', () => {
      const result = filterSpecifics(mockSpecifics, '0102')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('0102')
    })

    it('should return empty array when no match found', () => {
      const result = filterSpecifics(mockSpecifics, 'xyz')
      expect(result).toEqual([])
    })

    it('should match name with mixed case search', () => {
      const result = filterSpecifics(mockSpecifics, 'CaMisAs')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1451')
    })

    it('should match ID substring', () => {
      const result = filterSpecifics(mockSpecifics, '01')
      expect(result).toHaveLength(2)
      expect(result.map((s) => s.id)).toEqual(['0101', '0102'])
    })

    it('should trim search term before filtering', () => {
      const result = filterSpecifics(mockSpecifics, '  leche  ')
      expect(result).toHaveLength(2)
    })
  })
})