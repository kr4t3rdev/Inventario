import { describe, expect, it, vi } from 'vitest'
import { ActionError } from '@/lib/server-actions'
import {
  recalcularAgregadosFacturadosDeOrden,
  reconciliarCostosRecepcionConFactura,
} from '@/lib/services/reconciliar-costos-recepcion'

function createMockTx() {
  return {
    ordenCompra: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    compraDocumentoItem: { findMany: vi.fn() },
    tenantAccountingPolicy: {
      findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
    },
    recepcionItem: {
      findMany: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    ordenCompraItem: { update: vi.fn().mockResolvedValue({}) },
    purchaseAllocation: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    purchaseReceiptInvoiceAllocation: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  }
}

describe('reconciliarCostosRecepcionConFactura', () => {
  it('persist invoice line provenance per receipt using the applied FX evidence', async () => {
    const tx = createMockTx()
    tx.compraDocumentoItem.findMany.mockResolvedValue([{
      compraDocumentoItemId: 'invoice-line-1', productoId: 'prod-1', cantidad: 3, precioUnitario: 120,
    }])
    tx.recepcionItem.findMany.mockResolvedValue([
      {
        id: 'ri-1',
        productoId: 'prod-1',
        ordenItemId: 'oi-1',
        cantidad: 4,
        cantidadFacturada: 3,
        montoFacturado: 300,
        ordenItem: { precioUnitario: 100 },
        recepcion: { fecha: new Date('2026-01-01T00:00:00.000Z') },
      },
      {
        id: 'ri-2',
        productoId: 'prod-1',
        ordenItemId: 'oi-1',
        cantidad: 3,
        cantidadFacturada: 0,
        montoFacturado: 0,
        ordenItem: { precioUnitario: 110 },
        recepcion: { fecha: new Date('2026-01-02T00:00:00.000Z') },
      },
    ])

    await reconciliarCostosRecepcionConFactura(tx as any, {
      tenantId: 'tenant-1',
      ordenId: 'oc-1',
      fechaFactura: new Date('2026-01-03T00:00:00.000Z'),
      moneda: 'USD',
      tasaCambio: 25,
      items: [{
        compraDocumentoItemId: 'invoice-line-1',
        productoId: 'prod-1',
        cantidad: 3,
        precioUnitario: 120,
      }],
    })

    expect(tx.recepcionItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        ordenItem: { ordenId: 'oc-1' },
      }),
      orderBy: [{ recepcion: { fecha: 'asc' } }, { id: 'asc' }],
    }))
    expect(tx.ordenCompra.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', id: 'oc-1' },
      data: { updatedAt: expect.any(Date) },
    })
    expect(tx.ordenCompra.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(tx.recepcionItem.findMany.mock.invocationCallOrder[0])
    expect(tx.recepcionItem.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: 'ri-1', tenantId: 'tenant-1', cantidadFacturada: 3, montoFacturado: 300 },
      data: { cantidadFacturada: 4, montoFacturado: 420 },
    }))
    expect(tx.recepcionItem.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { id: 'ri-2', tenantId: 'tenant-1', cantidadFacturada: 0, montoFacturado: 0 },
      data: { cantidadFacturada: 2, montoFacturado: 240 },
    }))
    expect(tx.purchaseAllocation.updateMany).not.toHaveBeenCalled()
    expect(tx.purchaseReceiptInvoiceAllocation.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: 'tenant-1',
          compraDocumentoItemId: 'invoice-line-1',
          recepcionItemId: 'ri-1',
          cantidad: 1,
          costoUnitarioSnapshot: 120,
          fifoMonedaOrigen: 'USD',
          fifoFechaFuente: new Date('2026-01-03T00:00:00.000Z'),
          fifoMonedaFuncional: 'CUP',
          fifoCostoFuncional: 3000,
          fifoTasaCambio: 25,
          fifoFechaTasa: new Date('2026-01-03T00:00:00.000Z'),
          fifoEvidenciaFx: expect.stringContaining('MANUAL_GOVERNED'),
        }),
        expect.objectContaining({
          tenantId: 'tenant-1',
          compraDocumentoItemId: 'invoice-line-1',
          recepcionItemId: 'ri-2',
          cantidad: 2,
          costoUnitarioSnapshot: 120,
          fifoMonedaOrigen: 'USD',
          fifoFechaFuente: new Date('2026-01-03T00:00:00.000Z'),
          fifoMonedaFuncional: 'CUP',
          fifoCostoFuncional: 6000,
          fifoTasaCambio: 25,
          fifoFechaTasa: new Date('2026-01-03T00:00:00.000Z'),
          fifoEvidenciaFx: expect.stringContaining('MANUAL_GOVERNED'),
        }),
      ],
    })
  })

  it('rechaza una factura que excede la recepción antes de actualizar', async () => {
    const tx = createMockTx()
    tx.compraDocumentoItem.findMany.mockResolvedValue([{
      compraDocumentoItemId: 'invoice-line-1', productoId: 'prod-1', cantidad: 2, precioUnitario: 120,
    }])
    tx.recepcionItem.findMany.mockResolvedValue([
      {
        id: 'ri-1',
        productoId: 'prod-1',
        ordenItemId: 'oi-1',
        cantidad: 2,
        cantidadFacturada: 1,
        montoFacturado: 100,
        ordenItem: { precioUnitario: 100 },
        recepcion: { fecha: new Date('2026-01-01T00:00:00.000Z') },
      },
    ])

    await expect(reconciliarCostosRecepcionConFactura(tx as any, {
      tenantId: 'tenant-1',
      ordenId: 'oc-1',
      fechaFactura: new Date('2026-01-03T00:00:00.000Z'),
      moneda: 'CUP',
      items: [{ compraDocumentoItemId: 'invoice-line-1', productoId: 'prod-1', cantidad: 2, precioUnitario: 120 }],
    })).rejects.toMatchObject({ code: 'FACTURA_EXCEDE_RECEPCION' })
    expect(tx.recepcionItem.updateMany).not.toHaveBeenCalled()
  })

  it('rechaza cantidades cero antes de consultar o actualizar', async () => {
    const tx = createMockTx()
    tx.recepcionItem.findMany.mockResolvedValue([])

    await expect(reconciliarCostosRecepcionConFactura(tx as any, {
      tenantId: 'tenant-1',
      ordenId: 'oc-1',
      items: [{ productoId: 'prod-1', cantidad: 0, precioUnitario: 120 }],
    })).rejects.toBeInstanceOf(ActionError)
    expect(tx.recepcionItem.findMany).not.toHaveBeenCalled()
  })

  it('rechaza conciliar la factura si la OC no tiene líneas de recepción', async () => {
    const tx = createMockTx()
    tx.compraDocumentoItem.findMany.mockResolvedValue([{
      compraDocumentoItemId: 'invoice-line-1', productoId: 'prod-1', cantidad: 1, precioUnitario: 120,
    }])
    tx.recepcionItem.findMany.mockResolvedValue([])

    await expect(reconciliarCostosRecepcionConFactura(tx as any, {
      tenantId: 'tenant-1',
      ordenId: 'oc-1',
      fechaFactura: new Date('2026-01-03T00:00:00.000Z'),
      moneda: 'CUP',
      items: [{ compraDocumentoItemId: 'invoice-line-1', productoId: 'prod-1', cantidad: 1, precioUnitario: 120 }],
    })).rejects.toMatchObject({ code: 'FACTURA_EXCEDE_RECEPCION' })
    expect(tx.recepcionItem.updateMany).not.toHaveBeenCalled()
  })

  it('rechaza una carrera concurrente antes de persistir la procedencia', async () => {
    const tx = createMockTx()
    tx.compraDocumentoItem.findMany.mockResolvedValue([{
      compraDocumentoItemId: 'invoice-line-1', productoId: 'prod-1', cantidad: 1, precioUnitario: 120,
    }])
    tx.recepcionItem.findMany.mockResolvedValue([{
      id: 'ri-1', productoId: 'prod-1', ordenItemId: 'oi-1', cantidad: 1,
      cantidadFacturada: 0, montoFacturado: 0, ordenItem: { precioUnitario: 100 },
    }])
    tx.recepcionItem.updateMany.mockResolvedValue({ count: 0 })

    await expect(reconciliarCostosRecepcionConFactura(tx as any, {
      tenantId: 'tenant-1', ordenId: 'oc-1', fechaFactura: new Date('2026-01-03T00:00:00.000Z'),
      moneda: 'CUP', items: [{
        compraDocumentoItemId: 'invoice-line-1', productoId: 'prod-1', cantidad: 1, precioUnitario: 120,
      }],
    })).rejects.toMatchObject({ code: 'FACTURA_RECEPCION_CONCURRENTE' })
    expect(tx.purchaseReceiptInvoiceAllocation.createMany).not.toHaveBeenCalled()
  })

  it('persists source identity but leaves FX valuation empty when the invoice rate is missing', async () => {
    const tx = createMockTx()
    tx.compraDocumentoItem.findMany.mockResolvedValue([{
      compraDocumentoItemId: 'invoice-line-1', productoId: 'prod-1', cantidad: 1, precioUnitario: 120,
    }])
    tx.recepcionItem.findMany.mockResolvedValue([{
      id: 'ri-1', productoId: 'prod-1', ordenItemId: 'oi-1', cantidad: 1,
      cantidadFacturada: 0, montoFacturado: 0, ordenItem: { precioUnitario: 100 },
    }])

    await reconciliarCostosRecepcionConFactura(tx as any, {
      tenantId: 'tenant-1', ordenId: 'oc-1', fechaFactura: new Date('2026-01-03T00:00:00.000Z'),
      moneda: 'USD', items: [{
        compraDocumentoItemId: 'invoice-line-1', productoId: 'prod-1', cantidad: 1, precioUnitario: 120,
      }],
    })

    expect(tx.purchaseReceiptInvoiceAllocation.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        compraDocumentoItemId: 'invoice-line-1', recepcionItemId: 'ri-1', cantidad: 1,
        costoUnitarioSnapshot: 120, fifoMonedaOrigen: 'USD', fifoMonedaFuncional: null,
        fifoCostoFuncional: null, fifoEvidenciaFx: null,
      })],
    })
  })
})

