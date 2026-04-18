import { describe, it, expect, vi, beforeEach } from 'vitest'
import { upsertStockUbicacion } from '../stock-ubicacion-service'

const txMock = {
  stockUbicacion: {
    upsert: vi.fn(),
  },
}

describe('upsertStockUbicacion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('llama a upsert con increment cuando modo es increment', async () => {
    txMock.stockUbicacion.upsert.mockResolvedValue({ id: 'su-1' })

    await upsertStockUbicacion(txMock as any, {
      productoId: 'prod-1',
      tipoUbicacion: 'almacen',
      ubicacionId: 'alm-1',
      modo: 'increment',
      delta: 5,
    })

    expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith({
      where: {
        productoId_tipoUbicacion_ubicacionId: {
          productoId: 'prod-1',
          tipoUbicacion: 'almacen',
          ubicacionId: 'alm-1',
        },
      },
      update: {
        cantidad: { increment: 5 },
        cantidadDisponible: { increment: 5 },
      },
      create: {
        productoId: 'prod-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-1',
        cantidad: 5,
        cantidadReservada: 0,
        cantidadDisponible: 5,
      },
    })
  })

  it('llama a upsert con set cuando modo es set', async () => {
    txMock.stockUbicacion.upsert.mockResolvedValue({ id: 'su-1' })

    await upsertStockUbicacion(txMock as any, {
      productoId: 'prod-1',
      tipoUbicacion: 'almacen',
      ubicacionId: 'alm-1',
      modo: 'set',
      valor: 20,
    })

    expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith({
      where: {
        productoId_tipoUbicacion_ubicacionId: {
          productoId: 'prod-1',
          tipoUbicacion: 'almacen',
          ubicacionId: 'alm-1',
        },
      },
      update: {
        cantidad: 20,
        cantidadDisponible: 20,
      },
      create: {
        productoId: 'prod-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-1',
        cantidad: 20,
        cantidadReservada: 0,
        cantidadDisponible: 20,
      },
    })
  })

  it('funciona con tipoUbicacion punto_venta', async () => {
    txMock.stockUbicacion.upsert.mockResolvedValue({ id: 'su-2' })

    await upsertStockUbicacion(txMock as any, {
      productoId: 'prod-1',
      tipoUbicacion: 'punto_venta',
      ubicacionId: 'pv-1',
      modo: 'increment',
      delta: -3,
    })

    expect(txMock.stockUbicacion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productoId_tipoUbicacion_ubicacionId: {
            productoId: 'prod-1',
            tipoUbicacion: 'punto_venta',
            ubicacionId: 'pv-1',
          },
        },
        update: expect.objectContaining({
          cantidad: { increment: -3 },
        }),
      })
    )
  })
})
