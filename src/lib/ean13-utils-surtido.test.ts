import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FindNextAvailableSurtido } from './ean13-utils'

const TEST_TENANT_ID = 'tenant-test-1'

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

  it('should return 0000 for a new section/specific pair', async () => {
    // Mock: no existing products
    mockPrisma.producto.findMany.mockResolvedValue([])

    const result = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '14', '0285')
    expect(result).toBe('0000')
  })

  it('should return next sequential surtido after existing products', async () => {
    // Mock: existing products with surtidos 0000, 0001
    mockPrisma.producto.findMany.mockResolvedValue([
      { surtidoCodigo: '0000' },
      { surtidoCodigo: '0001' },
    ])

    const result = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '14', '0285')
    expect(result).toBe('0002')
  })

  it('should return incremented surtido when products with gaps exist', async () => {
    // Mock: existing products with surtidos 0001, 0005 (gap exists)
    mockPrisma.producto.findMany.mockResolvedValue([
      { surtidoCodigo: '0001' },
      { surtidoCodigo: '0005' },
    ])

    // Should find max (0005) and increment to 0006
    const result = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '14', '0285')
    expect(result).toBe('0006')
  })

  it('should pad surtido with leading zeros', async () => {
    // Mock: existing products with surtidos up to 0099
    const existing = Array.from({ length: 99 }, (_, i) =>
      ({ surtidoCodigo: String(i + 1).padStart(4, '0') })
    )
    mockPrisma.producto.findMany.mockResolvedValue(existing)

    const result = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '14', '0285')
    expect(result).toBe('0100')
  })

  it('should filter by tenantId', async () => {
    mockPrisma.producto.findMany.mockResolvedValue([])

    await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '14', '0285')

    expect(mockPrisma.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TEST_TENANT_ID,
        }),
      })
    )
  })

  it('should not depend on deletedAt because Producto has no soft delete field', async () => {
    mockPrisma.producto.findMany.mockResolvedValue([
      { surtidoCodigo: '0001' },
      { surtidoCodigo: '0003' },
    ])

    const result = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '14', '0285')
    expect(result).toBe('0004')

    // Verify the query scopes by tenant and section/specific
    expect(mockPrisma.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TEST_TENANT_ID,
          idSeccionCodigo: '14',
          especificoCodigo: '0285',
        }),
      })
    )

    expect(mockPrisma.producto.findMany).not.toHaveBeenCalledWith(
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
      FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '14', '0285')
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
    const result = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '14', '0285')
    expect(result).toBe('0004')
  })

  it('should query for tenant, section and specific', async () => {
    mockPrisma.producto.findMany.mockResolvedValue([])

    await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '14', '0285')

    // Verify it queries for the correct tenant + section + specific
    expect(mockPrisma.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TEST_TENANT_ID,
          idSeccionCodigo: '14',
          especificoCodigo: '0285',
        }),
      })
    )
  })

  it('should return different values for different section/specific pairs within same tenant', async () => {
    // First pair: section 14, specific 0285
    mockPrisma.producto.findMany.mockResolvedValueOnce([
      { surtidoCodigo: '0001' },
    ])
    const result1 = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '14', '0285')

    // Second pair: section 15, specific 0301
    mockPrisma.producto.findMany.mockResolvedValueOnce([
      { surtidoCodigo: '0001' },
      { surtidoCodigo: '0002' },
    ])
    const result2 = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '15', '0301')

    expect(result1).toBe('0002')
    expect(result2).toBe('0003')
  })

  it('should return independent surtidos for different tenants with same section/specific', async () => {
    // Tenant A has 3 products (surtidos 0000, 0001, 0002)
    mockPrisma.producto.findMany.mockResolvedValueOnce([
      { surtidoCodigo: '0000' },
      { surtidoCodigo: '0001' },
      { surtidoCodigo: '0002' },
    ])
    const resultA = await FindNextAvailableSurtido(mockPrisma, 'tenant-a', '14', '0285')

    // Tenant B has no products yet
    mockPrisma.producto.findMany.mockResolvedValueOnce([])
    const resultB = await FindNextAvailableSurtido(mockPrisma, 'tenant-b', '14', '0285')

    expect(resultA).toBe('0003')
    expect(resultB).toBe('0000')
  })

  it('should filter by proveedorCodigo when provided', async () => {
    mockPrisma.producto.findMany.mockResolvedValue([
      { surtidoCodigo: '0000' },
    ])

    const result = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '14', '0285', '01')

    expect(result).toBe('0001')

    // Verify it queries with proveedorCodigo
    expect(mockPrisma.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          proveedorCodigo: '01',
        }),
      })
    )
  })
})
