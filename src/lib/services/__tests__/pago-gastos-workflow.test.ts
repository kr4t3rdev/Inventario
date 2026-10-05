import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@/generated/prisma'

import {
  applyPagoGastoWorkflow,
  isGastoWorkflowError
} from '@/lib/services/pago-gastos-workflow'

const { postEventoMock } = vi.hoisted(() => ({ postEventoMock: vi.fn() }))
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
  postEvento: postEventoMock,
}))

/**
 * @description Crea un mock transaccional mínimo para probar el workflow de pagos de gastos.
 * @returns {Record<string, any>} Objeto con los métodos transaccionales simulados.
 */
function createTxMock() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    auditLog: {
      create: vi.fn().mockResolvedValue({ auditId: 'audit-1' })
    },
    tenantAccountingPolicy: {
      findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' })
    },
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
      findFirst: vi.fn().mockResolvedValue({ tenantId: 'tenant-1', isPagado: 'pendiente' }),
      update: vi.fn()
    },
    gastoCompra: { findFirst: vi.fn().mockResolvedValue({ tenantId: 'tenant-1', deletedAt: null }) },
    compraServicio: { findFirst: vi.fn().mockResolvedValue({ tenantId: 'tenant-1', estado: 'RECIBIDO' }) },
    ventaServicios: { findFirst: vi.fn().mockResolvedValue({ tenantId: 'tenant-1' }) },
    pagosalario: {
      findFirst: vi.fn().mockResolvedValue({ tenantId: 'tenant-1' })
    }
  }
}

