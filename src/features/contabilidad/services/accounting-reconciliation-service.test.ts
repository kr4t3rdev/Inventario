import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';

const { tx, transaction, postEvento, preflight } = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    venta: { findUnique: vi.fn() },
    ventaServicios: { findFirst: vi.fn(), updateMany: vi.fn() },
    cuentaBancaria: { findFirst: vi.fn(), updateMany: vi.fn() },
    tipoPago: { findFirst: vi.fn() },
    reconciliacionServicio: { create: vi.fn(), findMany: vi.fn() },
    cuentaPorCobrar: { findFirst: vi.fn(), updateMany: vi.fn() },
    anticipoMovimiento: { findMany: vi.fn().mockResolvedValue([]) },
    reconciliacionVenta: { create: vi.fn(), findMany: vi.fn() },
  };
  const preflight = {
    cuentaBancaria: { findFirst: vi.fn() },
    tipoPago: { findFirst: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(async (callback) => callback(tx)),
    postEvento: vi.fn(),
    preflight,
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: { ...preflight, $transaction: transaction } }));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({ postEvento }));
vi.mock('./accounting-tenant-lock-service', () => ({ acquireAccountingTenantLock: vi.fn() }));

import { AccountingReconciliationService } from './accounting-reconciliation-service';

const user = {
  userId: 'actor-1', tenantId: 'tenant-1', role: 'regularUser', tenantRole: 'economico',
  permissions: new Set(['financiero.contabilidad.acceder']),
  planFeatures: { contabilidad: true, servicios: true },
} as Parameters<
  typeof AccountingReconciliationService.reconcileService
>[0]['user'];

