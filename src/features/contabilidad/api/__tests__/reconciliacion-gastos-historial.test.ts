import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => {
  const prisma = {
    reconciliacionGasto: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn()
    },
    cuentaBancaria: {
      findMany: vi.fn()
    }
  }
  return { prisma, default: prisma }
})

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn()
}))

describe('Reconciliacion gastos historial API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 401 cuando no hay usuario autenticado', async () => {
    const { GET } = await import('../route')
    const { authenticateUser } = await import('@/lib/auth-middleware')
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 }) as any
    )

    const request = new NextRequest(
      'http://localhost/api/contabilidad/reconciliacion/gastos/historial?page=1&limit=10'
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.code).toBe('UNAUTHORIZED')
  })
})