describe('pago-gastos-workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marca gasto DE como pagado cuando es pago directo sin CxP', async () => {
    const tx = createTxMock()
    tx.tipoPago.findFirst.mockResolvedValue({
      tipoId: 'tp-1',
      isActive: true,
      cuentaDefecto: 'cb-1'
    })
    tx.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'cb-1',
      isActive: true
    })
    tx.reconciliacionGasto.findFirst.mockResolvedValue(null)
    tx.cuentaBancaria.findMany.mockResolvedValue([
      {
        cuentaId: 'cb-1',
        moneda: 'CUP',
        saldo: 1000,
        isActive: true
      }
    ])
    tx.reconciliacionGasto.create.mockResolvedValue({
      reconciliacionId: 'rec-1',
      cuentaId: 'cb-1',
      monto: 120,
      moneda: 'CUP',
      montoConvertido: 120,
      descripcion: 'Pago servicio'
    })
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 })
    tx.gastosDE.update.mockResolvedValue({})

    const result = await applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'gastoDE',
      referenciaId: 'gde-1',
      gastosDEId: 'gde-1',
      reconciliadoPor: 'user-1',
      tenantId: 'tenant-1',
      descripcion: 'Pago servicio',
      monto: 120,
      moneda: 'CUP',
      periodo: '2026-08',
      fechaPago: '2026-08-31T18:00:00.000Z'
    })

    expect(result.cuentaPorPagar).toBeNull()
    expect(result.pagoCuentaPorPagar).toBeNull()
    expect(tx.gastosDE.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gastosDEId: 'gde-1' },
        data: { isPagado: 'pagado' }
      })
    )
    expect(tx.cuentaPorPagar.update).not.toHaveBeenCalled()
    expect(tx.reconciliacionGasto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          periodo: '2026-08',
          fechaReconciliacion: new Date('2026-08-31T18:00:00.000Z'),
        }),
      }),
    )
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        entidad: 'RECONCILIACION',
        entidadId: 'rec-1',
        usuarioId: 'user-1'
      })
    }))
  })

  it('no genera asiento ni descuenta banco mientras la reconciliación sigue pendiente', async () => {
    const tx = createTxMock()
    tx.tipoPago.findFirst.mockResolvedValue({
      tipoId: 'tp-1', isActive: true, cuentaDefecto: 'cb-1'
    })
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cb-1', isActive: true })
    tx.reconciliacionGasto.findFirst.mockResolvedValue(null)
    tx.cuentaBancaria.findMany.mockResolvedValue([
      { cuentaId: 'cb-1', moneda: 'CUP', saldo: 1000, isActive: true }
    ])
    tx.reconciliacionGasto.create.mockResolvedValue({
      reconciliacionId: 'rec-pending', cuentaId: 'cb-1', monto: 120,
      moneda: 'CUP', montoConvertido: 120, descripcion: 'Pendiente'
    })

    const result = await applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'gastoDE', referenciaId: 'gde-pending', gastosDEId: 'gde-pending',
      reconciliadoPor: 'user-1', tenantId: 'tenant-1', descripcion: 'Pendiente',
      monto: 120, moneda: 'CUP', estado: 'PENDIENTE'
    })

    expect(result.reconciliaciones).toHaveLength(1)
    expect(tx.reconciliacionGasto.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ estado: 'PENDIENTE' })
    }))
    expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled()
    expect(postEventoMock).not.toHaveBeenCalled()
  })

  it('rechaza moneda extranjera sin una conversión válida a CUP', async () => {
    const tx = createTxMock()
    tx.tipoPago.findFirst.mockResolvedValue({
      tipoId: 'tp-1',
      isActive: true,
      cuentaDefecto: 'cb-usd'
    })
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cb-usd', isActive: true })
    tx.reconciliacionGasto.findFirst.mockResolvedValue(null)
    tx.cuentaBancaria.findMany.mockResolvedValue([
      { cuentaId: 'cb-usd', moneda: 'USD', saldo: 1000, isActive: true }
    ])
    tx.reconciliacionGasto.create.mockResolvedValue({
      reconciliacionId: 'rec-usd',
      cuentaId: 'cb-usd',
      monto: 100,
      moneda: 'USD',
      montoConvertido: 100,
      descripcion: 'Pago USD'
    })
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 })
    tx.gastosDE.update.mockResolvedValue({})

    await expect(applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'gastoDE',
      referenciaId: 'gde-usd',
      gastosDEId: 'gde-usd',
      reconciliadoPor: 'user-1',
      tenantId: 'tenant-1',
      descripcion: 'Pago USD',
      monto: 100,
      moneda: 'USD'
    })).rejects.toMatchObject({ code: 'CONVERSION_REQUERIDA', status: 400 })

    expect(tx.reconciliacionGasto.create).not.toHaveBeenCalled()
  })

  it('persiste en CUP el importe extranjero convertido una sola vez', async () => {
    const tx = createTxMock()
    tx.tipoPago.findFirst.mockResolvedValue({
      tipoId: 'tp-1',
      isActive: true,
      cuentaDefecto: 'cb-usd'
    })
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cb-usd', isActive: true })
    tx.reconciliacionGasto.findFirst.mockResolvedValue(null)
    tx.cuentaBancaria.findMany.mockResolvedValue([
      { cuentaId: 'cb-usd', moneda: 'USD', saldo: 1000, isActive: true }
    ])
    tx.reconciliacionGasto.create.mockResolvedValue({
      reconciliacionId: 'rec-usd',
      cuentaId: 'cb-usd',
      monto: 100,
      moneda: 'USD',
      montoConvertido: 2450,
      descripcion: 'Pago USD'
    })
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 })
    tx.gastosDE.update.mockResolvedValue({})

    await applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'gastoDE',
      referenciaId: 'gde-usd',
      gastosDEId: 'gde-usd',
      reconciliadoPor: 'user-1',
      tenantId: 'tenant-1',
      descripcion: 'Pago USD',
      monto: 100,
      moneda: 'USD',
      tasaCambio: 24.5,
      fechaPago: '2026-08-19T12:00:00.000Z'
    })

    expect(tx.reconciliacionGasto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          monto: 100,
          moneda: 'USD',
          tasaCambio: 24.5,
          montoConvertido: 2450
        })
      })
    )
  })

  it('usa la moneda funcional tenant-scoped en vez de asumir CUP', async () => {
    const tx = createTxMock()
    tx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'MLC' })
    tx.tipoPago.findFirst.mockResolvedValue({
      tipoId: 'tp-1', isActive: true, cuentaDefecto: 'cb-mlc'
    })
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cb-mlc', isActive: true })
    tx.reconciliacionGasto.findFirst.mockResolvedValue(null)
    tx.cuentaBancaria.findMany.mockResolvedValue([
      { cuentaId: 'cb-mlc', moneda: 'MLC', saldo: 5000, isActive: true }
    ])
    tx.reconciliacionGasto.create.mockResolvedValue({
      reconciliacionId: 'rec-mlc', cuentaId: 'cb-mlc', monto: 100,
      moneda: 'USD', montoConvertido: 250, descripcion: 'Pago MLC'
    })
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 })

    await applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'gastoDE', referenciaId: 'gde-mlc', gastosDEId: 'gde-mlc',
      reconciliadoPor: 'user-1', tenantId: 'tenant-1', descripcion: 'Pago MLC',
      monto: 100, moneda: 'USD', tasaCambio: 2.5,
      fechaPago: '2026-08-19T12:00:00.000Z'
    })

    expect(tx.tenantAccountingPolicy.findUnique).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      select: { functionalCurrencyCode: true }
    })
    expect(tx.reconciliacionGasto.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ functionalCurrency: 'MLC', montoConvertido: 250 })
    }))
  })

  it('falla cerrado si falta la política monetaria funcional del tenant', async () => {
    const tx = createTxMock()
    tx.tenantAccountingPolicy.findUnique.mockResolvedValue(null)

    await expect(applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'gastoDE', referenciaId: 'gde-no-policy', gastosDEId: 'gde-no-policy',
      reconciliadoPor: 'user-1', tenantId: 'tenant-1', descripcion: 'Pago',
      monto: 100, moneda: 'CUP'
    })).rejects.toMatchObject({ code: 'POLITICA_MONETARIA_REQUERIDA', status: 400 })

    expect(tx.reconciliacionGasto.create).not.toHaveBeenCalled()
  })

  it('rechaza moneda bancaria tercera si no hay cotización para el pago', async () => {
    const tx = createTxMock()
    tx.tipoPago.findFirst.mockResolvedValue({
      tipoId: 'tp-1', isActive: true, cuentaDefecto: 'cb-eur'
    })
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cb-eur', isActive: true })
    tx.reconciliacionGasto.findFirst.mockResolvedValue(null)
    tx.cuentaBancaria.findMany.mockResolvedValue([
      { cuentaId: 'cb-eur', moneda: 'EUR', saldo: 5000, isActive: true }
    ])

    await expect(applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'gastoDE', referenciaId: 'gde-eur', gastosDEId: 'gde-eur',
      reconciliadoPor: 'user-1', tenantId: 'tenant-1', descripcion: 'Pago EUR',
      monto: 100, moneda: 'USD', tasaCambio: 24,
      fechaPago: '2026-08-19T12:00:00.000Z'
    })).rejects.toMatchObject({ code: 'FX_CUENTA_INSUFICIENTE', status: 400 })

    expect(tx.reconciliacionGasto.create).not.toHaveBeenCalled()
    expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled()
  })

  it('persiste evidencia FX inmutable en reconciliaciones extranjeras', async () => {
    const tx = createTxMock()
    tx.tipoPago.findFirst.mockResolvedValue({
      tipoId: 'tp-1',
      isActive: true,
      cuentaDefecto: 'cb-usd'
    })
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cb-usd', isActive: true })
    tx.reconciliacionGasto.findFirst.mockResolvedValue(null)
    tx.cuentaBancaria.findMany.mockResolvedValue([
      { cuentaId: 'cb-usd', moneda: 'USD', saldo: 1000, isActive: true }
    ])
    tx.reconciliacionGasto.create.mockResolvedValue({
      reconciliacionId: 'rec-usd-fx',
      cuentaId: 'cb-usd',
      monto: 100,
      moneda: 'USD',
      montoConvertido: 2450,
      descripcion: 'Pago USD'
    })
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 })
    tx.gastosDE.update.mockResolvedValue({})

    await applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'gastoDE',
      referenciaId: 'gde-usd',
      gastosDEId: 'gde-usd',
      reconciliadoPor: 'user-1',
      tenantId: 'tenant-1',
      descripcion: 'Pago USD',
      monto: 100,
      moneda: 'USD',
      tasaCambio: 24.5,
      fechaPago: '2026-08-19T12:00:00.000Z'
    })

    const data = tx.reconciliacionGasto.create.mock.calls[0]?.[0]?.data
    expect(data.functionalCurrency).toBe('CUP')
    expect(data.fxProvenanceKind).toBe('MANUAL_GOVERNED')
    expect(data.fxProvenanceSource).toBe('pago-gastos-workflow')
    expect(data.rateEffectiveAt).toEqual(new Date('2026-08-19T12:00:00.000Z'))
    expect(data.fxEvidenceVersion).toBe(1)
    expect(data.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('para CxP parcial crea reconciliacion PARCIAL y no marca gasto DE como pagado', async () => {
    const tx = createTxMock()
    tx.tipoPago.findFirst.mockResolvedValue({
      tipoId: 'tp-1',
      isActive: true,
      cuentaDefecto: 'cb-1'
    })
    tx.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'cb-1',
      isActive: true
    })
    tx.cuentaPorPagar.findFirst.mockResolvedValue({
      cuentaPorPagarId: 'cxp-1',
      estado: 'PENDIENTE',
      montoDeuda: 100,
      montoPagado: 0,
      saldoPendiente: 100,
      gastoCompraId: null,
      gastosDEId: 'gde-2',
      proveedor: {
        cuentaCUP: '123456',
        cuentaUSD: null
      }
    })
    tx.pagoCuentaPorPagar.findFirst.mockResolvedValue(null)
    tx.cuentaBancaria.findMany.mockResolvedValue([
      {
        cuentaId: 'cb-1',
        moneda: 'CUP',
        saldo: 1000,
        isActive: true
      }
    ])
    tx.reconciliacionGasto.create.mockResolvedValue({
      reconciliacionId: 'rec-2',
      cuentaId: 'cb-1',
      monto: 40,
      moneda: 'CUP',
      montoConvertido: 40,
      descripcion: 'Pago parcial'
    })
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 })
    tx.cuentaPorPagar.updateMany.mockResolvedValue({ count: 1 })
    tx.pagoCuentaPorPagar.create.mockResolvedValue({
      pagoCuentaPorPagarId: 'pago-1',
      numeroTransaccion: 'TRX-1',
      monto: 40
    })

    const result = await applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'gastoDE',
      referenciaId: 'gde-2',
      gastosDEId: 'gde-2',
      reconciliadoPor: 'user-1',
      tenantId: 'tenant-1',
      descripcion: 'Pago parcial',
      monto: 40,
      moneda: 'CUP',
      cuentaPorPagarId: 'cxp-1',
      numeroTransaccion: 'TRX-1',
      cuentaProveedor: '123456',
      estado: 'PAGADA'
    })

    expect(result.cuentaPorPagar?.estado).toBe('PARCIAL')
    expect(tx.reconciliacionGasto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'PARCIAL'
        })
      })
    )
    expect(tx.gastosDE.update).not.toHaveBeenCalled()
  })

  it('rechaza numero de transaccion duplicado en la misma CxP', async () => {
    const tx = createTxMock()
    tx.tipoPago.findFirst.mockResolvedValue({
      tipoId: 'tp-1',
      isActive: true,
      cuentaDefecto: 'cb-1'
    })
    tx.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'cb-1',
      isActive: true
    })
    tx.cuentaPorPagar.findFirst.mockResolvedValue({
      cuentaPorPagarId: 'cxp-1',
      estado: 'PENDIENTE',
      montoDeuda: 100,
      montoPagado: 0,
      saldoPendiente: 100,
      gastoCompraId: null,
      proveedor: {
        cuentaCUP: '123456',
        cuentaUSD: null
      }
    })
    tx.pagoCuentaPorPagar.findFirst.mockResolvedValue({
      pagoCuentaPorPagarId: 'pago-duplicado'
    })

    try {
      await applyPagoGastoWorkflow(tx as any, {
        tipoGasto: 'gastoDE',
        referenciaId: 'gde-3',
        gastosDEId: 'gde-3',
        reconciliadoPor: 'user-1',
        tenantId: 'tenant-1',
        descripcion: 'Pago duplicado',
        monto: 20,
        moneda: 'CUP',
        cuentaPorPagarId: 'cxp-1',
        numeroTransaccion: 'TRX-REP'
      })
      expect.unreachable('Se esperaba error por transacción duplicada')
    } catch (error) {
      expect(isGastoWorkflowError(error)).toBe(true)
      if (isGastoWorkflowError(error)) {
        expect(error.code).toBe('DUPLICADO_TRANSACCION')
        expect(error.status).toBe(409)
      }
    }
  })

  it('marca CxP como PAGADA y actualiza compra al cubrir el saldo total', async () => {
    const tx = createTxMock()
    tx.tipoPago.findFirst.mockResolvedValue({
      tipoId: 'tp-1',
      isActive: true,
      cuentaDefecto: 'cb-1'
    })
    tx.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'cb-1',
      isActive: true
    })
    tx.cuentaPorPagar.findFirst.mockResolvedValue({
      cuentaPorPagarId: 'cxp-2',
      estado: 'PENDIENTE',
      montoDeuda: 100,
      montoPagado: 0,
      saldoPendiente: 100,
      gastoCompraId: 'gc-10',
      gastosDEId: null,
      proveedor: {
        cuentaCUP: '123456',
        cuentaUSD: null
      }
    })
    tx.pagoCuentaPorPagar.findFirst.mockResolvedValue(null)
    tx.cuentaBancaria.findMany.mockResolvedValue([
      {
        cuentaId: 'cb-1',
        moneda: 'CUP',
        saldo: 1000,
        isActive: true
      }
    ])
    tx.reconciliacionGasto.create.mockResolvedValue({
      reconciliacionId: 'rec-3',
      cuentaId: 'cb-1',
      monto: 100,
      moneda: 'CUP',
      montoConvertido: 100,
      descripcion: 'Pago total'
    })
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 })
    tx.cuentaPorPagar.updateMany.mockResolvedValue({ count: 1 })
    tx.pagoCuentaPorPagar.create.mockResolvedValue({
      pagoCuentaPorPagarId: 'pago-2',
      numeroTransaccion: 'TRX-TOTAL',
      monto: 100
    })
    tx.compraProducto.updateMany.mockResolvedValue({ count: 1 })

    const result = await applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'compra',
      referenciaId: 'gc-10',
      reconciliadoPor: 'user-1',
      tenantId: 'tenant-1',
      descripcion: 'Pago total',
      monto: 100,
      moneda: 'CUP',
      cuentaPorPagarId: 'cxp-2',
      numeroTransaccion: 'TRX-TOTAL'
    })

    expect(result.cuentaPorPagar?.estado).toBe('PAGADA')
    expect(result.cuentaPorPagar?.saldoPendiente).toBe(0)
    expect(tx.compraProducto.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { estado: 'PAGADA' }
      })
    )
  })

  it('permite CxP de servicio cuando la relación al documento y tenant coinciden', async () => {
    const tx = createTxMock()
    tx.compraServicio.findFirst.mockResolvedValue({
      tenantId: 'tenant-1',
      estado: 'RECIBIDO',
      numeroFactura: 'SVC-001',
    })
    tx.tipoPago.findFirst.mockResolvedValue({ tipoId: 'tp-1', isActive: true, cuentaDefecto: 'cb-1' })
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cb-1', isActive: true })
    tx.cuentaPorPagar.findFirst
      .mockResolvedValueOnce({ cuentaPorPagarId: 'cxp-svc' })
      .mockResolvedValueOnce({
        cuentaPorPagarId: 'cxp-svc',
        estado: 'PENDIENTE',
        montoDeuda: 100,
        montoPagado: 0,
        saldoPendiente: 100,
        gastoCompraId: null,
        gastosDEId: null,
        proveedor: { cuentaCUP: '123', cuentaUSD: null },
      })
    tx.pagoCuentaPorPagar.findFirst.mockResolvedValue(null)
    tx.cuentaBancaria.findMany.mockResolvedValue([{ cuentaId: 'cb-1', moneda: 'CUP', saldo: 500, isActive: true }])
    tx.reconciliacionGasto.create.mockResolvedValue({
      reconciliacionId: 'rec-svc', cuentaId: 'cb-1', monto: 100, moneda: 'CUP', montoConvertido: 100, descripcion: 'Servicio',
    })
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 })
    tx.cuentaPorPagar.updateMany.mockResolvedValue({ count: 1 })
    tx.pagoCuentaPorPagar.create.mockResolvedValue({ pagoCuentaPorPagarId: 'pago-svc', numeroTransaccion: 'rec-svc', monto: 100 })

    const result = await applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'servicio', referenciaId: 'svc-1', tenantId: 'tenant-1', cuentaPorPagarId: 'cxp-svc',
      reconciliadoPor: 'user-1', descripcion: 'Servicio', monto: 100, moneda: 'CUP',
    })

    expect(result.cuentaPorPagar?.cuentaPorPagarId).toBe('cxp-svc')
    expect(tx.cuentaPorPagar.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ compraServicioId: 'svc-1', tenantId: 'tenant-1' }),
    }))
  })

  it('FX-3: persiste el snapshot de cuenta nativa en CUP para un pago CUP', async () => {
    const tx = createTxMock()
    tx.tipoPago.findFirst.mockResolvedValue({ tipoId: 'tp-1', isActive: true, cuentaDefecto: 'cb-1' })
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cb-1', isActive: true })
    tx.reconciliacionGasto.findFirst.mockResolvedValue(null)
    tx.cuentaBancaria.findMany.mockResolvedValue([
      { cuentaId: 'cb-1', moneda: 'CUP', saldo: 1000, isActive: true }
    ])
    tx.reconciliacionGasto.create.mockResolvedValue({ reconciliacionId: 'rec-fx3-cup' })
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 })
    tx.gastosDE.update.mockResolvedValue({})

    await applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'gastoDE', referenciaId: 'gde-fx3-cup', gastosDEId: 'gde-fx3-cup',
      reconciliadoPor: 'user-1', tenantId: 'tenant-1', descripcion: 'Pago CUP',
      monto: 120, moneda: 'CUP', fechaPago: '2026-08-31T18:00:00.000Z'
    })

    const data = tx.reconciliacionGasto.create.mock.calls[0][0].data
    expect((data.montoCuenta as Prisma.Decimal).toNumber()).toBe(120)
    expect(data.monedaCuenta).toBe('CUP')
  })

  it('FX-3: persiste el snapshot en la moneda de la cuenta (USD) aunque el pago se valore en CUP', async () => {
    const tx = createTxMock()
    tx.tipoPago.findFirst.mockResolvedValue({ tipoId: 'tp-1', isActive: true, cuentaDefecto: 'cb-usd' })
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cb-usd', isActive: true })
    tx.reconciliacionGasto.findFirst.mockResolvedValue(null)
    tx.cuentaBancaria.findMany.mockResolvedValue([
      { cuentaId: 'cb-usd', moneda: 'USD', saldo: 1000, isActive: true }
    ])
    tx.reconciliacionGasto.create.mockResolvedValue({ reconciliacionId: 'rec-fx3-usd' })
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 })
    tx.gastosDE.update.mockResolvedValue({})

    await applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'gastoDE', referenciaId: 'gde-fx3-usd', gastosDEId: 'gde-fx3-usd',
      reconciliadoPor: 'user-1', tenantId: 'tenant-1', descripcion: 'Pago USD',
      monto: 100, moneda: 'USD', tasaCambio: 24.5,
      fechaPago: '2026-08-19T12:00:00.000Z'
    })

    const data = tx.reconciliacionGasto.create.mock.calls[0][0].data
    expect((data.montoCuenta as Prisma.Decimal).toNumber()).toBe(100)
    expect(data.monedaCuenta).toBe('USD')
    expect(data.montoConvertido).toBe(2450)
  })

  it('FX-3: persiste el snapshot funcional (CUP) cuando la cuenta es CUP y el tender es USD', async () => {
    const tx = createTxMock()
    tx.tipoPago.findFirst.mockResolvedValue({ tipoId: 'tp-1', isActive: true, cuentaDefecto: 'cb-1' })
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cb-1', isActive: true })
    tx.reconciliacionGasto.findFirst.mockResolvedValue(null)
    tx.cuentaBancaria.findMany.mockResolvedValue([
      { cuentaId: 'cb-1', moneda: 'CUP', saldo: 10000, isActive: true }
    ])
    tx.reconciliacionGasto.create.mockResolvedValue({ reconciliacionId: 'rec-fx3-cup2' })
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 })
    tx.gastosDE.update.mockResolvedValue({})

    await applyPagoGastoWorkflow(tx as any, {
      tipoGasto: 'gastoDE', referenciaId: 'gde-fx3-cup2', gastosDEId: 'gde-fx3-cup2',
      reconciliadoPor: 'user-1', tenantId: 'tenant-1', descripcion: 'Pago USD desde CUP',
      monto: 100, moneda: 'USD', tasaCambio: 24.5,
      fechaPago: '2026-08-19T12:00:00.000Z'
    })

    const data = tx.reconciliacionGasto.create.mock.calls[0][0].data
    expect((data.montoCuenta as Prisma.Decimal).toNumber()).toBe(2450)
    expect(data.monedaCuenta).toBe('CUP')
  })
})
