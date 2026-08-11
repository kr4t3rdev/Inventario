import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { authenticateUser } from '@/lib/auth-middleware'
import { endOfDay } from '@/lib/date-range'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: { findMany: vi.fn() },
    reconciliacionVenta: { findMany: vi.fn() },
    reconciliacionServicio: { findMany: vi.fn() },
    reconciliacionGasto: { findMany: vi.fn() },
    transferenciaBancaria: { findMany: vi.fn() },
    ajusteBancario: { findMany: vi.fn() },
    inyeccionCapital: { findMany: vi.fn() },
    pagoDeuda: { findMany: vi.fn() },
  }
}))

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn().mockResolvedValue({
    user: {
      userId: 'user-a',
      role: 'user',
      tenantId: 'tenant-a',
      planFeatures: {
        servicios: true,
        'transferencias-bancarias': true,
        'ajustes-bancarios': true,
        'inyeccion-capital': true,
        'prestamos-cash': true,
      },
    },
  }),
}))

describe('GET /api/contabilidad/reportes/resumen - aislamiento por tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aplica tenantId en cuentas, reconciliaciones y relaciones cuentaBancaria', async () => {
    const prisma = (await import('@/lib/prisma')).prisma as any
    prisma.cuentaBancaria.findMany.mockResolvedValue([])
    prisma.reconciliacionVenta.findMany.mockResolvedValue([])
    prisma.reconciliacionServicio.findMany.mockResolvedValue([])
    prisma.reconciliacionGasto.findMany.mockResolvedValue([])
    prisma.transferenciaBancaria.findMany.mockResolvedValue([])
    prisma.ajusteBancario.findMany.mockResolvedValue([])
    prisma.inyeccionCapital.findMany.mockResolvedValue([])
    prisma.pagoDeuda.findMany.mockResolvedValue([])

    const { GET } = await import('../route')
    await GET(new NextRequest('http://localhost/api/contabilidad/reportes/resumen'))

    const directQueries = [
      prisma.cuentaBancaria.findMany,
      prisma.reconciliacionVenta.findMany,
      prisma.reconciliacionServicio.findMany,
      prisma.reconciliacionGasto.findMany,
      prisma.transferenciaBancaria.findMany,
      prisma.ajusteBancario.findMany,
    ]

    for (const query of directQueries) {
      for (const [args] of query.mock.calls) {
        expect(args.where).toEqual(expect.objectContaining({ tenantId: 'tenant-a' }))
      }
    }

    for (const query of [prisma.inyeccionCapital.findMany, prisma.pagoDeuda.findMany]) {
      expect(query).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ cuentaBancaria: { tenantId: 'tenant-a' } }),
      }))
    }
  })

  it('mantiene el scope tenant cuando cuentaId apunta a otra empresa', async () => {
    const prisma = (await import('@/lib/prisma')).prisma as any
    for (const model of [
      'cuentaBancaria',
      'reconciliacionVenta',
      'reconciliacionServicio',
      'reconciliacionGasto',
      'transferenciaBancaria',
      'ajusteBancario',
      'inyeccionCapital',
      'pagoDeuda',
    ]) {
      prisma[model].findMany.mockResolvedValue([])
    }

    const { GET } = await import('../route')
    await GET(new NextRequest(
      'http://localhost/api/contabilidad/reportes/resumen?cuentaId=account-b',
    ))

    for (const query of [
      prisma.cuentaBancaria.findMany,
      prisma.reconciliacionVenta.findMany,
      prisma.reconciliacionServicio.findMany,
      prisma.reconciliacionGasto.findMany,
      prisma.ajusteBancario.findMany,
    ]) {
      for (const [args] of query.mock.calls) {
        expect(args.where).toEqual(expect.objectContaining({ tenantId: 'tenant-a' }))
      }
    }

    for (const query of [prisma.inyeccionCapital.findMany, prisma.pagoDeuda.findMany]) {
      for (const [args] of query.mock.calls) {
        expect(args.where).toEqual(expect.objectContaining({
          cuentaBancaria: { tenantId: 'tenant-a' },
        }))
      }
    }

    expect(prisma.transferenciaBancaria.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-a',
        OR: [{ cuentaOrigenId: 'account-b' }, { cuentaDestinoId: 'account-b' }],
      }),
    }))
  })

  it('incluye todo el día final del período', async () => {
    const prisma = (await import('@/lib/prisma')).prisma as any
    for (const model of [
      'cuentaBancaria',
      'reconciliacionVenta',
      'reconciliacionServicio',
      'reconciliacionGasto',
      'transferenciaBancaria',
      'ajusteBancario',
      'inyeccionCapital',
      'pagoDeuda',
    ]) {
      prisma[model].findMany.mockResolvedValue([])
    }

    const { GET } = await import('../route')
    await GET(new NextRequest(
      'http://localhost/api/contabilidad/reportes/resumen?fechaFin=2026-01-31',
    ))

    expect(prisma.reconciliacionVenta.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        fechaReconciliacion: { lte: endOfDay('2026-01-31') },
      }),
    }))
  })
})
