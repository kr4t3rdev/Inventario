import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyAnticipoAllocations,
  createAnticipo,
  executeAnticipo,
  isAnticipoWorkflowError
} from '@/lib/services/anticipos-workflow'

function createTxMock() {
  const tx: any = {
    contrato: {
      findUnique: vi.fn()
    },
    anticipo: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn()
    },
    anticipoMovimiento: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
  tx.$transaction.mockImplementation(async (callback: any) => callback(tx))
  return tx
}

describe('anticipos-workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('valida monto al crear anticipo', async () => {
    const tx = createTxMock()
    await expect(
      createAnticipo(tx, {
        tipo: 'PAGO',
        contratoId: 'contrato-1',
        proveedorId: 'vendor-1',
        monto: 0,
        moneda: 'CUP',
        usuarioId: 'user-1'
      })
    ).rejects.toThrow('El monto del anticipo debe ser mayor que cero')
  })

  it('rechaza vigencia mayor al fin de contrato', async () => {
    const tx = createTxMock()
    const now = new Date()
    const contractEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const invalidVigencia = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    tx.contrato.findUnique.mockResolvedValue({
      contratoId: 'contrato-1',
      estado: 'ACTIVO',
      vendorId: 'vendor-1',
      clienteId: null,
      fechaInicio: now,
      fechaFin: contractEnd
    })

    await expect(
      createAnticipo(tx, {
        tipo: 'PAGO',
        contratoId: 'contrato-1',
        proveedorId: 'vendor-1',
        monto: 100,
        moneda: 'CUP',
        vigenciaHasta: invalidVigencia.toISOString(),
        usuarioId: 'user-1'
      })
    ).rejects.toThrow('La vigencia del anticipo no puede exceder la fecha fin del contrato')
  })

  it('crea anticipo válido cuando vigencia está dentro del contrato', async () => {
    const tx = createTxMock()
    const now = new Date()
    const contractEnd = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
    const validVigencia = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    tx.contrato.findUnique.mockResolvedValue({
      contratoId: 'contrato-1',
      estado: 'ACTIVO',
      vendorId: 'vendor-1',
      clienteId: null,
      fechaInicio: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      fechaFin: contractEnd
    })
    tx.anticipo.create.mockResolvedValue({
      anticipoId: 'ant-created',
      moneda: 'CUP'
    })
    tx.anticipoMovimiento.create.mockResolvedValue({ movimientoId: 'mov-created' })

    const result = await createAnticipo(tx, {
      tipo: 'PAGO',
      contratoId: 'contrato-1',
      proveedorId: 'vendor-1',
      monto: 100,
      moneda: 'CUP',
      vigenciaHasta: validVigencia.toISOString(),
      usuarioId: 'user-1'
    })

    expect(result.anticipoId).toBe('ant-created')
    expect(tx.anticipo.create).toHaveBeenCalled()
    expect(tx.anticipoMovimiento.create).toHaveBeenCalled()
  })

  it('ejecuta anticipo y retorna replay idempotente con la misma clave', async () => {
    const tx = createTxMock()
    tx.anticipo.findUnique.mockResolvedValue({
      anticipoId: 'ant-1',
      estado: 'RESERVADO',
      saldoDisponible: 100,
      moneda: 'CUP',
      vigenciaHasta: null
    })
    tx.anticipo.updateMany.mockResolvedValue({ count: 1 })
    tx.anticipoMovimiento.create.mockResolvedValue({ movimientoId: 'mov-1' })

    const first = await executeAnticipo(
      tx,
      {
        anticipoId: 'ant-1',
        contexto: 'FACTURA_DIRECTA',
        documentoDestinoId: 'fact-1',
        montoObjetivo: 100,
        monedaObjetivo: 'CUP',
        idempotencyKey: 'idem-ant-1',
        usuarioId: 'user-1'
      },
      async () => ({ reconciliacionVentaId: 'rec-1' })
    )

    const second = await executeAnticipo(
      tx,
      {
        anticipoId: 'ant-1',
        contexto: 'FACTURA_DIRECTA',
        documentoDestinoId: 'fact-1',
        montoObjetivo: 100,
        monedaObjetivo: 'CUP',
        idempotencyKey: 'idem-ant-1',
        usuarioId: 'user-1'
      },
      async () => ({ reconciliacionVentaId: 'rec-1' })
    )

    expect(first.idempotentReplay).toBe(false)
    expect(second.idempotentReplay).toBe(true)
    expect(second.movimientoId).toBe(first.movimientoId)
  })

  it('rechaza misma clave idempotente con payload distinto', async () => {
    const tx = createTxMock()
    tx.anticipo.findUnique.mockResolvedValue({
      anticipoId: 'ant-2',
      estado: 'RESERVADO',
      saldoDisponible: 100,
      moneda: 'CUP',
      vigenciaHasta: null
    })
    tx.anticipo.updateMany.mockResolvedValue({ count: 1 })
    tx.anticipoMovimiento.create.mockResolvedValue({ movimientoId: 'mov-2' })

    await executeAnticipo(
      tx,
      {
        anticipoId: 'ant-2',
        contexto: 'FACTURA_DIRECTA',
        documentoDestinoId: 'fact-2',
        montoObjetivo: 100,
        monedaObjetivo: 'CUP',
        idempotencyKey: 'idem-ant-2',
        usuarioId: 'user-1'
      },
      async () => ({ reconciliacionVentaId: 'rec-2' })
    )

    await expect(
      executeAnticipo(
        tx,
        {
          anticipoId: 'ant-2',
          contexto: 'FACTURA_DIRECTA',
          documentoDestinoId: 'fact-2-otro',
          montoObjetivo: 100,
          monedaObjetivo: 'CUP',
          idempotencyKey: 'idem-ant-2',
          usuarioId: 'user-1'
        },
        async () => ({ reconciliacionVentaId: 'rec-2' })
      )
    ).rejects.toSatisfy((error) => isAnticipoWorkflowError(error) && error.code === 'IDEMPOTENCIA_CONFLICTO')
  })

  it('detecta conflicto de concurrencia cuando updateMany no modifica filas', async () => {
    const tx = createTxMock()
    tx.anticipo.findUnique.mockResolvedValue({
      anticipoId: 'ant-3',
      estado: 'RESERVADO',
      saldoDisponible: 200,
      moneda: 'CUP',
      vigenciaHasta: null
    })
    tx.anticipo.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      executeAnticipo(
        tx,
        {
          anticipoId: 'ant-3',
          contexto: 'COMPRA_PRODUCTO',
          documentoDestinoId: 'compra-1',
          montoObjetivo: 200,
          monedaObjetivo: 'CUP',
          idempotencyKey: 'idem-ant-3',
          usuarioId: 'user-1'
        },
        async () => ({ reconciliacionGastoId: 'rec-g-1' })
      )
    ).rejects.toSatisfy((error) => isAnticipoWorkflowError(error) && error.code === 'CONCURRENCIA')
  })

  it('aplica una asignación con tenant scope y decremento atómico', async () => {
    const tx = createTxMock()
    tx.anticipo.findFirst
      .mockResolvedValueOnce({
        anticipoId: 'ant-tenant',
        estado: 'RESERVADO',
        saldoDisponible: 100,
        moneda: 'CUP',
        vigenciaHasta: null,
      })
      .mockResolvedValueOnce({ saldoDisponible: 60 })
    tx.anticipo.updateMany.mockResolvedValue({ count: 1 })
    tx.anticipoMovimiento.create.mockResolvedValue({ movimientoId: 'mov-tenant' })

    await applyAnticipoAllocations(
      tx,
      [{ anticipoId: 'ant-tenant', montoAplicado: 40 }],
      {
        tenantId: 'tenant-1',
        documentoDestinoId: 'compra-1',
        contexto: 'COMPRA_PRODUCTO',
        usuarioId: 'user-1',
      },
    )

    expect(tx.anticipo.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { anticipoId: 'ant-tenant', tenantId: 'tenant-1' },
    }))
    expect(tx.anticipo.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        anticipoId: 'ant-tenant',
        tenantId: 'tenant-1',
        saldoDisponible: { gte: 40 },
      }),
      data: { saldoDisponible: { decrement: 40 } },
    }))
  })
})
