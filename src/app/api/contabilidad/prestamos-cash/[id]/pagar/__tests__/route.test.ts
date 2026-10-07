import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { Prisma } from '@/generated/prisma'

const authUser = vi.hoisted(() => ({
  value: {
    userId: 'user-test',
    tenantId: 'tenant-1',
    tenantRole: 'manager',
    role: 'user',
    planFeatures: { 'prestamos-cash': true },
    permissions: new Set(['financiero.contabilidad.acceder']),
  },
}))
const functionalCurrencyMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
)

vi.mock('@/lib/auth-middleware', () => {
  return {
    withAuthGet: (handler: any) => (...args: any[]) => handler(args[0], undefined, authUser.value),
    withAuthPost: (handler: any) => async (request: NextRequest, context: any) =>
      handler(request, context, authUser.value)
  }
})

vi.mock('@/lib/prisma', () => {
  const prisma = {
    prestamoCash: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    cuentaPorCobrar: {
      update: vi.fn()
    },
    cuentaBancaria: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    reconciliacionVenta: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
  return { prisma, default: prisma }
})

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: vi.fn() }
}))
vi.mock('@/features/contabilidad/services/tenant-accounting-policy-service', () => ({
  getRequiredTenantAccountingPolicy: functionalCurrencyMock,
}))

vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
  postEvento: vi.fn()
}))

const mockContext = { params: Promise.resolve({ id: 'p-1' }) }

