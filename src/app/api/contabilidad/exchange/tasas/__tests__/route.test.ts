import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  moneda: {
    findMany: vi.fn(),
  },
  tasaCambio: {
    findMany: vi.fn(),
  },
  tenantAccountingPolicy: {
    findUnique: vi.fn(),
  },
}))

const user = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  name: 'Usuario',
  email: 'usuario@example.com',
  role: 'regularUser',
  isActive: true,
}

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

describe('GET /api/contabilidad/exchange/tasas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.moneda.findMany.mockResolvedValue([
      { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true },
      { codigo: 'USD', nombre: 'Dólar', simbolo: '$', esPrincipal: false },
    ])
    prismaMock.tasaCambio.findMany.mockResolvedValue([
      { tasaId: 't1', monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa: '24', fechaVigencia: new Date('2026-01-01') },
    ])
  })

  it('devuelve la moneda principal de la política contable del tenant', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-1',
      functionalCurrencyCode: 'USD',
    })

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/exchange/tasas')
    const response = await GET(request, {}, user)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prismaMock.tenantAccountingPolicy.findUnique).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      select: { functionalCurrencyCode: true },
    })
    expect(body.data.monedaPrincipal.codigo).toBe('USD')
    expect(body.data.tasas).toHaveLength(1)
  })

  it('no sustituye por la primera moneda del catálogo si la política está ausente', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue(null)

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/exchange/tasas')
    const response = await GET(request, {}, user)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.monedaPrincipal).toBeNull()
    expect(body.data.tasas).toHaveLength(1)
  })
})
