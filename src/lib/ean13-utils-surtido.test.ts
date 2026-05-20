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

  it('should return 0000 for first product of a vendor', async () => {
    mockPrisma.producto.findMany.mockResolvedValue([])

    const result = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '01')
    expect(result).toBe('0000')
  })

  it('should return next sequential surtido for same vendor', async () => {
    mockPrisma.producto.findMany.mockResolvedValue([
      { surtidoCodigo: '0000' },
      { surtidoCodigo: '0001' },
    ])

    const result = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '01')
    expect(result).toBe('0002')
  })

  it('should reset to 0000 when vendor changes', async () => {
    // Vendor 01 has 3 products
    mockPrisma.producto.findMany.mockResolvedValueOnce([
      { surtidoCodigo: '0000' },
      { surtidoCodigo: '0001' },
      { surtidoCodigo: '0002' },
    ])
    const result01 = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '01')
    expect(result01).toBe('0003')

    // Vendor 02 starts fresh
    mockPrisma.producto.findMany.mockResolvedValueOnce([])
    const result02 = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '02')
    expect(result02).toBe('0000')
  })

  it('should pad surtido with leading zeros', async () => {
    const existing = Array.from({ length: 99 }, (_, i) =>
      ({ surtidoCodigo: String(i + 1).padStart(4, '0') })
    )
    mockPrisma.producto.findMany.mockResolvedValue(existing)

    const result = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '01')
    expect(result).toBe('0100')
  })

  it('should filter by tenantId and proveedorCodigo', async () => {
    mockPrisma.producto.findMany.mockResolvedValue([])

    await FindNextAvailableSurtido(mockPrisma, 'tenant-a', '01')

    expect(mockPrisma.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-a',
          proveedorCodigo: '01',
        },
      })
    )
  })

  it('should be independent across tenants for same vendor code', async () => {
    // Tenant A has products for vendor 01
    mockPrisma.producto.findMany.mockResolvedValueOnce([
      { surtidoCodigo: '0000' },
      { surtidoCodigo: '0001' },
    ])
    const resultA = await FindNextAvailableSurtido(mockPrisma, 'tenant-a', '01')

    // Tenant B has no products yet for vendor 01
    mockPrisma.producto.findMany.mockResolvedValueOnce([])
    const resultB = await FindNextAvailableSurtido(mockPrisma, 'tenant-b', '01')

    expect(resultA).toBe('0002')
    expect(resultB).toBe('0000')
  })

  it('should throw error when max surtido (9999) is reached', async () => {
    mockPrisma.producto.findMany.mockResolvedValue([
      { surtidoCodigo: '9999' },
    ])

    await expect(() =>
      FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '01')
    ).rejects.toThrow(/desbordamiento|overflow/i)
  })

  it('should handle invalid surtido values gracefully', async () => {
    mockPrisma.producto.findMany.mockResolvedValue([
      { surtidoCodigo: '0001' },
      { surtidoCodigo: 'INVALID' }, // Should be skipped
      { surtidoCodigo: '0003' },
    ])

    const result = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '01')
    expect(result).toBe('0004')
  })

  it('should work across different vendors within same tenant', async () => {
    // Vendor 01: has products up to 0005
    mockPrisma.producto.findMany.mockResolvedValueOnce([
      { surtidoCodigo: '0005' },
    ])
    const resultV1 = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '01')

    // Vendor 02: has no products yet
    mockPrisma.producto.findMany.mockResolvedValueOnce([])
    const resultV2 = await FindNextAvailableSurtido(mockPrisma, TEST_TENANT_ID, '02')

    expect(resultV1).toBe('0006')
    expect(resultV2).toBe('0000')
  })
})