describe('reconcileService — posteo transaccional móvil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.ventaServicios.findFirst.mockReset().mockResolvedValue({
      total: 10, reconciliado: null, clienteId: 'client-1',
    });
    tx.ventaServicios.updateMany.mockReset().mockResolvedValue({ count: 1 });
    tx.cuentaBancaria.findFirst.mockReset().mockResolvedValue({ tipoCuenta: 'BANCO', isActive: true });
    tx.cuentaBancaria.updateMany.mockReset().mockResolvedValue({ count: 1 });
    tx.tipoPago.findFirst.mockReset().mockResolvedValue({ isActive: true });
    tx.cuentaPorCobrar.findFirst.mockReset().mockResolvedValue(null);
    tx.cuentaPorCobrar.updateMany.mockReset().mockResolvedValue({ count: 1 });
    tx.reconciliacionServicio.findMany.mockReset().mockResolvedValue([]);
    tx.reconciliacionServicio.create.mockReset().mockImplementation(async ({ data }) => ({
      ...data, reconciliacionId: 'rec-1',
    }));
    preflight.tipoPago.findFirst.mockReset().mockResolvedValue({
      isActive: true, requiereCuenta: true, cuentaDefecto: null,
    });
    preflight.cuentaBancaria.findFirst.mockReset().mockResolvedValue(null);
  });

  it('deniega reconciliación a quien no tiene permiso financiero antes de iniciar la transacción', async () => {
    const unauthorizedUser = {
      ...user,
      userId: 'actor-without-finance-permission',
      permissions: new Set<string>(),
    };

    await expect(AccountingReconciliationService.reconcileService({
      user: unauthorizedUser,
      input: {
        ventaServicioId: 'service-1',
        distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 10 }],
      },
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(transaction).not.toHaveBeenCalled();
  });

  it('deniega reconciliación sin el feature de servicios antes de iniciar la transacción', async () => {
    const userWithoutServicesFeature = {
      ...user,
      planFeatures: { contabilidad: true, servicios: false },
    };

    await expect(AccountingReconciliationService.reconcileService({
      user: userWithoutServicesFeature,
      input: {
        ventaServicioId: 'service-1',
        distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 10 }],
      },
    })).rejects.toMatchObject({ code: 'FEATURE_NOT_AVAILABLE' });

    expect(transaction).not.toHaveBeenCalled();
  });

  it('postea exactamente una vez por fila dentro de la misma transacción y hereda FX', async () => {
    await AccountingReconciliationService.reconcileService({
      user,
      input: {
        ventaServicioId: 'service-1', fechaReconciliacion: '2026-09-25',
        distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 10,
          moneda: 'USD', tasaCambio: 24 }],
      },
    });
    const saved = tx.reconciliacionServicio.create.mock.calls[0][0].data;
    expect(saved.fxEvidenceFingerprint).toBeTruthy();
    expect(String(tx.$queryRaw.mock.calls[0]?.[0])).toContain('"Cliente"');
    expect(postEvento).toHaveBeenCalledTimes(1);
    expect(postEvento).toHaveBeenCalledWith(tx, { tenantId: 'tenant-1', userId: 'actor-1' },
      expect.objectContaining({ origen: { tipo: 'reconciliacion_servicio', id: 'rec-1' },
        montoFuncional: 240, tasaCambio: 24, fxEvidenceFingerprint: saved.fxEvidenceFingerprint }));
  });

  it('rechaza por saldo insuficiente de la cuenta origen antes de abrir la transacción', async () => {
    preflight.tipoPago.findFirst.mockResolvedValue({
      isActive: true, requiereCuenta: true, cuentaDefecto: 'source-bank-1',
    });
    preflight.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'source-bank-1', saldo: 239, moneda: 'CUP', isActive: true,
    });

    await expect(AccountingReconciliationService.reconcileService({
      user,
      input: {
        ventaServicioId: 'service-1',
        distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 10,
          moneda: 'USD', tasaCambio: 24, fechaTasa: '2026-09-25' }],
      },
    })).rejects.toMatchObject({ code: 'SALDO_INSUFICIENTE' });

    expect(transaction).not.toHaveBeenCalled();
    expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
    expect(tx.reconciliacionServicio.create).not.toHaveBeenCalled();
    expect(postEvento).not.toHaveBeenCalled();
  });

  it('mueve el importe funcional de la cuenta origen a destino dentro de una transacción', async () => {
    preflight.tipoPago.findFirst.mockResolvedValue({
      isActive: true, requiereCuenta: true, cuentaDefecto: 'source-bank-1',
    });
    preflight.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'source-bank-1', saldo: 1000, moneda: 'CUP', isActive: true,
    });
    tx.tipoPago.findFirst.mockResolvedValue({
      tipoId: 'cash-1', isActive: true, requiereCuenta: true, cuentaDefecto: 'source-bank-1',
    });
    tx.cuentaBancaria.findFirst
      .mockResolvedValueOnce({ saldo: 1000, moneda: 'CUP', tipoCuenta: 'BANCO', isActive: true })
      .mockResolvedValueOnce({ tipoCuenta: 'BANCO', isActive: true });

    const result = await AccountingReconciliationService.reconcileService({
      user,
      input: {
        ventaServicioId: 'service-1',
        distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 10,
          moneda: 'USD', tasaCambio: 24, fechaTasa: '2026-09-25' }],
      },
    });

    expect(result.reconciliado).toBe(true);
    expect(preflight.tipoPago.findFirst.mock.invocationCallOrder[0])
      .toBeLessThan(transaction.mock.invocationCallOrder[0]);
    expect(tx.cuentaBancaria.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        cuentaId: 'source-bank-1', tenantId: 'tenant-1', saldo: { gte: 240 },
      }),
      data: { saldo: { decrement: 240 } },
    }));
    expect(tx.cuentaBancaria.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ cuentaId: 'bank-1', tenantId: 'tenant-1' }),
      data: { saldo: { increment: 240 } },
    }));
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('rechaza si el saldo origen cae después del precheck sin acreditar destino ni postear', async () => {
    preflight.tipoPago.findFirst.mockResolvedValue({
      isActive: true, requiereCuenta: true, cuentaDefecto: 'source-bank-1',
    });
    preflight.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'source-bank-1', saldo: 1000, moneda: 'CUP', isActive: true,
    });
    tx.tipoPago.findFirst.mockResolvedValue({
      tipoId: 'cash-1', isActive: true, requiereCuenta: true, cuentaDefecto: 'source-bank-1',
    });
    tx.cuentaBancaria.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(AccountingReconciliationService.reconcileService({
      user,
      input: {
        ventaServicioId: 'service-1',
        distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 10,
          moneda: 'USD', tasaCambio: 24, fechaTasa: '2026-09-25' }],
      },
    })).rejects.toMatchObject({ code: 'SALDO_INSUFICIENTE' });

    expect(tx.cuentaBancaria.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.reconciliacionServicio.create).not.toHaveBeenCalled();
    expect(tx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
    expect(postEvento).not.toHaveBeenCalled();
  });

  it('rechaza FX sin fecha efectiva antes de escribir y conserva CUP sin fecha', async () => {
    const input = { ventaServicioId: 'service-1', distribuciones: [
      { cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 10, moneda: 'USD', tasaCambio: 24 },
    ] };
    await expect(AccountingReconciliationService.reconcileService({ user, input }))
      .rejects.toThrow('evidencia');
    expect(tx.reconciliacionServicio.create).not.toHaveBeenCalled();
    await AccountingReconciliationService.reconcileService({ user, input: {
      ...input, distribuciones: [{ ...input.distribuciones[0], moneda: 'CUP' }],
    } });
    expect(postEvento).toHaveBeenCalledTimes(1);
  });

  it('rechaza referencias de otro tenant y reintentos', async () => {
    tx.ventaServicios.findFirst.mockResolvedValueOnce(null);
    const input = { ventaServicioId: 'service-1', distribuciones: [
      { cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 10 },
    ] };
    await expect(AccountingReconciliationService.reconcileService({ user, input }))
      .rejects.toThrow('Servicio no encontrado');
    tx.ventaServicios.findFirst.mockResolvedValueOnce({ total: 10, reconciliado: true });
    await expect(AccountingReconciliationService.reconcileService({ user, input }))
      .rejects.toThrow('reconciliado');
    expect(postEvento).not.toHaveBeenCalled();
  });

  it('rechaza saldo funcional previo sin recibos antes de escribir movimientos', async () => {
    tx.ventaServicios.findFirst.mockResolvedValue({ total: 100, reconciliado: null });
    tx.cuentaPorCobrar.findFirst.mockResolvedValue({
      idCC: 7,
      montoDeuda: 100,
      montoPagado: 0,
      montoOriginal: 100,
      montoDeudaFuncional: 2400,
      montoPagadoFuncional: 1,
      monedaOriginal: 'USD',
      monedaFuncional: 'CUP',
      tasaCambio: 24,
      fxEvidenceFingerprint: 'cxc-fx-v2',
      fxEvidenceVersion: 2,
      estado: 'PENDIENTE',
    });

    await expect(AccountingReconciliationService.reconcileService({ user, input: {
      ventaServicioId: 'service-1', fechaReconciliacion: '2026-09-25',
      distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 40,
        moneda: 'USD', tasaCambio: 25, fechaTasa: '2026-09-25' }],
    } })).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });

    expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
    expect(tx.reconciliacionServicio.create).not.toHaveBeenCalled();
    expect(tx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
    expect(postEvento).not.toHaveBeenCalled();
  });

  it('acepta saldo funcional Decimal cero sin recibos previos', async () => {
    tx.ventaServicios.findFirst.mockResolvedValue({ total: 100, reconciliado: null });
    tx.cuentaPorCobrar.findFirst.mockResolvedValue({
      idCC: 7,
      montoDeuda: 100,
      montoPagado: 0,
      montoOriginal: 100,
      montoDeudaFuncional: 2400,
      montoPagadoFuncional: new Prisma.Decimal(0),
      monedaOriginal: 'USD',
      monedaFuncional: 'CUP',
      tasaCambio: 24,
      fxEvidenceFingerprint: 'cxc-fx-v2',
      fxEvidenceVersion: 2,
      estado: 'PENDIENTE',
    });

    const result = await AccountingReconciliationService.reconcileService({ user, input: {
      ventaServicioId: 'service-1', fechaReconciliacion: '2026-09-25',
      distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 40,
        moneda: 'USD', tasaCambio: 25, fechaTasa: '2026-09-25' }],
    } });

    expect(result.reconciliado).toBe(false);
    expect(tx.cuentaBancaria.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.reconciliacionServicio.create).toHaveBeenCalledTimes(1);
    expect(tx.cuentaPorCobrar.updateMany).toHaveBeenCalledTimes(1);
    expect(postEvento).toHaveBeenCalledTimes(1);
  });

  it('permite un abono parcial de servicio a crédito y liquida el saldo en el segundo pago', async () => {
    const cxc = {
      idCC: 7,
      montoDeuda: 100,
      montoPagado: 0,
      montoOriginal: 100,
      montoDeudaFuncional: 2400,
      montoPagadoFuncional: null,
      monedaOriginal: 'USD',
      monedaFuncional: 'CUP',
      tasaCambio: 24,
      fxEvidenceFingerprint: 'cxc-fx-v2',
      fxEvidenceVersion: 2,
      estado: 'PENDIENTE',
    };
    tx.ventaServicios.findFirst.mockResolvedValue({ total: 100, reconciliado: null });
    tx.cuentaPorCobrar.findFirst.mockResolvedValueOnce(cxc).mockResolvedValueOnce({
      ...cxc, montoPagado: 40, montoPagadoFuncional: 1000, estado: 'PARCIAL',
    });
    tx.reconciliacionServicio.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        monto: 40, moneda: 'USD', montoConvertido: 1000, functionalCurrency: 'CUP',
        fxEvidenceFingerprint: 'receipt-1-fx', fxEvidenceVersion: 2,
      }]);
    tx.reconciliacionServicio.create
      .mockResolvedValueOnce({ reconciliacionId: 'receipt-1', monto: 40, moneda: 'USD',
        montoConvertido: 1000, tasaCambio: 25, functionalCurrency: 'CUP',
        fxEvidenceFingerprint: 'receipt-1-fx', fxEvidenceVersion: 1,
        fechaReconciliacion: new Date('2026-09-25T12:00:00Z') })
      .mockResolvedValueOnce({ reconciliacionId: 'receipt-2', monto: 60, moneda: 'USD',
        montoConvertido: 1500, tasaCambio: 25, functionalCurrency: 'CUP',
        fxEvidenceFingerprint: 'receipt-2-fx', fxEvidenceVersion: 1,
        fechaReconciliacion: new Date('2026-09-26T12:00:00Z') });

    const first = await AccountingReconciliationService.reconcileService({ user, input: {
      ventaServicioId: 'service-1', fechaReconciliacion: '2026-09-25T12:00:00Z',
      distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 40,
        moneda: 'USD', tasaCambio: 25 }],
    } });

    expect(first).toMatchObject({ reconciliado: false, distribuciones: 1 });
    expect(tx.cuentaPorCobrar.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { idCC: 7, tenantId: 'tenant-1' },
      data: { montoPagado: expect.anything(), montoPagadoFuncional: expect.anything(), estado: 'PARCIAL' },
    }));
    expect(tx.cuentaPorCobrar.updateMany.mock.calls[0][0].data.montoPagado.toString()).toBe('40');
    expect(tx.cuentaPorCobrar.updateMany.mock.calls[0][0].data.montoPagadoFuncional.toString())
      .toBe('1000');
    expect(tx.ventaServicios.updateMany).not.toHaveBeenCalled();
    expect(postEvento.mock.calls[0][2]).toMatchObject({
      tipo: 'COBRO_SERVICIO',
      auxiliares: { diferenciaFx: expect.anything() },
    });
    expect(postEvento.mock.calls[0][2].auxiliares.diferenciaFx.toString()).toBe('40');

    const second = await AccountingReconciliationService.reconcileService({ user, input: {
      ventaServicioId: 'service-1', fechaReconciliacion: '2026-09-26T12:00:00Z',
      distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 60,
        moneda: 'USD', tasaCambio: 25 }],
    } });

    expect(second).toMatchObject({ reconciliado: true, distribuciones: 1 });
    expect(tx.cuentaPorCobrar.updateMany.mock.calls[1][0].data.montoPagado.toString()).toBe('100');
    expect(tx.cuentaPorCobrar.updateMany.mock.calls[1][0].data.montoPagadoFuncional.toString())
      .toBe('2500');
    expect(tx.cuentaPorCobrar.updateMany.mock.calls[1][0].data.estado).toBe('PAGADA');
    expect(tx.ventaServicios.updateMany).toHaveBeenCalledTimes(1);
    expect(postEvento).toHaveBeenCalledTimes(2);
    expect(postEvento.mock.calls.every(([client]) => client === tx)).toBe(true);
    expect(postEvento.mock.calls[1][2].auxiliares.diferenciaFx.toString()).toBe('60');
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('liquida una CxC cuando reconciliado está en false y no solo cuando está en null', async () => {
    tx.ventaServicios.findFirst.mockResolvedValue({ total: 100, reconciliado: false });
    tx.cuentaPorCobrar.findFirst.mockResolvedValue({
      idCC: 9,
      montoDeuda: 100,
      montoPagado: 0,
      montoOriginal: 100,
      montoDeudaFuncional: 2400,
      montoPagadoFuncional: null,
      monedaOriginal: 'USD',
      monedaFuncional: 'CUP',
      tasaCambio: 24,
      fxEvidenceFingerprint: 'cxc-fx-v2',
      fxEvidenceVersion: 2,
      estado: 'PENDIENTE',
    });
    tx.reconciliacionServicio.findMany.mockResolvedValue([]);

    const result = await AccountingReconciliationService.reconcileService({
      user,
      input: {
        ventaServicioId: 'service-false-state', fechaReconciliacion: '2026-09-25',
        distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 100,
          moneda: 'USD', tasaCambio: 24, fechaTasa: '2026-09-25' }],
      },
    });

    expect(result.reconciliado).toBe(true);
    expect(tx.ventaServicios.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        ventaServicioId: 'service-false-state',
        tenantId: 'tenant-1',
        OR: [{ reconciliado: null }, { reconciliado: false }],
      }),
      data: { reconciliado: true },
    }));
  });

  it('persists functional conversion at four decimals before posting the receipt', async () => {
    tx.ventaServicios.findFirst.mockResolvedValue({ total: 0.01, reconciliado: null });
    tx.cuentaPorCobrar.findFirst.mockResolvedValue({
      idCC: 7, montoDeuda: 0.01, montoPagado: 0, montoOriginal: 0.01,
      montoDeudaFuncional: 0.0125, montoPagadoFuncional: null,
      monedaOriginal: 'USD', monedaFuncional: 'CUP', tasaCambio: 1.25,
      fxEvidenceFingerprint: 'cxc-fx-precision', fxEvidenceVersion: 2, estado: 'PENDIENTE',
    });
    tx.reconciliacionServicio.findMany.mockResolvedValue([]);
    tx.reconciliacionServicio.create.mockImplementation(async ({ data }) => ({
      ...data, reconciliacionId: 'receipt-precision',
    }));

    await AccountingReconciliationService.reconcileService({ user, input: {
      ventaServicioId: 'service-precision', fechaReconciliacion: '2026-09-25T12:00:00Z',
      distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 0.005,
        moneda: 'USD', tasaCambio: 1.25 }],
    } });

    const saved = tx.reconciliacionServicio.create.mock.calls[0][0].data;
    expect(new Prisma.Decimal(saved.montoConvertido).toString()).toBe('0.0063');
    expect(saved.fxEvidenceFingerprint).toBeTruthy();
    expect(postEvento.mock.calls[0][2].montoFuncional.toString()).toBe('0.0063');
  });

  it.each([
    ['currency mismatch', { monedaOriginal: 'EUR' }, 'USD', 'FX_INSUFICIENTE'],
    ['missing persisted evidence', { fxEvidenceFingerprint: null }, 'USD', 'FX_INSUFICIENTE'],
  ])('rejects a service-credit %s before bank or posting writes', async (_name, cxcPatch, currency, code) => {
    tx.ventaServicios.findFirst.mockResolvedValue({ total: 100, reconciliado: null });
    tx.cuentaPorCobrar.findFirst.mockResolvedValue({
      idCC: 7, montoDeuda: 100, montoPagado: 0, montoOriginal: 100,
      montoDeudaFuncional: 2400, montoPagadoFuncional: null,
      monedaOriginal: 'USD', monedaFuncional: 'CUP', tasaCambio: 24,
      fxEvidenceFingerprint: 'cxc-fx-v2', fxEvidenceVersion: 2, estado: 'PENDIENTE',
      ...cxcPatch,
    });
    tx.reconciliacionServicio.findMany.mockResolvedValue([]);

    await expect(AccountingReconciliationService.reconcileService({ user, input: {
      ventaServicioId: 'service-1', fechaReconciliacion: '2026-09-25T12:00:00Z',
      distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 20,
        moneda: currency, tasaCambio: 25 }],
    } })).rejects.toMatchObject({ code });

    expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
    expect(tx.reconciliacionServicio.create).not.toHaveBeenCalled();
    expect(tx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
    expect(postEvento).not.toHaveBeenCalled();
  });

  it('rejects service-credit overpayment before any financial write', async () => {
    tx.ventaServicios.findFirst.mockResolvedValue({ total: 100, reconciliado: null });
    tx.cuentaPorCobrar.findFirst.mockResolvedValue({
      idCC: 7, montoDeuda: 100, montoPagado: 0, montoOriginal: 100,
      montoDeudaFuncional: 2400, montoPagadoFuncional: null,
      monedaOriginal: 'USD', monedaFuncional: 'CUP', tasaCambio: 24,
      fxEvidenceFingerprint: 'cxc-fx-v2', fxEvidenceVersion: 2, estado: 'PENDIENTE',
    });
    tx.reconciliacionServicio.findMany.mockResolvedValue([]);

    await expect(AccountingReconciliationService.reconcileService({ user, input: {
      ventaServicioId: 'service-1', fechaReconciliacion: '2026-09-25T12:00:00Z',
      distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 101,
        moneda: 'USD', tasaCambio: 25 }],
    } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
    expect(tx.reconciliacionServicio.create).not.toHaveBeenCalled();
    expect(postEvento).not.toHaveBeenCalled();
  });

  it('rejects prior service receipts without complete FX evidence before writes', async () => {
    tx.ventaServicios.findFirst.mockResolvedValue({ total: 100, reconciliado: null });
    tx.cuentaPorCobrar.findFirst.mockResolvedValue({
      idCC: 7, montoDeuda: 100, montoPagado: 10, montoOriginal: 100,
      montoDeudaFuncional: 2400, montoPagadoFuncional: 240,
      monedaOriginal: 'USD', monedaFuncional: 'CUP', tasaCambio: 24,
      fxEvidenceFingerprint: 'cxc-fx-v2', fxEvidenceVersion: 2, estado: 'PARCIAL',
    });
    tx.reconciliacionServicio.findMany.mockResolvedValue([{
      monto: 10, moneda: 'USD', montoConvertido: 240, functionalCurrency: 'CUP',
      fxEvidenceFingerprint: null, fxEvidenceVersion: null,
    }]);

    await expect(AccountingReconciliationService.reconcileService({ user, input: {
      ventaServicioId: 'service-1', fechaReconciliacion: '2026-09-25T12:00:00Z',
      distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 10,
        moneda: 'USD', tasaCambio: 25 }],
    } })).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });

    expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
    expect(tx.reconciliacionServicio.create).not.toHaveBeenCalled();
    expect(tx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
    expect(postEvento).not.toHaveBeenCalled();
  });

  it.each([
    ['functional paid balance differs from receipt history', 10, 241, 10, 240],
    ['nominal paid balance differs from receipt history', 11, 240, 10, 240],
  ])('rejects populated service receipt history when %s before financial writes',
    async (_case, persistedNominal, persistedFunctional, receiptNominal, receiptFunctional) => {
      tx.ventaServicios.findFirst.mockResolvedValue({ total: 100, reconciliado: null });
      tx.cuentaPorCobrar.findFirst.mockResolvedValue({
        idCC: 7, montoDeuda: 100, montoPagado: persistedNominal, montoOriginal: 100,
        montoDeudaFuncional: 2400, montoPagadoFuncional: persistedFunctional,
        monedaOriginal: 'USD', monedaFuncional: 'CUP', tasaCambio: 24,
        fxEvidenceFingerprint: 'cxc-fx-v2', fxEvidenceVersion: 2, estado: 'PARCIAL',
      });
      tx.reconciliacionServicio.findMany.mockResolvedValue([{
        monto: receiptNominal, moneda: 'USD', montoConvertido: receiptFunctional,
        functionalCurrency: 'CUP', fxEvidenceFingerprint: 'receipt-fx', fxEvidenceVersion: 2,
      }]);

      await expect(AccountingReconciliationService.reconcileService({ user, input: {
        ventaServicioId: 'service-1', fechaReconciliacion: '2026-09-25T12:00:00Z',
        distribuciones: [{ cuentaId: 'bank-1', tipoPagoId: 'cash-1', monto: 10,
          moneda: 'USD', tasaCambio: 25 }],
      } })).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });

      expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
      expect(tx.reconciliacionServicio.create).not.toHaveBeenCalled();
      expect(tx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
      expect(postEvento).not.toHaveBeenCalled();
    });
});

