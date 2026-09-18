import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    ventaServicios: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    cuentaBancaria: {
      findFirst: vi.fn(),
    },
    tipoPago: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}))

vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: vi.fn(),
  requireTenant: vi.fn((user: { tenantId?: string }) => {
    if (!user.tenantId) {
      throw new Error('Se requiere una membresía de empresa activa para acceder a este recurso')
    }
    return user.tenantId
  }),
}))

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/services/validate-period-write', () => ({
  validarEscrituraPeriodo: vi.fn(),
  extraerFechaDeBody: vi.fn().mockReturnValue(new Date()),
}))

import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { requireTenant } from '@/lib/services/tenant-scope'
import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write'
import { GET, POST } from '../route'

const user = { userId: 'user-a', tenantId: 'tenant-a' }

/**
 * @description Crea el cliente transaccional mínimo para probar las mutaciones de la ruta.
 * @returns {Record<string, unknown>} Cliente transaccional de Prisma simulado.
 */
function createTransactionMock() {
  return {
    reconciliacionServicio: {
      create: vi.fn().mockResolvedValue({
        reconciliacionId: 'reconciliation-a',
        ventaServicioId: 'service-sale-a',
        monto: 10,
        moneda: 'USD',
        montoConvertido: 10,
      }),
    },
    cuentaBancaria: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    transaccionMoneda: {
      create: vi.fn().mockResolvedValue({ transaccionId: 'transaction-a' }),
    },
  }
}

describe('Reconciliación de servicios: aislamiento multi-tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET consulta servicios y reconciliaciones únicamente del tenant autenticado', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never)
    vi.mocked(prisma.ventaServicios.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.ventaServicios.count).mockResolvedValue(0)

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/servicios'),
    )

    expect(response.status).toBe(200)
    expect(requireTenant).toHaveBeenCalledWith(user)
    expect(prisma.ventaServicios.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-a',
          servicio: { is: { tenantId: 'tenant-a' } },
          AND: expect.arrayContaining([
            expect.objectContaining({ OR: expect.any(Array) }),
          ]),
        }),
        include: expect.objectContaining({
          reconciliaciones: {
            where: { tenantId: 'tenant-a' },
            select: { montoConvertido: true },
          },
        }),
      }),
    )
    expect(prisma.ventaServicios.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-a',
        servicio: { is: { tenantId: 'tenant-a' } },
        AND: expect.arrayContaining([
          expect.objectContaining({ OR: expect.any(Array) }),
        ]),
      }),
    })
  })

  it('POST valida el tenant en las lecturas y lo conserva en todas las mutaciones', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never)
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true } as never)
    vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue({
      ventaServicioId: 'service-sale-a',
      tenantId: 'tenant-a',
    } as never)
    vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue({
      cuentaId: 'account-a',
      tenantId: 'tenant-a',
      isActive: true,
      moneda: 'USD',
    } as never)
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue({
      tipoId: 'payment-type-a',
      tenantId: 'tenant-a',
      isActive: true,
      requiereCuenta: false,
      cuentaDefecto: null,
      nombre: 'Transferencia',
    } as never)

    const transaction = createTransactionMock()
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    )

    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/servicios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ventaServicioId: 'service-sale-a',
          cuentaId: 'account-a',
          tipoPagoId: 'payment-type-a',
          monto: 10,
          moneda: 'USD',
          tasaCambio: 1,
        }),
      }),
    )

    expect(response.status).toBe(201)
    expect(prisma.ventaServicios.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        ventaServicioId: 'service-sale-a',
        tenantId: 'tenant-a',
        servicio: { is: { tenantId: 'tenant-a' } },
        AND: expect.arrayContaining([
          expect.objectContaining({ OR: expect.any(Array) }),
        ]),
      }),
    })
    expect(prisma.cuentaBancaria.findFirst).toHaveBeenCalledWith({
      where: { cuentaId: 'account-a', tenantId: 'tenant-a' },
    })
    expect(transaction.reconciliacionServicio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    )
    expect(transaction.cuentaBancaria.updateMany).toHaveBeenCalledWith({
      where: { cuentaId: 'account-a', tenantId: 'tenant-a' },
      data: { saldo: { increment: 10 } },
    })
    expect(transaction.transaccionMoneda.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ referenciaId: 'service-sale-a' }),
    })
  })

  it('POST no muta cuando el servicio no pertenece al tenant autenticado', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never)
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true } as never)
    vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(null)

    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/servicios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ventaServicioId: 'service-sale-other-tenant',
          cuentaId: 'account-other-tenant',
          tipoPagoId: 'payment-type-a',
          monto: 10,
        }),
      }),
    )

    expect(response.status).toBe(404)
    expect(prisma.cuentaBancaria.findFirst).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('revierte la reconciliación si el saldo destino no se actualiza', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never)
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true } as never)
    vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue({
      ventaServicioId: 'service-sale-a',
      tenantId: 'tenant-a',
    } as never)
    vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue({
      cuentaId: 'account-a',
      tenantId: 'tenant-a',
      isActive: true,
      moneda: 'CUP',
    } as never)
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue({
      tipoId: 'payment-type-a',
      tenantId: 'tenant-a',
      isActive: true,
      requiereCuenta: false,
      cuentaDefecto: null,
      nombre: 'Efectivo',
    } as never)

    const transaction = createTransactionMock()
    transaction.cuentaBancaria.updateMany.mockResolvedValue({ count: 0 })
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    )

    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/servicios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ventaServicioId: 'service-sale-a',
          cuentaId: 'account-a',
          tipoPagoId: 'payment-type-a',
          monto: 10,
        }),
      }),
    )

    expect(response.status).toBe(500)
  })
})
