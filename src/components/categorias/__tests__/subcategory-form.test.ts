import { describe, expect, it } from 'vitest'
import type { Categoria } from '@/app/models/model'
import type { CLASClassifierData } from '@/lib/clas-classifier'
import {
  buildAvailableClasSections,
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
})