describe('reconcileSale — saldo CxC con evidencia FX persistida', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.reconciliacionVenta.findMany.mockReset();
    tx.venta.findUnique.mockResolvedValue({
      tenantId: 'tenant-1', deletedAt: null, clienteId: 'client-1', factura: null,
    });
    tx.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'bank-1', isActive: true, tipoCuenta: 'BANCO' });
    tx.tipoPago.findFirst.mockResolvedValue({ tipoId: 'cash-1', isActive: true });
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 });
    tx.cuentaPorCobrar.findFirst.mockResolvedValue({
      idCC: 'cxc-1',
      montoDeuda: 100,
      montoPagado: 20,
      montoDeudaFuncional: 2400,
      montoPagadoFuncional: 500,
      montoOriginal: 100,
      monedaOriginal: 'USD',
      monedaFuncional: 'CUP',
      tasaCambio: 24,
      fxEvidenceFingerprint: 'origin-fx-fingerprint',
      fxEvidenceVersion: 2,
      estado: 'PARCIAL',
    });
    tx.reconciliacionVenta.create.mockImplementation(async ({ data }) => ({
      ...data,
      reconciliacionId: 'rec-sale-1',
    }));
    tx.reconciliacionVenta.findMany.mockResolvedValue([{
      monto: 20,
      moneda: 'USD',
      montoConvertido: 500,
      functionalCurrency: 'CUP',
      fxEvidenceFingerprint: 'previous-fx-fingerprint',
    }]);
    tx.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 1 });
  });

  it('valora FX contra el snapshot redondeado y conserva cuatro decimales', async () => {
    tx.cuentaPorCobrar.findFirst.mockResolvedValueOnce({
      idCC: 'cxc-precision',
      montoDeuda: 1,
      montoPagado: 0,
      montoDeudaFuncional: 1.2346,
      montoPagadoFuncional: 0,
      montoOriginal: 1,
      monedaOriginal: 'USD',
      monedaFuncional: 'CUP',
      tasaCambio: 1.2345678901,
      fxEvidenceFingerprint: 'origin-fx-precision',
      fxEvidenceVersion: 2,
      estado: 'PENDIENTE',
    });
    tx.reconciliacionVenta.findMany.mockResolvedValueOnce([]);

    await AccountingReconciliationService.reconcileSale({
      user,
      input: {
        ventaId: 'sale-1', cuentaId: 'bank-1', tipoPagoId: 'cash-1',
        monto: 0.5, moneda: 'USD', tasaCambio: 1.25,
        fechaReconciliacion: '2026-09-25T12:00:00.000Z',
      },
    });

    expect(postEvento.mock.calls[0][2].auxiliares.diferenciaFx.toString()).toBe('0.0077');
    expect(tx.cuentaPorCobrar.updateMany).toHaveBeenCalledTimes(1);
    expect(String(tx.$queryRaw.mock.calls[0]?.[0])).toContain('"Cliente"');
    expect(String(tx.$queryRaw.mock.calls[0]?.[0])).toContain('FOR UPDATE');
  });

  it('asigna el residual de redondeo al abono que liquida el principal', async () => {
    tx.cuentaPorCobrar.findFirst.mockResolvedValue({
      idCC: 'cxc-residual',
      montoDeuda: 0.01,
      montoPagado: 0,
      montoDeudaFuncional: 0.0123,
      montoPagadoFuncional: 0,
      montoOriginal: 0.01,
      monedaOriginal: 'USD',
      monedaFuncional: 'CUP',
      tasaCambio: 1.2345,
      fxEvidenceFingerprint: 'origin-fx-residual',
      fxEvidenceVersion: 2,
      estado: 'PENDIENTE',
    });
    tx.reconciliacionVenta.findMany.mockResolvedValue([]);

    const reconciliar = () => AccountingReconciliationService.reconcileSale({
      user,
      input: {
        ventaId: 'sale-1', cuentaId: 'bank-1', tipoPagoId: 'cash-1',
        monto: 0.005, moneda: 'USD', tasaCambio: 1.25,
        fechaReconciliacion: '2026-09-25T12:00:00.000Z',
      },
    });

    await reconciliar();
    tx.reconciliacionVenta.findMany.mockResolvedValue([{
      monto: 0.005,
      moneda: 'USD',
      montoConvertido: 0.0063,
      functionalCurrency: 'CUP',
      fxEvidenceFingerprint: 'previous-fx-residual',
    }]);
    await reconciliar();

    const diferencias = postEvento.mock.calls.map((call) =>
      call[2].auxiliares.diferenciaFx.toString(),
    );
    expect(diferencias).toEqual(['0.0001', '0.0002']);
    expect(tx.cuentaPorCobrar.updateMany.mock.calls.at(-1)?.[0].data.estado).toBe('PAGADA');
    const valorCxcLiquidado = 0.0063 - Number(diferencias[0]) + 0.0063 - Number(diferencias[1]);
    expect(valorCxcLiquidado).toBeCloseTo(0.0123, 10);
  });

  it('acumula nominal y funcional por separado y no liquida 40 USD como 1000 unidades nominales', async () => {
    await AccountingReconciliationService.reconcileSale({
      user,
      input: {
        ventaId: 'sale-1',
        cuentaId: 'bank-1',
        tipoPagoId: 'cash-1',
        monto: 40,
        moneda: 'USD',
        tasaCambio: 25,
        fechaReconciliacion: '2026-09-25T12:00:00.000Z',
      },
    });

    const update = tx.cuentaPorCobrar.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({ idCC: 'cxc-1', tenantId: 'tenant-1' });
    expect(update.data.estado).toBe('PARCIAL');
    expect(update.data.montoPagado.toString()).toBe('60');
    expect(update.data.montoPagadoFuncional.toString()).toBe('1500');
    const evento = postEvento.mock.calls[0][2];
    expect(evento.tipo).toBe('COBRO_CXC');
    expect(evento.auxiliares.diferenciaFx.toString()).toBe('40');
  });

  it('registra diferencia FX desfavorable como gasto sin alterar el saldo nominal', async () => {
    tx.reconciliacionVenta.create.mockImplementationOnce(async ({ data }) => ({
      ...data,
      montoConvertido: 920,
      tasaCambio: 23,
      fxEvidenceFingerprint: 'receipt-loss-fingerprint',
      reconciliacionId: 'rec-loss-1',
    }));
    tx.reconciliacionVenta.findMany.mockResolvedValueOnce([]);

    await AccountingReconciliationService.reconcileSale({
      user,
      input: {
        ventaId: 'sale-1', cuentaId: 'bank-1', tipoPagoId: 'cash-1',
        monto: 40, moneda: 'USD', tasaCambio: 23,
        fechaReconciliacion: '2026-09-25T12:00:00.000Z',
      },
    });

    const update = tx.cuentaPorCobrar.updateMany.mock.calls[0][0];
    expect(update.data.estado).toBe('PARCIAL');
    expect(update.data.montoPagado.toString()).toBe('40');
    expect(update.data.montoPagadoFuncional.toString()).toBe('920');
    expect(postEvento.mock.calls[0][2].auxiliares.diferenciaFx.toString()).toBe('-40');
  });

  it('rechaza el cobro en moneda distinta a la del snapshot antes de mover tesorería', async () => {
    await expect(AccountingReconciliationService.reconcileSale({
      user,
      input: {
        ventaId: 'sale-1', cuentaId: 'bank-1', tipoPagoId: 'cash-1',
        monto: 960, moneda: 'CUP',
      },
    })).rejects.toThrow('moneda del cobro');

    expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
    expect(tx.reconciliacionVenta.create).not.toHaveBeenCalled();
    expect(postEvento).not.toHaveBeenCalled();
  });
});
