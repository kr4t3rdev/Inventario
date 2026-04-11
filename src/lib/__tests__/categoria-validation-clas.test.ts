import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { validateCategoryAgainstCLAS } from '@/lib/categoria-validation'
import prisma from '@/lib/prisma'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    miEmpresa: {
      findUnique: vi.fn()
    }
  }
}))

describe('validateCategoryAgainstCLAS', () => {
  beforeAll(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    vi.clearAllMocks()
  })

  it('should allow any name when EAN-13 is disabled', async () => {
    vi.mocked(prisma.miEmpresa.findUnique).mockResolvedValueOnce({
      id: 1,
      usaCodigoEan13: false
    } as any)

    const result = await validateCategoryAgainstCLAS('InvalidCategoryName', null)

    expect(result.success).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('should reject root category with invalid section name when EAN-13 is enabled', async () => {
    vi.mocked(prisma.miEmpresa.findUnique).mockResolvedValueOnce({
      id: 1,
      usaCodigoEan13: true
    } as any)

    const result = await validateCategoryAgainstCLAS('InvalidRootCategory', null)

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors![0].code).toBe('INVALID_CLAS_MAPPING')
    expect(result.errors![0].message).toContain(
      'categoria debe coincidir con las secciones declaradas'
    )
  })

  it('should accept valid root category when EAN-13 is enabled', async () => {
    vi.mocked(prisma.miEmpresa.findUnique).mockResolvedValueOnce({
      id: 1,
      usaCodigoEan13: true
    } as any)

    const result = await validateCategoryAgainstCLAS('CONFECCIONES', null)

    expect(result.success).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('should accept valid root category case-insensitively when EAN-13 is enabled', async () => {
    vi.mocked(prisma.miEmpresa.findUnique).mockResolvedValueOnce({
      id: 1,
      usaCodigoEan13: true
    } as any)

    const result = await validateCategoryAgainstCLAS('confecciones', null)

    expect(result.success).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('should reject subcategory with invalid specific when EAN-13 is enabled', async () => {
    vi.mocked(prisma.miEmpresa.findUnique).mockResolvedValueOnce({
      id: 1,
      usaCodigoEan13: true
    } as any)

    const result = await validateCategoryAgainstCLAS('InvalidSubcategoryName', 'parent-id-123')

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors![0].code).toBe('INVALID_CLAS_MAPPING')
    expect(result.errors![0].message).toContain(
      'subcategoria ingresada debe coincidir con el especifico'
    )
  })

  it('should accept valid subcategory when EAN-13 is enabled', async () => {
    vi.mocked(prisma.miEmpresa.findUnique).mockResolvedValueOnce({
      id: 1,
      usaCodigoEan13: true
    } as any)

    const result = await validateCategoryAgainstCLAS('PANTALONES DE VESTIR (HOMBRE)', 'parent-id-123')

    expect(result.success).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('should include correct error message for root category', async () => {
    vi.mocked(prisma.miEmpresa.findUnique).mockResolvedValueOnce({
      id: 1,
      usaCodigoEan13: true
    } as any)

    const result = await validateCategoryAgainstCLAS('NotAValidCategory', null)

    expect(result.success).toBe(false)
    expect(result.errors![0].message).toBe(
      'Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador'
    )
  })

  it('should include correct error message for subcategory', async () => {
    vi.mocked(prisma.miEmpresa.findUnique).mockResolvedValueOnce({
      id: 1,
      usaCodigoEan13: true
    } as any)

    const result = await validateCategoryAgainstCLAS('NotAValidSubcategory', 'parent-123')

    expect(result.success).toBe(false)
    expect(result.errors![0].message).toBe(
      'Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador'
    )
  })
})
