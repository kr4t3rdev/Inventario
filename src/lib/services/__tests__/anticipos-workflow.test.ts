import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emitirEventoAnticipo } from '@/features/contabilidad-formal/services/advance-posting-service'
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider'

vi.mock('@/features/contabilidad-formal/services/advance-posting-service', () => ({
  emitirEventoAnticipo: vi.fn().mockResolvedValue({ estado: 'OMITIDO' }),
}))

import {
  applyAnticipoAllocations,
  createAnticipo,
  executeAnticipo,
  registrarMovimientoEfectivoAnticipo,
  reverseAnticipo,
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
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    anticipoMovimiento: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn(),
    },
    cuentaBancaria: { findFirst: vi.fn(), updateMany: vi.fn() },
    tipoPago: { findFirst: vi.fn() },
    tenantAccountingPolicy: { findUnique: vi.fn() },
    tenantLicense: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn()
  }
  tx.$transaction.mockImplementation(async (callback: any) => callback(tx))
  return tx
}

describe('anticipos-workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(emitirEventoAnticipo).mockResolvedValue({ estado: 'OMITIDO' })
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
        tenantId: 'tenant-test',
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
        tenantId: 'tenant-test',
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
      tenantId: 'tenant-test',
      vigenciaHasta: validVigencia.toISOString(),
      usuarioId: 'user-1'
    })

    expect(result.anticipoId).toBe('ant-created')
    expect(tx.anticipo.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ saldoDisponible: 0, montoFinanciado: 0 }),
    }))
    expect(tx.anticipoMovimiento.create).toHaveBeenCalled()
  })

  it('registra una recepción parcial en tesorería y crea su movimiento formal', async () => {
    const tx = createTxMock()
    tx.$executeRaw.mockResolvedValue(1)
    tx.anticipo.findFirst.mockResolvedValue({
      anticipoId: 'ant-1',
      tenantId: 'tenant-1',
      tipo: 'COBRO',
      estado: 'RESERVADO',
      montoOriginal: 100,
      saldoDisponible: 0,
      moneda: 'CUP',
    })
    tx.anticipoMovimiento.findFirst.mockResolvedValue(null)
    tx.anticipoMovimiento.aggregate.mockResolvedValue({ _sum: { monto: 0 } })
    tx.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'bank-1',
      tipoCuenta: 'CORRIENTE',
      moneda: 'CUP',
      isActive: true,
    })
    tx.tipoPago.findFirst.mockResolvedValue({ tipoId: 'payment-1', isActive: true })
    tx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' })
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 })
    tx.anticipo.updateMany.mockResolvedValue({ count: 1 })
    tx.anticipoMovimiento.create.mockResolvedValue({ movimientoId: 'movement-1' })
    tx.anticipo.update.mockResolvedValue({ saldoDisponible: 40 })

    const result = await registrarMovimientoEfectivoAnticipo(tx, {
      anticipoId: 'ant-1',
      tenantId: 'tenant-1',
      cuentaId: 'bank-1',
      tipoPagoId: 'payment-1',
      monto: 40,
      idempotencyKey: 'cash-ant-1',
      usuarioId: 'user-1',
    })

    expect(result).toMatchObject({ movimientoId: 'movement-1', saldoDisponible: 40 })
    expect(tx.cuentaBancaria.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ cuentaId: 'bank-1', tenantId: 'tenant-1' }),
      data: { saldo: { increment: 40 } },
    }))
    expect(tx.anticipoMovimiento.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        anticipoId: 'ant-1',
        tipoMovimiento: 'RECEPCION',
        cuentaId: 'bank-1',
        tipoPagoId: 'payment-1',
        monto: 40,
        saldoAntes: 0,
        saldoDespues: 40,
      }),
    }))
    expect(emitirEventoAnticipo).toHaveBeenCalledWith(
      tx,
      { tenantId: 'tenant-1', userId: 'user-1' },
      expect.objectContaining({
        tipo: 'ANTICIPO_CLIENTE_RECIBIDO',
        anticipoMovimientoId: 'movement-1',
        montoFuncional: 40,
      }),
    )
  })

  it('reproduce el mismo movimiento de financiación ante un replay idempotente', async () => {
    const tx = createTxMock()
    tx.anticipo.findFirst.mockResolvedValue({
      anticipoId: 'ant-1',
      tipo: 'COBRO',
      estado: 'RESERVADO',
      montoOriginal: 100,
      montoFinanciado: 40,
      saldoDisponible: 40,
      moneda: 'CUP',
      referenciaExterna: null,
    })
    tx.anticipoMovimiento.findFirst.mockResolvedValue({
      movimientoId: 'movement-1',
      monto: 40,
      saldoDespues: 40,
      cuentaId: 'bank-1',
      tipoPagoId: 'payment-1',
    })

    const result = await registrarMovimientoEfectivoAnticipo(tx, {
      anticipoId: 'ant-1',
      tenantId: 'tenant-1',
      cuentaId: 'bank-1',
      tipoPagoId: 'payment-1',
      monto: 40,
      idempotencyKey: 'cash-ant-1',
      usuarioId: 'user-1',
    })

    expect(result).toEqual({ movimientoId: 'movement-1', saldoDisponible: 40, idempotentReplay: true })
    expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled()
  })

  it('revierte una aplicación documental con valoración y asiento compensatorio', async () => {
    const tx = createTxMock()
    tx.anticipo.findFirst.mockResolvedValue({
      anticipoId: 'ant-1',
      tenantId: 'tenant-1',
      tipo: 'PAGO',
      estado: 'EJECUTADO',
      montoOriginal: 100,
      montoFinanciado: 100,
      saldoDisponible: 20,
      moneda: 'USD',
      referenciaExterna: null,
    })
    tx.anticipoMovimiento.findMany
      .mockResolvedValueOnce([{
        movimientoId: 'apply-1',
        tipoMovimiento: 'EJECUCION',
        monto: 80,
        montoFuncional: 2400,
        functionalCurrency: 'CUP',
        tasaAplicada: 30,
        fxEvidenceFingerprint: 'fx-source',
        contexto: 'COMPRA_SERVICIO',
      }])
      .mockResolvedValueOnce([])
    tx.anticipo.updateMany.mockResolvedValue({ count: 1 })
    tx.anticipoMovimiento.create.mockResolvedValue({ movimientoId: 'reverse-1' })

    const result = await reverseAnticipo(tx, {
      anticipoId: 'ant-1',
      tenantId: 'tenant-1',
      documentoDestinoId: 'expense-1',
      montoReverso: 40,
      idempotencyKey: 'expense-1:advance-1:reverse',
      usuarioId: 'user-1',
    })

    expect(result).toMatchObject({ saldoDisponible: 60, movimientoId: 'reverse-1' })
    expect(tx.anticipoMovimiento.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tipoMovimiento: 'REVERSO',
        monto: 40,
        montoFuncional: 1200,
        functionalCurrency: 'CUP',
        tasaAplicada: 30,
      }),
    }))
    expect(emitirEventoAnticipo).toHaveBeenCalledWith(
      tx,
      { tenantId: 'tenant-1', userId: 'user-1' },
      expect.objectContaining({
        tipo: 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA',
        anticipoMovimientoId: 'reverse-1',
        monto: 40,
        montoFuncional: 1200,
        fxEvidenceFingerprint: expect.any(String),
      }),
    )
  })

  it('rechaza revertir anticipos de otro tenant', async () => {
    const tx = createTxMock()

    await expect(reverseAnticipo(tx, {
      anticipoId: 'ant-other',
      tenantId: 'tenant-1',
      documentoDestinoId: 'expense-1',
      montoReverso: 10,
      idempotencyKey: 'expense-1:advance-other:reverse',
      usuarioId: 'user-1',
    })).rejects.toMatchObject({ code: 'ANTICIPO_NO_ENCONTRADO' })

    expect(tx.anticipoMovimiento.findMany).not.toHaveBeenCalled()
    expect(tx.anticipoMovimiento.create).not.toHaveBeenCalled()
  })

  it('reproduce el mismo reverso ante un replay idempotente', async () => {
    const tx = createTxMock()
    tx.anticipo.findFirst.mockResolvedValue({
      anticipoId: 'ant-1', tenantId: 'tenant-1', tipo: 'PAGO', estado: 'RESERVADO',
      montoOriginal: 100, montoFinanciado: 100, saldoDisponible: 60, moneda: 'CUP',
      referenciaExterna: null,
    })
    tx.anticipoMovimiento.findFirst.mockResolvedValue({
      movimientoId: 'reverse-existing',
      tipoMovimiento: 'REVERSO',
      documentoDestinoId: 'expense-1',
      monto: 40,
      saldoDespues: 60,
    })

    const result = await reverseAnticipo(tx, {
      anticipoId: 'ant-1', tenantId: 'tenant-1', documentoDestinoId: 'expense-1',
      montoReverso: 40, idempotencyKey: 'reverse-key-1', usuarioId: 'user-1',
    })

    expect(result).toMatchObject({ movimientoId: 'reverse-existing', saldoDisponible: 60, idempotentReplay: true })
    expect(tx.anticipoMovimiento.findMany).not.toHaveBeenCalled()
    expect(tx.anticipo.updateMany).not.toHaveBeenCalled()
    expect(tx.anticipoMovimiento.create).not.toHaveBeenCalled()
  })

  it('rechaza un reverso mayor que la aplicación documental pendiente', async () => {
    const tx = createTxMock()
    tx.anticipo.findFirst.mockResolvedValue({
      anticipoId: 'ant-1', tenantId: 'tenant-1', tipo: 'PAGO', estado: 'EJECUTADO',
      montoOriginal: 100, montoFinanciado: 100, saldoDisponible: 20, moneda: 'CUP',
      referenciaExterna: null,
    })
    tx.anticipoMovimiento.findMany.mockResolvedValueOnce([{
      movimientoId: 'apply-1', tipoMovimiento: 'EJECUCION', monto: 80,
      montoFuncional: 80, functionalCurrency: 'CUP', tasaAplicada: null,
      fxEvidenceFingerprint: null, contexto: 'COMPRA_SERVICIO',
    }]).mockResolvedValueOnce([{ tipoMovimiento: 'REVERSO', monto: 30, montoFuncional: 30 }])

    await expect(reverseAnticipo(tx, {
      anticipoId: 'ant-1', tenantId: 'tenant-1', documentoDestinoId: 'expense-1',
      montoReverso: 60, idempotencyKey: 'expense-1:another-reversal', usuarioId: 'user-1',
    })).rejects.toMatchObject({ code: 'MONTO_REVERSO_EXCEDE_APLICACION' })

    expect(tx.anticipo.updateMany).not.toHaveBeenCalled()
    expect(tx.anticipoMovimiento.create).not.toHaveBeenCalled()
  })

  it('valida tenant antes de consultar movimientos idempotentes', async () => {
    const tx = createTxMock()

    await expect(registrarMovimientoEfectivoAnticipo(tx, {
      anticipoId: 'ant-other-tenant',
      tenantId: 'tenant-current',
      cuentaId: 'bank-1',
      tipoPagoId: 'payment-1',
      monto: 40,
      idempotencyKey: 'known-key',
      usuarioId: 'user-1',
    })).rejects.toSatisfy((error) =>
      isAnticipoWorkflowError(error) && error.code === 'ANTICIPO_NO_ENCONTRADO',
    )
    expect(tx.anticipoMovimiento.findFirst).not.toHaveBeenCalled()
  })

  it('persiste la valoración FX publicada usada para financiar un anticipo', async () => {
    const tx = createTxMock()
    tx.anticipoMovimiento.findFirst.mockResolvedValue(null)
    tx.anticipo.findFirst.mockResolvedValue({
      anticipoId: 'ant-fx',
      tenantId: 'tenant-1',
      tipo: 'COBRO',
      estado: 'RESERVADO',
      montoOriginal: 10,
      montoFinanciado: 0,
      saldoDisponible: 0,
      moneda: 'USD',
      referenciaExterna: null,
    })
    tx.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'bank-usd',
      moneda: 'USD',
      tipoCuenta: 'CORRIENTE',
    })
    tx.tipoPago.findFirst.mockResolvedValue({ tipoId: 'payment-1' })
    tx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' })
    tx.anticipo.updateMany.mockResolvedValue({ count: 1 })
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 })
    tx.anticipoMovimiento.create.mockResolvedValue({ movimientoId: 'movement-fx' })
    const rateSpy = vi.spyOn(exchangeRateProvider, 'getRateAsOf').mockResolvedValue({
      tasaId: 'rate-1',
      tasa: 40,
      fechaVigencia: new Date('2026-10-31T00:00:00.000Z'),
    })

    try {
      await registrarMovimientoEfectivoAnticipo(tx, {
        anticipoId: 'ant-fx',
        tenantId: 'tenant-1',
        cuentaId: 'bank-usd',
        tipoPagoId: 'payment-1',
        monto: 10,
        idempotencyKey: 'cash-ant-fx',
        usuarioId: 'user-1',
      })
    } finally {
      rateSpy.mockRestore()
    }

    expect(tx.anticipoMovimiento.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        montoFuncional: 400,
        montoConvertido: 400,
        tasaAplicada: 40,
        functionalCurrency: 'CUP',
        fxEvidenceFingerprint: expect.any(String),
      }),
    }))
    expect(emitirEventoAnticipo).toHaveBeenCalledWith(
      tx,
      { tenantId: 'tenant-1', userId: 'user-1' },
      expect.objectContaining({ montoFuncional: 400, tasaCambio: 40, fxEvidenceFingerprint: expect.any(String) }),
    )
  })

  it('bloquea la aplicación de anticipos con saldo histórico sin financiación documentada', async () => {
    const tx = createTxMock()
    tx.anticipo.findFirst.mockResolvedValue({
      anticipoId: 'ant-legacy',
      tipo: 'COBRO',
      estado: 'RESERVADO',
      montoOriginal: 100,
      montoFinanciado: 0,
      saldoDisponible: 40,
      moneda: 'CUP',
      vigenciaHasta: null,
      referenciaExterna: null,
    })

    await expect(applyAnticipoAllocations(tx, [{ anticipoId: 'ant-legacy', montoAplicado: 20 }], {
      tenantId: 'tenant-1',
      documentoDestinoId: 'invoice-1',
      contexto: 'FACTURA_DIRECTA',
      usuarioId: 'user-1',
    })).rejects.toSatisfy((error) =>
      isAnticipoWorkflowError(error) && error.code === 'ANTICIPO_SIN_FONDOS_REALES',
    )
  })

  it('bloquea la ejecución directa y dirige al flujo documental transaccional', async () => {
    const tx = createTxMock()
    await expect(executeAnticipo(tx, {
      anticipoId: 'ant-legacy',
      contexto: 'FACTURA_DIRECTA',
      documentoDestinoId: 'invoice-1',
      montoObjetivo: 100,
      monedaObjetivo: 'CUP',
      idempotencyKey: 'legacy-key',
      usuarioId: 'user-1',
    })).rejects.toSatisfy((error) =>
      isAnticipoWorkflowError(error) && error.code === 'APLICACION_DOCUMENTAL_REQUERIDA',
    )
    expect(tx.anticipo.updateMany).not.toHaveBeenCalled()
  })

  it('aplica una asignación con tenant scope y decremento atómico', async () => {
    const tx = createTxMock()
    tx.anticipo.findFirst
      .mockResolvedValueOnce({
        anticipoId: 'ant-tenant',
        tipo: 'PAGO',
         estado: 'RESERVADO',
         saldoDisponible: 100,
         montoFinanciado: 100,
         montoOriginal: 100,
         moneda: 'CUP',
         vigenciaHasta: null,
         referenciaExterna: null,
       })
      .mockResolvedValueOnce({ saldoDisponible: 60 })
    tx.anticipo.updateMany.mockResolvedValue({ count: 1 })
    tx.anticipoMovimiento.create.mockResolvedValue({ movimientoId: 'mov-tenant' })
    tx.anticipoMovimiento.findMany.mockResolvedValue([
      {
        tipoMovimiento: 'RECEPCION',
        monto: 100,
        montoFuncional: 100,
        tasaAplicada: null,
        functionalCurrency: 'CUP',
        fxEvidenceFingerprint: null,
      },
    ])

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
    expect(emitirEventoAnticipo).toHaveBeenCalledWith(
      tx,
      { tenantId: 'tenant-1', userId: 'user-1' },
      expect.objectContaining({
        tipo: 'ANTICIPO_PROVEEDOR_APLICADO',
        anticipoMovimientoId: 'mov-tenant',
        monto: 40,
        montoFuncional: 40,
      }),
    )
  })
})