describe('API contabilidad/prestamos-cash/[id]/pagar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authUser.value = {
      userId: 'user-test',
      tenantId: 'tenant-1',
      tenantRole: 'manager',
      role: 'user',
      planFeatures: { 'prestamos-cash': true },
      permissions: new Set(['financiero.contabilidad.acceder']),
    }
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'false')
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH', 'true')
    functionalCurrencyMock.mockResolvedValue({ functionalCurrencyCode: 'CUP' })
  })

  it('deniega dependiente sin permiso financiero antes de consultar o mutar el préstamo', async () => {
    authUser.value = {
      ...authUser.value,
      tenantRole: 'dependiente',
      permissions: new Set(),
    }
    const prisma = (await import('@/lib/prisma')).default as any
    const { POST } = await import('../route')
    const response = await POST(new NextRequest(
      'http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
        method: 'POST',
        body: JSON.stringify({ monto: 50, cuentaId: 'cuenta-1', tipoPagoId: 'tp-1' }),
      }), mockContext)

    expect(response.status).toBe(403)
    expect(prisma.prestamoCash.findFirst).not.toHaveBeenCalled()
    expect(prisma.cuentaBancaria.findFirst).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('deniega si el plan no habilita préstamos cash antes de consultar el préstamo', async () => {
    authUser.value = {
      ...authUser.value,
      planFeatures: { 'prestamos-cash': false },
    }
    const prisma = (await import('@/lib/prisma')).default as any
    const { POST } = await import('../route')
    const response = await POST(new NextRequest(
      'http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
        method: 'POST',
        body: JSON.stringify({ monto: 50, cuentaId: 'cuenta-1', tipoPagoId: 'tp-1' }),
      }), mockContext)

    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('FEATURE_NOT_AVAILABLE')
    expect(prisma.prestamoCash.findFirst).not.toHaveBeenCalled()
  })

  it('POST registra pago parcial con status 201', async () => {
    const prisma = (await import('@/lib/prisma')).default as any

    const mockPrestamo = {
      id: 'p-1',
      tenantId: 'tenant-1',
      clienteId: 'cliente-1',
      estado: 'ACTIVO',
      moneda: 'CUP',
      cuentaPorCobrarId: 'cxc-1',
      cuentaPorCobrar: { montoDeuda: 1000, montoPagado: 0 }
    }
    const mockReconciliacion = { reconciliacionId: 'rec-1' }

    prisma.prestamoCash.findFirst.mockResolvedValue(mockPrestamo)
    prisma.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'cuenta-1', isActive: true, moneda: 'CUP',
    })
    let txClient: any
    prisma.$transaction.mockImplementation(async (callback: any) => {
      txClient = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        tipoPago: { findFirst: vi.fn().mockResolvedValue({ tipoId: 'tp-1', isActive: true }) },
        reconciliacionVenta: { create: vi.fn().mockResolvedValue(mockReconciliacion) },
        cuentaBancaria: { update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        cuentaPorCobrar: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'cxc-1', montoDeuda: 1000, montoPagado: 0, estado: 'PENDIENTE',
          }),
          update: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        prestamoCash: { update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }
      }
      return callback(txClient)
    })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify({
        monto: 500,
        cuentaId: 'cuenta-1',
        tipoPagoId: 'tp-1'
      })
    })

    const response = await POST(request, mockContext)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.reconciliacion.reconciliacionId).toBe('rec-1')
    expect(txClient.$queryRaw).toHaveBeenCalledOnce()
  })

  it('POST vuelve a validar saldo bajo lock y no aplica pago sobre snapshot obsoleto', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.prestamoCash.findFirst.mockResolvedValue({
      id: 'p-1',
      tenantId: 'tenant-1',
      clienteId: 'cliente-1',
      estado: 'ACTIVO',
      moneda: 'CUP',
      cuentaPorCobrarId: 'cxc-1',
      cuentaPorCobrar: { montoDeuda: 1000, montoPagado: 0 },
    })
    prisma.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'cuenta-1', isActive: true, moneda: 'CUP',
    })
    const bankUpdate = vi.fn().mockResolvedValue({ count: 1 })
    const reconciliationCreate = vi.fn()
    prisma.$transaction.mockImplementation(async (callback: any) => callback({
      $queryRaw: vi.fn().mockResolvedValue([]),
      tipoPago: { findFirst: vi.fn().mockResolvedValue({ tipoId: 'tp-1', isActive: true }) },
      cuentaPorCobrar: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'cxc-1', montoDeuda: 1000, montoPagado: 800, estado: 'PARCIAL',
        }),
        update: vi.fn(),
      },
      cuentaBancaria: { updateMany: bankUpdate },
      reconciliacionVenta: { create: reconciliationCreate },
        prestamoCash: { update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }))

    const { POST } = await import('../route')
    const response = await POST(new NextRequest(
      'http://localhost/api/contabilidad/prestamos-cash/p-1/pagar',
      {
        method: 'POST',
        body: JSON.stringify({ monto: 500, cuentaId: 'cuenta-1', tipoPagoId: 'tp-1' }),
      },
    ), mockContext)

    expect(response.status).toBe(409)
    expect(bankUpdate).not.toHaveBeenCalled()
    expect(reconciliationCreate).not.toHaveBeenCalled()
  })

  it('POST devuelve 404 si préstamo no existe', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.prestamoCash.findFirst.mockResolvedValue(null)

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify({
        monto: 100,
        cuentaId: 'cuenta-1',
        tipoPagoId: 'tp-1'
      })
    })

    const response = await POST(request, mockContext)

    expect(response.status).toBe(404)
  })

  it('POST devuelve 400 si préstamo ya está pagado', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.prestamoCash.findFirst.mockResolvedValue({
      id: 'p-1',
      estado: 'PAGADO',
      cuentaPorCobrar: { montoDeuda: 1000, montoPagado: 1000 }
    })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify({
        monto: 100,
        cuentaId: 'cuenta-1',
        tipoPagoId: 'tp-1'
      })
    })

    const response = await POST(request, mockContext)

    expect(response.status).toBe(400)
  })

  it('POST devuelve 400 si monto excede saldo', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.prestamoCash.findFirst.mockResolvedValue({
      id: 'p-1',
      estado: 'ACTIVO',
      cuentaPorCobrar: { montoDeuda: 1000, montoPagado: 900 }
    })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify({
        monto: 200,
        cuentaId: 'cuenta-1',
        tipoPagoId: 'tp-1'
      })
    })

    const response = await POST(request, mockContext)

    expect(response.status).toBe(400)
  })

  it('POST devuelve 404 si módulo deshabilitado', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH', 'false')

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify({
        monto: 100,
        cuentaId: 'cuenta-1',
        tipoPagoId: 'tp-1'
      })
    })

    const response = await POST(request, mockContext)

    expect(response.status).toBe(404)
  })

  // ── R0.5/R6 fila 14: hook único por origen, referencias tenant-scoped y FX ──

  it('POST registra pago y llama postEvento una vez con valoración desde la fila persistida', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    const mockPrestamo = {
      id: 'p-1',
      tenantId: 'tenant-1',
      clienteId: 'cliente-1',
      estado: 'ACTIVO',
      moneda: 'CUP',
      cuentaPorCobrarId: 'cxc-1',
      cuentaPorCobrar: { montoDeuda: 2000, montoPagado: 0 }
    }
    prisma.prestamoCash.findFirst.mockResolvedValue(mockPrestamo)
    prisma.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'cuenta-1', isActive: true, moneda: 'CUP',
    })
    const recCreate = vi.fn().mockResolvedValue({
      reconciliacionId: 'rec-pago-1',
      monto: 1000,
      moneda: 'CUP',
      montoConvertido: 1000,
      tasaCambio: 1,
      fxEvidenceFingerprint: 'fp-pago-1',
      fechaReconciliacion: new Date('2026-09-25T12:00:00.000Z')
    })
    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        tipoPago: { findFirst: vi.fn().mockResolvedValue({ tipoId: 'tp-1', isActive: true }) },
        reconciliacionVenta: { create: recCreate },
        cuentaBancaria: {
          update: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        },
        cuentaPorCobrar: {
          findFirst: vi.fn().mockResolvedValue({ id: 'cxc-1', montoDeuda: 2000, montoPagado: 0 }),
          update: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        prestamoCash: { update: vi.fn() }
      }
      return callback(tx)
    })

    const { POST } = await import('../route')
    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
        method: 'POST',
        body: JSON.stringify({
          monto: 1000,
          cuentaId: 'cuenta-1',
          tipoPagoId: 'tp-1'
        })
      }),
      mockContext,
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.reconciliacion.reconciliacionId).toBe('rec-pago-1')
    const { postEvento } = await import(
      '@/features/contabilidad-formal/services/posting-engine'
    )
    expect(postEvento).toHaveBeenCalledTimes(1)
    expect(postEvento).toHaveBeenCalledWith(
      expect.anything(),
      { tenantId: 'tenant-1', userId: 'user-test' },
      expect.objectContaining({
        tipo: 'COBRO_PRESTAMO',
        origen: { tipo: 'reconciliacion_venta', id: 'rec-pago-1' },
        monto: 1000,
        montoFuncional: 1000,
        tasaCambio: 1,
        fxEvidenceFingerprint: 'fp-pago-1'
      }),
    )
    // Decisión v1: sin split capital/intereses, no se inventa el desglose.
    const eventoArg = (postEvento as any).mock.calls[0][2]
    expect(eventoArg.monedaFuncional).toBe('CUP')
    expect(eventoArg.auxiliares).toBeUndefined()
  })

  it('POST rechaza préstamo de otro tenant con búsqueda tenant-scoped', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    const mockPrestamoOtroTenant = {
      id: 'p-1',
      tenantId: 'tenant-2',
      estado: 'ACTIVO',
      moneda: 'CUP',
      cuentaPorCobrarId: 'cxc-2',
      cuentaPorCobrar: { montoDeuda: 2000, montoPagado: 0 }
    }
    // Emula aislamiento: el préstamo pertenece a tenant-2; la búsqueda con
    // tenant-1 no lo encuentra. Sin filtro, el canal lo pagaría.
    prisma.prestamoCash.findFirst.mockImplementation(async (args: any) => {
      const where = args?.where ?? {}
      if (where.tenantId && where.tenantId !== 'tenant-2') return null
      return mockPrestamoOtroTenant
    })
    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        reconciliacionVenta: {
          create: vi.fn().mockResolvedValue({
            reconciliacionId: 'rec-x',
            monto: 100,
            moneda: 'CUP',
            montoConvertido: 100,
            tasaCambio: 1,
            fxEvidenceFingerprint: 'fp-x',
            fechaReconciliacion: new Date()
          })
        },
        cuentaBancaria: {
          update: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        },
        cuentaPorCobrar: { update: vi.fn() },
        prestamoCash: { update: vi.fn() }
      }
      return callback(tx)
    })

    const { POST } = await import('../route')
    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
        method: 'POST',
        body: JSON.stringify({
          monto: 100,
          cuentaId: 'cuenta-1',
          tipoPagoId: 'tp-1'
        })
      }),
      mockContext,
    )

    expect(response.status).toBe(404)
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.prestamoCash.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' })
      }),
    )
  })

  it('POST rechaza cuenta bancaria de otro tenant antes de abrir transacción', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.prestamoCash.findFirst.mockResolvedValue({
      id: 'p-1',
      tenantId: 'tenant-1',
      estado: 'ACTIVO',
      moneda: 'CUP',
      cuentaPorCobrarId: 'cxc-1',
      cuentaPorCobrar: { montoDeuda: 2000, montoPagado: 0 }
    })
    // Emula aislamiento: la cuenta pertenece a otro tenant.
    prisma.cuentaBancaria.findFirst.mockResolvedValue(null)
    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        reconciliacionVenta: {
          create: vi.fn().mockResolvedValue({
            reconciliacionId: 'rec-x',
            monto: 100,
            moneda: 'CUP',
            montoConvertido: 100,
            tasaCambio: 1,
            fxEvidenceFingerprint: 'fp-x',
            fechaReconciliacion: new Date()
          })
        },
        cuentaBancaria: {
          update: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        },
        cuentaPorCobrar: { update: vi.fn() },
        prestamoCash: { update: vi.fn() }
      }
      return callback(tx)
    })

    const { POST } = await import('../route')
    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
        method: 'POST',
        body: JSON.stringify({
          monto: 100,
          cuentaId: 'cuenta-otra',
          tipoPagoId: 'tp-1'
        })
      }),
      mockContext,
    )

    expect(response.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.cuentaBancaria.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' })
      }),
    )
  })

  it('POST FX extranjera sin tasa falla cerrada antes de abrir transacción', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.prestamoCash.findFirst.mockResolvedValue({
      id: 'p-1',
      tenantId: 'tenant-1',
      estado: 'ACTIVO',
      moneda: 'USD',
      cuentaPorCobrarId: 'cxc-1',
      cuentaPorCobrar: { montoDeuda: 2000, montoPagado: 0 }
    })
    prisma.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cuenta-1', isActive: true })
    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        reconciliacionVenta: {
          create: vi.fn().mockResolvedValue({
            reconciliacionId: 'rec-usd',
            monto: 1000,
            moneda: 'USD',
            fechaReconciliacion: new Date()
          })
        },
        cuentaBancaria: {
          update: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        },
        cuentaPorCobrar: { update: vi.fn() },
        prestamoCash: { update: vi.fn() }
      }
      return callback(tx)
    })

    const { POST } = await import('../route')
    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
        method: 'POST',
        body: JSON.stringify({
          monto: 1000,
          cuentaId: 'cuenta-1',
          tipoPagoId: 'tp-1',
          moneda: 'USD'
        })
      }),
      mockContext,
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('FX_INSUFICIENTE')
  })

  it('POST valora el pago USD en MLC funcional y acredita la cuenta en MLC', async () => {
    functionalCurrencyMock.mockResolvedValue({ functionalCurrencyCode: 'MLC' })
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.prestamoCash.findFirst.mockResolvedValue({
      id: 'p-1',
      tenantId: 'tenant-1',
      clienteId: 'cliente-1',
      estado: 'ACTIVO',
      moneda: 'USD',
      cuentaPorCobrarId: 'cxc-1',
      cuentaPorCobrar: { montoDeuda: 100, montoPagado: 0 },
    })
    prisma.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'cuenta-1',
      isActive: true,
      moneda: 'MLC',
    })

    const reconciliationCreate = vi.fn().mockResolvedValue({
      reconciliacionId: 'rec-mlc',
      monto: new Prisma.Decimal(10),
      moneda: 'USD',
      montoConvertido: new Prisma.Decimal(25),
      tasaCambio: new Prisma.Decimal(2.5),
      fxEvidenceFingerprint: 'fp-mlc',
      fechaReconciliacion: new Date('2026-10-05T12:00:00.000Z'),
    })
    const bankUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
    const cxcUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
    prisma.$transaction.mockImplementation(async (callback: any) => callback({
      $queryRaw: vi.fn().mockResolvedValue([]),
      tipoPago: { findFirst: vi.fn().mockResolvedValue({ tipoId: 'tp-1' }) },
      reconciliacionVenta: { create: reconciliationCreate },
      cuentaBancaria: { updateMany: bankUpdateMany },
      cuentaPorCobrar: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'cxc-1',
          montoDeuda: 100,
          montoPagado: 0,
          estado: 'PENDIENTE',
          monedaOriginal: 'USD',
        }),
        updateMany: cxcUpdateMany,
      },
      prestamoCash: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }))

    const { POST } = await import('../route')
    const response = await POST(new NextRequest(
      'http://localhost/api/contabilidad/prestamos-cash/p-1/pagar',
      {
        method: 'POST',
        body: JSON.stringify({
          monto: 10,
          moneda: 'USD',
          tasaCambio: 2.5,
          cuentaId: 'cuenta-1',
          tipoPagoId: 'tp-1',
        }),
      },
    ), mockContext)

    expect(response.status).toBe(201)
    expect(functionalCurrencyMock).toHaveBeenCalledWith('tenant-1', expect.anything())
    expect(reconciliationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        montoCuenta: expect.objectContaining({ d: expect.any(Array) }),
        monedaCuenta: 'MLC',
        montoConvertido: expect.objectContaining({ d: expect.any(Array) }),
        moneda: 'USD',
        monto: 10,
      }),
    }))
    expect(bankUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ moneda: 'MLC' }),
      data: { saldo: { increment: 25 } },
    }))
    expect(String(cxcUpdateMany.mock.calls[0][0].data.montoPagado)).toBe('10')
    const { postEvento } = await import('@/features/contabilidad-formal/services/posting-engine')
    const eventoArg = (postEvento as any).mock.calls[0][2]
    // F1: la moneda funcional y el Decimal persistidos llegan intactos al evento.
    expect(eventoArg.monedaFuncional).toBe('MLC')
    expect(eventoArg.montoFuncional).toBeInstanceOf(Prisma.Decimal)
    expect(eventoArg.montoFuncional.toString()).toBe('25')
    expect(eventoArg.tasaCambio.toString()).toBe('2.5')
  })
})
