import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyPagoGastoWorkflow,
  isGastoWorkflowError
} from '@/lib/services/pago-gastos-workflow'

/**
 * @description Crea un mock transaccional mínimo para probar el workflow de pagos de gastos.
 * @returns {Record<string, any>} Objeto con los métodos transaccionales simulados.
 */
function createTxMock() {
  return {
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
      moneda: 'CUP'
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

  it('permite CxP de servicio cuando coincide tenant, tipo e invoice del servicio', async () => {
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
      where: expect.objectContaining({ tipo: 'servicio', numeroFactura: 'SVC-001' }),
    }))
  })
})
