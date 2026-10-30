import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('@/features/contabilidad/services/period-close-write-guard', () => ({
  guardAccountingWriteInTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    gastosDE: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    pagosalario: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    gastoCompra: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    reconciliacionGasto: {
      findFirst: vi.fn()
    },
    cuentaBancaria: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn()
}))

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@/lib/services/validate-period-write', () => ({
  validarEscrituraPeriodo: vi.fn(),
  extraerFechaDeBody: vi.fn().mockReturnValue(new Date()),
}))

/**
 * @description Crea un cliente transaccional mínimo para ejecutar el workflow real desde la ruta.
 * @param {Record<string, unknown>} overrides - Métodos a sobreescribir para cada prueba.
 * @returns {Record<string, unknown>} Mock transaccional de Prisma.
 */
function createTxMock(overrides: Record<string, unknown> = {}) {
  const baseTx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    tipoPago: {
      findUnique: vi.fn(),
      findFirst: vi.fn()
    },
    cuentaBancaria: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    reconciliacionGasto: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    cuentaPorPagar: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    pagoCuentaPorPagar: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    transaccionMoneda: {
      create: vi.fn()
    },
    compraProducto: {
      updateMany: vi.fn()
    },
    gastosDE: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    gastoCompra: {
      findFirst: vi.fn()
    },
    compraServicio: {
      findFirst: vi.fn()
    },
    pagosalario: {
      findFirst: vi.fn()
    },
    ventaServicios: {
      findFirst: vi.fn()
    }
  }

  return {
    ...baseTx,
    ...overrides
  }
}