describe('recalcularAgregadosFacturadosDeOrden', () => {
  it('rebuilds receipt counters from active invoices in stable order after cancellation', async () => {
    const tx = createMockTx()
    tx.compraDocumentoItem.findMany.mockResolvedValue([{
      compraDocumentoItemId: 'active-line-1',
      productoId: 'prod-1',
      cantidad: 3,
      precioUnitario: 120,
      compraDocumento: { createdAt: new Date('2026-01-02T00:00:00.000Z') },
      receiptInvoiceAllocations: [],
    }])
    tx.recepcionItem.findMany.mockResolvedValue([
      {
        id: 'receipt-1', productoId: 'prod-1', cantidad: 2,
        cantidadFacturada: 5, montoFacturado: 600,
        recepcion: { fecha: new Date('2026-01-01T00:00:00.000Z') },
      },
      {
        id: 'receipt-2', productoId: 'prod-1', cantidad: 2,
        cantidadFacturada: 4, montoFacturado: 480,
        recepcion: { fecha: new Date('2026-01-02T00:00:00.000Z') },
      },
    ])

    await recalcularAgregadosFacturadosDeOrden(tx as any, {
      tenantId: 'tenant-1',
      ordenId: 'oc-1',
    })

    expect(tx.ordenCompra.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(tx.recepcionItem.findMany.mock.invocationCallOrder[0])
    expect(tx.compraDocumentoItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId: 'tenant-1',
        compraDocumento: {
          tenantId: 'tenant-1',
          ordenCompraId: 'oc-1',
          estado: { not: 'ANULADA' },
          deletedAt: null,
        },
      },
      orderBy: [
        { compraDocumento: { createdAt: 'asc' } },
        { compraDocumentoItemId: 'asc' },
      ],
    }))
    expect(tx.recepcionItem.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'receipt-1', tenantId: 'tenant-1', cantidadFacturada: 5, montoFacturado: 600 },
      data: { cantidadFacturada: 2, montoFacturado: 240 },
    })
    expect(tx.recepcionItem.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'receipt-2', tenantId: 'tenant-1', cantidadFacturada: 4, montoFacturado: 480 },
      data: { cantidadFacturada: 1, montoFacturado: 120 },
    })
  })

  it('rejects active invoice quantities above physical receipts without updating counters', async () => {
    const tx = createMockTx()
    tx.compraDocumentoItem.findMany.mockResolvedValue([{
      compraDocumentoItemId: 'active-line-1', productoId: 'prod-1', cantidad: 3,
      precioUnitario: 120, compraDocumento: { createdAt: new Date() }, receiptInvoiceAllocations: [],
    }])
    tx.recepcionItem.findMany.mockResolvedValue([{
      id: 'receipt-1', productoId: 'prod-1', cantidad: 2,
      cantidadFacturada: 2, montoFacturado: 240, recepcion: { fecha: new Date() },
    }])

    await expect(recalcularAgregadosFacturadosDeOrden(tx as any, {
      tenantId: 'tenant-1', ordenId: 'oc-1',
    })).rejects.toMatchObject({ code: 'FACTURA_EXCEDE_RECEPCION' })
    expect(tx.recepcionItem.updateMany).not.toHaveBeenCalled()
  })

  it('stops on an aggregate compare-and-set conflict', async () => {
    const tx = createMockTx()
    tx.compraDocumentoItem.findMany.mockResolvedValue([])
    tx.recepcionItem.findMany.mockResolvedValue([{
      id: 'receipt-1', productoId: 'prod-1', cantidad: 2,
      cantidadFacturada: 1, montoFacturado: 100, recepcion: { fecha: new Date() },
    }])
    tx.recepcionItem.updateMany.mockResolvedValue({ count: 0 })

    await expect(recalcularAgregadosFacturadosDeOrden(tx as any, {
      tenantId: 'tenant-1', ordenId: 'oc-1',
    })).rejects.toMatchObject({ code: 'FACTURA_RECEPCION_CONCURRENTE' })
  })
})
