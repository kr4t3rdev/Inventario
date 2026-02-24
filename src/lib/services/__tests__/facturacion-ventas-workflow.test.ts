import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyFacturacionCobroWorkflow,
  normalizeTipoVencimiento,
  resolveFechaVencimiento
} from '@/lib/services/facturacion-ventas-workflow'

/**
 * @description Crea un mock transaccional mínimo para pruebas del workflow.
 * @returns {Record<string, any>} Mock de métodos usados por el servicio.
 */
function createTxMock() {
  return {
    cuentaPorCobrar: {
      upsert: vi.fn()
    },
    factura: {
      update: vi.fn()
    },
    tipoPago: {
      findMany: vi.fn()
    },
    cuentaBancaria: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    reconciliacionVenta: {
      create: vi.fn()
    }
  }
}

describe('facturacion-ventas-workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normaliza aliases de tipo de vencimiento', () => {
    expect(normalizeTipoVencimiento('contra_entrega')).toBe('contra_pago')
    expect(normalizeTipoVencimiento('plazo_30')).toBe('plazo')
    expect(normalizeTipoVencimiento('credito')).toBe('fecha')
  })

  it('resuelve plazo a 30 dias', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-14T12:00:00.000Z'))

    const fecha = resolveFechaVencimiento('plazo')
    expect(fecha).not.toBeNull()
    expect(fecha?.toISOString().startsWith('2026-03-16')).toBe(true)

    vi.useRealTimers()
  })

  it('crea CxC pendiente para vencimiento por fecha', async () => {
    const tx = createTxMock()
    tx.cuentaPorCobrar.upsert.mockResolvedValue({})
    tx.factura.update.mockResolvedValue({})

    const result = await applyFacturacionCobroWorkflow(tx as any, {
      ventaId: 'venta-1',
      facturaId: 'factura-1',
      clienteId: 'cliente-1',
      montoTotal: 1000,
      usuarioId: 'user-1',
      tipoVencimiento: 'fecha',
      fechaVencimiento: '2026-03-01T00:00:00.000Z'
    })

    expect(result).toEqual({
      tipoVencimiento: 'fecha',
      reconciliacionId: null
    })
    expect(tx.cuentaPorCobrar.upsert).toHaveBeenCalledTimes(1)
    expect(tx.factura.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'PENDIENTE'
        })
      })
    )
    expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled()
    expect(tx.cuentaBancaria.update).not.toHaveBeenCalled()
  })

  it('plazo crea CxC pendiente a 30 dias sin reconciliacion', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-14T12:00:00.000Z'))

    const tx = createTxMock()
    tx.cuentaPorCobrar.upsert.mockResolvedValue({})
    tx.factura.update.mockResolvedValue({})

    const result = await applyFacturacionCobroWorkflow(tx as any, {
      ventaId: 'venta-1',
      facturaId: 'factura-1',
      clienteId: 'cliente-1',
      montoTotal: 1000,
      usuarioId: 'user-1',
      tipoVencimiento: 'plazo'
    })

    expect(result).toEqual({
      tipoVencimiento: 'plazo',
      reconciliacionId: null
    })
    expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled()
    expect(tx.cuentaBancaria.update).not.toHaveBeenCalled()

    const upsertPayload = tx.cuentaPorCobrar.upsert.mock.calls[0]?.[0]
    const fechaCreate = upsertPayload?.create?.fechaVencimiento as Date
    expect(fechaCreate).toBeInstanceOf(Date)
    expect(fechaCreate.toISOString().startsWith('2026-03-16')).toBe(true)

    vi.useRealTimers()
  })

  it('tipo fecha requiere fecha de vencimiento', async () => {
    const tx = createTxMock()

    await expect(
      applyFacturacionCobroWorkflow(tx as any, {
        ventaId: 'venta-1',
        facturaId: 'factura-1',
        clienteId: 'cliente-1',
        montoTotal: 1000,
        usuarioId: 'user-1',
        tipoVencimiento: 'fecha'
      })
    ).rejects.toThrow('La fecha de vencimiento es obligatoria para tipo fecha')
  })

  it('contra pago registra reconciliacion y cierra factura/CxC', async () => {
    const tx = createTxMock()
    tx.tipoPago.findMany.mockResolvedValue([
      {
        tipoId: 'tipo-1',
        nombre: 'Transferencia',
        cuentaDefecto: 'cuenta-1'
      }
    ])
    tx.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'cuenta-1',
      moneda: 'CUP'
    })
    tx.reconciliacionVenta.create.mockResolvedValue({
      reconciliacionId: 'rec-1'
    })
    tx.cuentaBancaria.update.mockResolvedValue({})
    tx.cuentaPorCobrar.upsert.mockResolvedValue({})
    tx.factura.update.mockResolvedValue({})

    const result = await applyFacturacionCobroWorkflow(tx as any, {
      ventaId: 'venta-1',
      facturaId: 'factura-1',
      clienteId: 'cliente-1',
      montoTotal: 1000,
      usuarioId: 'user-1',
      tipoVencimiento: 'contra_pago'
    })

    expect(result).toEqual({
      tipoVencimiento: 'contra_pago',
      reconciliacionId: 'rec-1'
    })
    expect(tx.reconciliacionVenta.create).toHaveBeenCalledTimes(1)
    expect(tx.cuentaBancaria.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cuentaId: 'cuenta-1' }
      })
    )
    expect(tx.cuentaPorCobrar.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          estado: 'PAGADA',
          montoPagado: 1000
        })
      })
    )
    expect(tx.factura.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'PAGADA'
        })
      })
    )
  })
})