describe('Reconciliacion gastos API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registra reconciliacion PAGADA para gasto DE sin CxP', async () => {
    const { POST } = await import('../route')
    const prisma = (await import('@/lib/prisma')).default as any
    const { authenticateUser } = await import('@/lib/auth-middleware')
    const { validarEscrituraPeriodo } = await import('@/lib/services/validate-period-write')

    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true, modo: 'enforce' })
    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-1', tenantId: 't1' } } as any)
    vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue({
      gastosDEId: 'gde-1'
    })
    vi.mocked(prisma.reconciliacionGasto.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue({
      cuentaId: 'cb-1',
      moneda: 'CUP'
    })

    const tx = createTxMock()
    vi.mocked(tx.tipoPago.findUnique).mockResolvedValue({
      tipoId: 'tp-1',
      isActive: true,
      cuentaDefecto: null
    } as any)
    vi.mocked(tx.cuentaBancaria.findFirst).mockResolvedValue({
      cuentaId: 'cb-1',
      isActive: true
    } as any)
    vi.mocked(tx.reconciliacionGasto.findFirst).mockResolvedValue(null)
    vi.mocked(tx.cuentaBancaria.findMany).mockResolvedValue([
      { cuentaId: 'cb-1', moneda: 'CUP', saldo: 1000, isActive: true }
    ] as any)
    vi.mocked(tx.reconciliacionGasto.create).mockResolvedValue({
      reconciliacionId: 'rec-1',
      cuentaId: 'cb-1',
      monto: 120,
      moneda: 'CUP',
      montoConvertido: 120,
      descripcion: 'Pago directo'
    } as any)
    vi.mocked(tx.gastosDE.findFirst).mockResolvedValue({
      tenantId: 't1',
      isPagado: null,
    } as any)
    vi.mocked(tx.gastosDE.update).mockResolvedValue({} as any)
    vi.mocked(tx.cuentaBancaria.updateMany).mockResolvedValue({ count: 1 } as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))

    const request = new NextRequest('http://localhost/api/contabilidad/reconciliacion/gastos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tipoGasto: 'gastoDE',
        gastosDEId: 'gde-1',
        cuentaId: 'cb-1',
        tipoPagoId: 'tp-1',
        monto: 120,
        moneda: 'CUP',
        descripcion: 'Pago directo',
        estado: 'PAGADA'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.reconciliaciones).toHaveLength(1)
    expect(data.cuentaPorPagar).toBeNull()
    expect(tx.reconciliacionGasto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'PAGADA',
          tipoGasto: 'gastoDE'
        })
      })
    )
    expect(tx.gastosDE.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gastosDEId: 'gde-1' },
        data: { isPagado: 'pagado' }
      })
    )
  })

  it('registra reconciliacion PARCIAL cuando CxP queda con saldo', async () => {
    const { POST } = await import('../route')
    const prisma = (await import('@/lib/prisma')).default as any
    const { authenticateUser } = await import('@/lib/auth-middleware')
    const { validarEscrituraPeriodo } = await import('@/lib/services/validate-period-write')

    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true, modo: 'enforce' })
    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-2', tenantId: 't1' } } as any)
    vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue({
      gastosDEId: 'gde-2'
    })
    vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue({
      cuentaId: 'cb-2',
      moneda: 'CUP'
    })

    const tx = createTxMock()
    vi.mocked(tx.tipoPago.findUnique).mockResolvedValue({
      tipoId: 'tp-2',
      isActive: true,
      cuentaDefecto: null
    } as any)
    vi.mocked(tx.cuentaBancaria.findFirst).mockResolvedValue({
      cuentaId: 'cb-2',
      isActive: true
    } as any)
    vi.mocked(tx.cuentaPorPagar.findFirst).mockResolvedValue({
      cuentaPorPagarId: 'cxp-2',
      montoDeuda: 100,
      montoPagado: 0,
      saldoPendiente: 100
    } as any)
    vi.mocked(tx.cuentaPorPagar.findUnique).mockResolvedValue({
      cuentaPorPagarId: 'cxp-2',
      estado: 'PENDIENTE',
      montoDeuda: 100,
      montoPagado: 0,
      saldoPendiente: 100,
      gastoCompraId: null,
      proveedor: { cuentaCUP: '9200-123', cuentaUSD: null }
    } as any)
    vi.mocked(tx.pagoCuentaPorPagar.findFirst).mockResolvedValue(null)
    vi.mocked(tx.cuentaBancaria.findMany).mockResolvedValue([
      { cuentaId: 'cb-2', moneda: 'CUP', saldo: 1000, isActive: true }
    ] as any)
    vi.mocked(tx.reconciliacionGasto.create).mockResolvedValue({
      reconciliacionId: 'rec-2',
      cuentaId: 'cb-2',
      monto: 40,
      moneda: 'CUP',
      montoConvertido: 40,
      descripcion: 'Pago parcial'
    } as any)
    vi.mocked(tx.cuentaBancaria.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(tx.gastosDE.findFirst).mockResolvedValue({
      tenantId: 't1',
      isPagado: null,
    } as any)
    vi.mocked(tx.cuentaPorPagar.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(tx.cuentaPorPagar.update).mockResolvedValue({
      cuentaPorPagarId: 'cxp-2',
      estado: 'PARCIAL',
      montoPagado: 40,
      saldoPendiente: 60
    } as any)
    vi.mocked(tx.pagoCuentaPorPagar.create).mockResolvedValue({
      pagoCuentaPorPagarId: 'pago-2',
      numeroTransaccion: 'TRX-2',
      monto: 40
    } as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))

    const request = new NextRequest('http://localhost/api/contabilidad/reconciliacion/gastos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tipoGasto: 'gastoDE',
        gastosDEId: 'gde-2',
        cuentaId: 'cb-2',
        tipoPagoId: 'tp-2',
        monto: 40,
        moneda: 'CUP',
        descripcion: 'Pago parcial',
        estado: 'PAGADA',
        cuentaPorPagarId: 'cxp-2',
        numeroTransaccion: 'TRX-2'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.cuentaPorPagar.estado).toBe('PARCIAL')
    expect(data.pagoCuentaPorPagar.numeroTransaccion).toBe('TRX-2')
    expect(tx.reconciliacionGasto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'PARCIAL',
          cuentaPorPagarId: 'cxp-2'
        })
      })
    )
    expect(tx.gastosDE.update).not.toHaveBeenCalled()
  })

  it('retorna 409 cuando numeroTransaccion ya existe en la CxP', async () => {
    const { POST } = await import('../route')
    const prisma = (await import('@/lib/prisma')).default as any
    const { authenticateUser } = await import('@/lib/auth-middleware')
    const { validarEscrituraPeriodo } = await import('@/lib/services/validate-period-write')

    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true, modo: 'enforce' })
    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-3', tenantId: 't1' } } as any)
    vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue({
      gastosDEId: 'gde-3'
    })
    vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue({
      cuentaId: 'cb-3',
      moneda: 'CUP'
    })

    const tx = createTxMock()
    vi.mocked(tx.tipoPago.findUnique).mockResolvedValue({
      tipoId: 'tp-3',
      isActive: true,
      cuentaDefecto: null
    } as any)
    vi.mocked(tx.cuentaBancaria.findFirst).mockResolvedValue({
      cuentaId: 'cb-3',
      isActive: true
    } as any)
    vi.mocked(tx.cuentaPorPagar.findFirst).mockResolvedValue({
      cuentaPorPagarId: 'cxp-3',
      montoDeuda: 100,
      montoPagado: 0,
      saldoPendiente: 100
    } as any)
    vi.mocked(tx.cuentaPorPagar.findUnique).mockResolvedValue({
      cuentaPorPagarId: 'cxp-3',
      estado: 'PENDIENTE',
      montoDeuda: 100,
      montoPagado: 0,
      saldoPendiente: 100,
      gastoCompraId: null,
      proveedor: { cuentaCUP: '9200-999', cuentaUSD: null }
    } as any)
    vi.mocked(tx.pagoCuentaPorPagar.findFirst).mockResolvedValue({
      pagoCuentaPorPagarId: 'pago-existente'
    } as any)
    vi.mocked(tx.gastosDE.findFirst).mockResolvedValue({
      tenantId: 't1',
      isPagado: null,
    } as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))

    const request = new NextRequest('http://localhost/api/contabilidad/reconciliacion/gastos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tipoGasto: 'gastoDE',
        gastosDEId: 'gde-3',
        cuentaId: 'cb-3',
        tipoPagoId: 'tp-3',
        monto: 20,
        moneda: 'CUP',
        descripcion: 'Pago duplicado',
        estado: 'PAGADA',
        cuentaPorPagarId: 'cxp-3',
        numeroTransaccion: 'TRX-DUP'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.code).toBe('DUPLICADO_TRANSACCION')
    expect(tx.reconciliacionGasto.create).not.toHaveBeenCalled()
  })

  it('retorna 400 PERIODO_CERRADO cuando el período está cerrado', async () => {
    const { POST } = await import('../route')
    const { authenticateUser } = await import('@/lib/auth-middleware')
    const { validarEscrituraPeriodo } = await import('@/lib/services/validate-period-write')

    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({
      permitido: false,
      modo: 'enforce',
      error: { message: 'Período contable cerrado', code: 'PERIODO_CERRADO' },
    })
    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-4', tenantId: 't1' } } as any)

    const request = new NextRequest('http://localhost/api/contabilidad/reconciliacion/gastos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tipoGasto: 'gastoDE',
        gastosDEId: 'gde-4',
        cuentaId: 'cb-4',
        tipoPagoId: 'tp-4',
        monto: 50,
        moneda: 'CUP',
        descripcion: 'Pago en periodo cerrado',
        estado: 'PAGADA',
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('PERIODO_CERRADO')
    // Verificar que el workflow no se ejecutó
    const prisma = (await import('@/lib/prisma')).default as any
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('GET filtra gastos pendientes por tenantId', async () => {
    const { GET } = await import('../route')
    const prisma = (await import('@/lib/prisma')).default as any
    const { authenticateUser } = await import('@/lib/auth-middleware')

    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-5', tenantId: 'tenant-abc' } } as any)
    vi.mocked(prisma.pagosalario.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.gastosDE.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([] as any)

    const request = new NextRequest('http://localhost/api/contabilidad/reconciliacion/gastos')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.pagosalario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-abc' }),
      }),
    )
    expect(prisma.gastosDE.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-abc' }),
      }),
    )
    expect(prisma.gastoCompra.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-abc' }),
      }),
    )
  })
})
