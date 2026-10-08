import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence'

import {
  applyAnticipoAllocations,
  createAnticipo,
  executeAnticipo,
  isAnticipoWorkflowError
} from '@/lib/services/anticipos-workflow'

function createTxMock() {
  const tx: any = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    auditLog: { create: vi.fn().mockResolvedValue({ auditId: 'audit-1' }) },
    tenantAccountingPolicy: {
      findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
    },
    cuentaBancaria: {
      findFirst: vi.fn().mockResolvedValue({ cuentaId: 'bank', moneda: 'CUP' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    tipoPago: { findFirst: vi.fn().mockResolvedValue({ tipoId: 'payment' }) },
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
      findFirst: vi.fn().mockResolvedValue(null),
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
        usuarioId: 'user-1',
        tenantId: 'tenant-1',
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
        usuarioId: 'user-1',
        tenantId: 'tenant-1',
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
      cuentaOrigenId: 'bank', tipoPagoOrigenId: 'payment',
      usuarioId: 'user-1',
      tenantId: 'tenant-1',
    })

    expect(result.anticipoId).toBe('ant-created')
    expect(tx.anticipo.create).toHaveBeenCalled()
    expect(tx.anticipoMovimiento.create).toHaveBeenCalled()
  })

  it('rechaza el writer de ejecución standalone sin tocar el anticipo', async () => {
    const tx = createTxMock()
    tx.anticipo.findUnique.mockResolvedValue({
      anticipoId: 'ant-manual', estado: 'RESERVADO', saldoDisponible: 100,
      moneda: 'CUP', vigenciaHasta: null,
    })
    tx.anticipo.updateMany.mockResolvedValue({ count: 1 })
    tx.anticipoMovimiento.create.mockResolvedValue({ movimientoId: 'manual-movement' })

    await expect(executeAnticipo(tx, {
      anticipoId: 'ant-manual', contexto: 'FACTURA_DIRECTA',
      documentoDestinoId: 'documento-manual-no-registrado', montoObjetivo: 100,
      monedaObjetivo: 'CUP', idempotencyKey: 'manual-key', usuarioId: 'user-1',
    })).rejects.toSatisfy((error) =>
      isAnticipoWorkflowError(error) && error.code === 'DOCUMENT_WORKFLOW_REQUIRED',
    )

    expect(tx.anticipo.findUnique).not.toHaveBeenCalled()
    expect(tx.anticipo.updateMany).not.toHaveBeenCalled()
    expect(tx.anticipoMovimiento.create).not.toHaveBeenCalled()
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
        montoOriginal: 100,
        fxSnapshot: {
          ...buildAppliedFxEvidenceExact({
            originalAmount: '100', originalCurrency: 'CUP', functionalCurrency: 'CUP',
            source: 'anticipo-recognition',
          }).evidence,
          exchangeRate: '1',
        },
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
