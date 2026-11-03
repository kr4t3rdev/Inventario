import { describe, expect, it, vi } from 'vitest'
import { ActionError } from '@/lib/server-actions'
import {
  crearLoteDesdeEntrada,
  deriveLoteCodigo,
} from '@/features/inventario/lotes'

function createMockTx() {
  return {
    lote: { create: vi.fn().mockResolvedValue({ id: 'lote-1' }) },
  }
}

describe('crearLoteDesdeEntrada', () => {
  it('entrada de 10 crea un lote con 10 disponibles', async () => {
    const tx = createMockTx()

    const lote = await crearLoteDesdeEntrada(tx as any, {
      tenantId: 'tenant-1',
      productoId: 'prod-1',
      cantidad: 10,
      codigo: 'LOTE-MANUAL-1',
    })

    expect(tx.lote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        productoId: 'prod-1',
        codigo: 'LOTE-MANUAL-1',
        cantidadInicial: 10,
        cantidadDisponible: 10,
        fechaVencimiento: null,
        compraItemId: null,
      }),
    })
    expect(lote).toMatchObject({ id: 'lote-1' })
  })

  it('persiste fecha de vencimiento y línea de compra cuando se indican', async () => {
    const tx = createMockTx()
    const vencimiento = new Date('2027-06-30T00:00:00.000Z')

    await crearLoteDesdeEntrada(tx as any, {
      tenantId: 'tenant-1',
      productoId: 'prod-1',
      cantidad: 5,
      codigo: 'LOTE-VENCE',
      fechaVencimiento: vencimiento,
      compraItemId: 'cdi-1',
    })

    expect(tx.lote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fechaVencimiento: vencimiento,
        compraItemId: 'cdi-1',
      }),
    })
  })

  it.each([0, -3, 2.5, Number.NaN])(
    'rechaza la cantidad inválida %s antes de escribir',
    async (cantidad) => {
      const tx = createMockTx()

      await expect(
        crearLoteDesdeEntrada(tx as any, {
          tenantId: 'tenant-1',
          productoId: 'prod-1',
          cantidad,
          codigo: 'LOTE-X',
        }),
      ).rejects.toMatchObject({ code: 'LOTE_CANTIDAD_INVALIDA' })
      expect(tx.lote.create).not.toHaveBeenCalled()
    },
  )

  it('rechaza derivar código sin factura, recepción o código manual', async () => {
    const tx = createMockTx()

    await expect(
      crearLoteDesdeEntrada(tx as any, {
        tenantId: 'tenant-1',
        productoId: 'prod-1',
        cantidad: 4,
      }),
    ).rejects.toMatchObject({ code: 'LOTE_ORIGEN_REQUERIDO' })
    expect(tx.lote.create).not.toHaveBeenCalled()
  })
})

describe('deriveLoteCodigo', () => {
  it('deriva el código desde la factura y la fecha de la entrada', () => {
    expect(
      deriveLoteCodigo({
        factura: 'FAC-77',
        fecha: new Date('2026-11-08T12:00:00.000Z'),
        linea: 0,
      }),
    ).toBe('F-FAC-77-20261108-L0')
  })

  it('deriva el código desde una recepción cuando no hay factura', () => {
    expect(
      deriveLoteCodigo({
        recepcionId: 'rec-1',
        fecha: new Date('2026-11-08T12:00:00.000Z'),
        linea: 2,
      }),
    ).toBe('R-rec-1-20261108-L2')
  })

  it('falla con LOTE_ORIGEN_REQUERIDO si no hay origen', () => {
    expect(() =>
      deriveLoteCodigo({ fecha: new Date(), linea: 0 }),
    ).toThrowError(ActionError)
  })
})
