import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    reconciliacionGasto: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn()
    },
    cuentaBancaria: {
      findMany: vi.fn()
    }
  }
}))

vi.mock('@/lib/auth-utils', () => ({
  verify_token: vi.fn()
}))

describe('Reconciliacion gastos historial API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 401 cuando no hay usuario autenticado', async () => {
    const { GET } = await import('../route')
    const { verify_token } = await import('@/lib/auth-utils')
    vi.mocked(verify_token).mockResolvedValue(null)

    const request = new NextRequest(
      'http://localhost/api/contabilidad/reconciliacion/gastos/historial?page=1&limit=10'
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.code).toBe('UNAUTHORIZED')
  })
})
