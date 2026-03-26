import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FindNextAvailableSurtido } from './ean13-utils'

// Mock Prisma
vi.mock('@prisma/client', () => {
  const mockPrismaClient = {
    producto: {
      findMany: vi.fn(),
    },
  }
  return {
    PrismaClient: vi.fn(() => mockPrismaClient),
  }
})

describe('FindNextAvailableSurtido()', () => {
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      producto: {
        findMany: vi.fn(),
      },
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return 0001 for a new section/specific pair', async () => {
    // Mock: no existing products
    mockPrisma.producto.findMany.mockResolvedValue([])

    const result = await FindNextAvailableSurtido(mockPrisma, '14', '0285')
    expect(result).toBe('0001')
  })

  it('should return next sequential surtido after existing products', async () => {
    // Mock: existing products with surtidos 0001, 0002
    mockPrisma.producto.findMany.mockResolvedValue([
      { surtidoCodigo: '0001' },
      { surtidoCodigo: '0002' },
    ])

    const result = await FindNextAvailableSurtido(mockPrisma, '14', '0285')
    expect(result).toBe('0003')
  })

  it('should return incremented surtido when products with gaps exist', async () => {
    // Mock: existing products with surtidos 0001, 0005 (gap exists)
    mockPrisma.producto.findMany.mockResolvedValue([
      { surtidoCodigo: '0001' },
      { surtidoCodigo: '0005' },
    ])

    // Should find max (0005) and increment to 0006
    const result = await FindNextAvailableSurtido(mockPrisma, '14', '0285')
    expect(result).toBe('0006')
  })

  it('should pad surtido with leading zeros', async () => {
    // Mock: existing products with surtidos up to 0099
    const existing = Array.from({ length: 99 }, (_, i) =>
      ({ surtidoCodigo: String(i + 1).padStart(4, '0') })
    )
    mockPrisma.producto.findMany.mockResolvedValue(existing)

    const result = await FindNextAvailableSurtido(mockPrisma, '14', '0285')
    expect(result).toBe('0100')
  })

  it('should omit soft-deleted products (deletedAt IS NULL)', async () => {
    // Mock: query should exclude soft-deleted products
    mockPrisma.producto.findMany.mockResolvedValue([
      { surtidoCodigo: '0001' },
      // 0002 is deleted (excluded by WHERE deletedAt IS NULL)
      { surtidoCodigo: '0003' },
    ])

    const result = await FindNextAvailableSurtido(mockPrisma, '14', '0285')
    expect(result).toBe('0004')

    // Verify SQL WHERE clause includes deletedAt check
    expect(mockPrisma.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
        }),
      })
    )
  })

  it('should throw error when max surtido (9999) is reached', async () => {
    // Mock: existing products fill up to 9999
    mockPrisma.producto.findMany.mockResolvedValue([
      { surtidoCodigo: '9999' },
    ])

    await expect(() =>
      FindNextAvailableSurtido(mockPrisma, '14', '0285')
    ).rejects.toThrow(/desbordamiento|overflow/i)
  })

  it('should handle invalid surtido values gracefully', async () => {
    // Mock: some products have non-numeric surtido (edge case)
    mockPrisma.producto.findMany.mockResolvedValue([
      { surtidoCodigo: '0001' },
      { surtidoCodigo: 'INVALID' }, // Should be skipped
      { surtidoCodigo: '0003' },
    ])

    // Should ignore invalid and find max valid = 0003, return 0004
    const result = await FindNextAvailableSurtido(mockPrisma, '14', '0285')
    expect(result).toBe('0004')
  })

  it('should query for the specific section/specific pair', async () => {
    mockPrisma.producto.findMany.mockResolvedValue([])

    await FindNextAvailableSurtido(mockPrisma, '14', '0285')

    // Verify it queries for the correct section + specific
    expect(mockPrisma.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          idSeccionCodigo: '14',
          especificoCodigo: '0285',
        }),
      })
    )
  })

  it('should return different values for different section/specific pairs', async () => {
    // First pair: section 14, specific 0285
    mockPrisma.producto.findMany.mockResolvedValueOnce([
      { surtidoCodigo: '0001' },
    ])
    const result1 = await FindNextAvailableSurtido(mockPrisma, '14', '0285')

    // Second pair: section 15, specific 0301
    mockPrisma.producto.findMany.mockResolvedValueOnce([
      { surtidoCodigo: '0001' },
      { surtidoCodigo: '0002' },
    ])
    const result2 = await FindNextAvailableSurtido(mockPrisma, '15', '0301')

    expect(result1).toBe('0002')
    expect(result2).toBe('0003')
  })
})
