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

describe('CategoriaValidator.validateCategoryCreation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.miEmpresa.findUnique).mockResolvedValue({ usaCodigoEan13: false } as never)
    vi.mocked(prisma.categoria.findFirst).mockResolvedValue(null as never)
  })

  it('acepta descripcion null en creación', async () => {
    const result = await CategoriaValidator.validateCategoryCreation(
      {
        nombre: 'Electrónica',
        descripcion: null,
        parentId: null,
        clasSectionId: null,
        clasSpecificId: null,
      },
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
