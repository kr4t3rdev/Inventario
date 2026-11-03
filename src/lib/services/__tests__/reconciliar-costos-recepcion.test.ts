import { describe, expect, it, vi } from 'vitest'
import { ActionError } from '@/lib/server-actions'
import { reconciliarCostosRecepcionConFactura } from '@/lib/services/reconciliar-costos-recepcion'

function createMockTx() {
  return {
    recepcionItem: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    ordenCompraItem: { update: vi.fn().mockResolvedValue({}) },
    purchaseAllocation: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  }
}

describe('reconciliarCostosRecepcionConFactura', () => {
  it('distribuye factura parcial por recepción y actualiza importe facturado acumulado', async () => {
    const tx = createMockTx()
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
      items: [{ productoId: 'prod-1', cantidad: 3, precioUnitario: 120 }],
    })

    expect(tx.recepcionItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        ordenItem: { ordenId: 'oc-1' },
      }),
      orderBy: [{ recepcion: { fecha: 'asc' } }, { id: 'asc' }],
    }))
    expect(tx.recepcionItem.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'ri-1' },
      data: { cantidadFacturada: 4, montoFacturado: 420 },
    })
    expect(tx.recepcionItem.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'ri-2' },
      data: { cantidadFacturada: 2, montoFacturado: 240 },
    })
    expect(tx.purchaseAllocation.updateMany).toHaveBeenNthCalledWith(1, {
      where: { tenantId: 'tenant-1', recepcionItemId: 'ri-1' },
      data: { costoUnitarioSnapshot: 105 },
    })
    expect(tx.purchaseAllocation.updateMany).toHaveBeenNthCalledWith(2, {
      where: { tenantId: 'tenant-1', recepcionItemId: 'ri-2' },
      data: { costoUnitarioSnapshot: 117 },
    })
  })

  it('rechaza una factura que excede la recepción antes de actualizar', async () => {
    const tx = createMockTx()
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
      items: [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 120 }],
    })).rejects.toMatchObject({ code: 'FACTURA_EXCEDE_RECEPCION' })
    expect(tx.recepcionItem.update).not.toHaveBeenCalled()
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
    tx.recepcionItem.findMany.mockResolvedValue([])

    await expect(reconciliarCostosRecepcionConFactura(tx as any, {
      tenantId: 'tenant-1',
      ordenId: 'oc-1',
      items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 120 }],
    })).rejects.toMatchObject({ code: 'FACTURA_EXCEDE_RECEPCION' })
    expect(tx.recepcionItem.update).not.toHaveBeenCalled()
  })
})
