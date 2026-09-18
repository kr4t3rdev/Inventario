import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    miEmpresa: {
      findUnique: vi.fn(),
    },
    categoria: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  prisma: {
    miEmpresa: {
      findUnique: vi.fn(),
    },
    categoria: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/clas-classifier.server', () => ({
  getClasClassifierData: vi.fn(() => ({ specificSectionById: {} })),
}))

vi.mock('@/lib/clas-classifier', () => ({
  isSpecificInSection: vi.fn(() => true),
  validateCLASSection: vi.fn(() => null),
  validateCLASSpecific: vi.fn(() => null),
}))

import prisma from '@/lib/prisma'
import { CategoriaValidator } from '@/lib/categoria-validation'

describe('CategoriaValidator.validateCategoryUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.miEmpresa.findUnique).mockResolvedValue({ usaCodigoEan13: false } as never)
  })

  it('permite updates parciales preservando el nombre existente', async () => {
    vi.mocked(prisma.categoria.findFirst)
      .mockResolvedValueOnce({
        catId: 'cat-1',
        tenantId: 'tenant-1',
        nombre: 'Electrónica',
        descripcion: 'Original',
        parentId: null,
        clasSectionId: null,
        clasSpecificId: null,
      } as never)
      .mockResolvedValueOnce(null as never)

    const result = await CategoriaValidator.validateCategoryUpdate(
      'cat-1',
      { descripcion: 'Nueva descripción' },
      'tenant-1',
    )

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      nombre: 'Electrónica',
      descripcion: 'Nueva descripción',
      parentId: null,
    })
  })

  it('acepta descripcion null para limpiar el campo', async () => {
    vi.mocked(prisma.categoria.findFirst)
      .mockResolvedValueOnce({
        catId: 'cat-1',
        tenantId: 'tenant-1',
        nombre: 'Electrónica',
        descripcion: 'Original',
        parentId: null,
        clasSectionId: null,
        clasSpecificId: null,
      } as never)
      .mockResolvedValueOnce(null as never)

    const result = await CategoriaValidator.validateCategoryUpdate(
      'cat-1',
      { descripcion: null },
      'tenant-1',
    )

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      nombre: 'Electrónica',
      descripcion: null,
      parentId: null,
    })
  })
})
