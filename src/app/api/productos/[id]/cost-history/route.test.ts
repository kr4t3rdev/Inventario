/**
 * @description Unit tests para GET /api/productos/[id]/cost-history endpoint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from './route'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: {
      findUnique: vi.fn(),
    },
    productoCostHistory: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: () => Promise<any>) => handler(),
}))

describe('GET /api/productos/[id]/cost-history', () => {
  const mockProductId = 'test-producto-id'
  const mockUserId = 'test-user-id'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when producto not found', async () => {
    vi.mocked(prisma.producto.findUnique).mockResolvedValueOnce(null)

    const request = new NextRequest(
      new Request(`http://localhost:3000/api/productos/nonexistent/cost-history?page=1&limit=20`)
    )

    const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toContain('no encontrado')
  })

  it('returns 200 with cost history records on success', async () => {
    const mockRecords = [
      {
        id: 'history-1',
        productoId: mockProductId,
        oldPrecioCosto: 100,
        newPrecioCosto: 120,
        oldPrecioVenta: 150,
        newPrecioVenta: 180,
        reason: 'MANUAL_EDIT',
        changedBy: mockUserId,
        changedAt: new Date('2026-04-07'),
        notes: 'Price adjustment',
      },
    ]

    vi.mocked(prisma.producto.findUnique).mockResolvedValueOnce({ id: mockProductId })
    vi.mocked(prisma.productoCostHistory.findMany).mockResolvedValueOnce(mockRecords as any)
    vi.mocked(prisma.productoCostHistory.count).mockResolvedValueOnce(1)

    const request = new NextRequest(
      new Request(`http://localhost:3000/api/productos/${mockProductId}/cost-history?page=1&limit=20`)
    )

    const response = await GET(request, { params: Promise.resolve({ id: mockProductId }) })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.data).toHaveLength(1)
    expect(data.data[0].reason).toBe('MANUAL_EDIT')
    expect(data.data[0].oldPrecioCosto).toBe(100)
    expect(data.data[0].newPrecioCosto).toBe(120)
  })

  it('applies pagination correctly', async () => {
    vi.mocked(prisma.producto.findUnique).mockResolvedValueOnce({ id: mockProductId })
    vi.mocked(prisma.productoCostHistory.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.productoCostHistory.count).mockResolvedValueOnce(50)

    const request = new NextRequest(
      new Request(`http://localhost:3000/api/productos/${mockProductId}/cost-history?page=2&limit=10`)
    )

    const response = await GET(request, { params: Promise.resolve({ id: mockProductId }) })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.pagination.page).toBe(2)
    expect(data.pagination.limit).toBe(10)
    expect(data.pagination.total).toBe(50)
  })

  it('filters by reason when provided', async () => {
    vi.mocked(prisma.producto.findUnique).mockResolvedValueOnce({ id: mockProductId })
    vi.mocked(prisma.productoCostHistory.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.productoCostHistory.count).mockResolvedValueOnce(0)

    const request = new NextRequest(
      new Request(`http://localhost:3000/api/productos/${mockProductId}/cost-history?page=1&limit=20&reason=RESTOCK`)
    )

    const response = await GET(request, { params: Promise.resolve({ id: mockProductId }) })

    expect(response.status).toBe(200)
    const findManyCall = vi.mocked(prisma.productoCostHistory.findMany).mock.calls[0]
    expect(findManyCall[0].where.reason).toBe('RESTOCK')
  })

  it('filters by date range when provided', async () => {
    vi.mocked(prisma.producto.findUnique).mockResolvedValueOnce({ id: mockProductId })
    vi.mocked(prisma.productoCostHistory.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.productoCostHistory.count).mockResolvedValueOnce(0)

    const request = new NextRequest(
      new Request(`http://localhost:3000/api/productos/${mockProductId}/cost-history?page=1&limit=20&startDate=2026-04-01&endDate=2026-04-30`)
    )

    const response = await GET(request, { params: Promise.resolve({ id: mockProductId }) })

    expect(response.status).toBe(200)
    const findManyCall = vi.mocked(prisma.productoCostHistory.findMany).mock.calls[0]
    expect(findManyCall[0].where.changedAt.gte).toBeDefined()
    expect(findManyCall[0].where.changedAt.lte).toBeDefined()
  })

  it('returns 200 even with invalid date format (ignores filter)', async () => {
    vi.mocked(prisma.producto.findUnique).mockResolvedValueOnce({ id: mockProductId })
    vi.mocked(prisma.productoCostHistory.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.productoCostHistory.count).mockResolvedValueOnce(0)

    const request = new NextRequest(
      new Request(`http://localhost:3000/api/productos/${mockProductId}/cost-history?page=1&limit=20&startDate=invalid-date`)
    )

    const response = await GET(request, { params: Promise.resolve({ id: mockProductId }) })

    expect(response.status).toBe(200)
  })

  it('clamps limit to maximum of 100', async () => {
    vi.mocked(prisma.producto.findUnique).mockResolvedValueOnce({ id: mockProductId })
    vi.mocked(prisma.productoCostHistory.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.productoCostHistory.count).mockResolvedValueOnce(0)

    const request = new NextRequest(
      new Request(`http://localhost:3000/api/productos/${mockProductId}/cost-history?page=1&limit=500`)
    )

    const response = await GET(request, { params: Promise.resolve({ id: mockProductId }) })

    expect(response.status).toBe(200)
    const findManyCall = vi.mocked(prisma.productoCostHistory.findMany).mock.calls[0]
    expect(findManyCall[0].take).toBeLessThanOrEqual(100)
  })

  it('returns 500 on database error', async () => {
    vi.mocked(prisma.producto.findUnique).mockRejectedValueOnce(new Error('Database error'))

    const request = new NextRequest(
      new Request(`http://localhost:3000/api/productos/${mockProductId}/cost-history?page=1&limit=20`)
    )

    const response = await GET(request, { params: Promise.resolve({ id: mockProductId }) })

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })
})
