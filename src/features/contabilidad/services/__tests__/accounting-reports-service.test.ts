import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: { findMany: vi.fn() },
    reconciliacionVenta: { findMany: vi.fn() },
    reconciliacionServicio: { findMany: vi.fn() },
    reconciliacionGasto: { findMany: vi.fn() },
    transferenciaBancaria: { findMany: vi.fn() },
    ajusteBancario: { findMany: vi.fn() },
    inyeccionCapital: { findMany: vi.fn() },
    pagoDeuda: { findMany: vi.fn() },
    tasaCambio: { findMany: vi.fn() },
    transaccionMoneda: { findMany: vi.fn() },
    moneda: { findMany: vi.fn() },
  },
}));

function mockAllFindManyEmpty() {
  vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.reconciliacionServicio.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.reconciliacionGasto.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.transferenciaBancaria.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.ajusteBancario.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.inyeccionCapital.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.pagoDeuda.findMany).mockResolvedValue([] as never);
}

import { prisma } from '@/lib/prisma';

describe('AccountingReportsService', () => {
  it('exposes mobile reports methods for exchange slices', async () => {
    const { AccountingReportsService } = await import('../accounting-reports-service');

    expect(typeof AccountingReportsService.getSummaryReport).toBe('function');
    expect(typeof AccountingReportsService.getMovementsReport).toBe('function');
    expect(typeof AccountingReportsService.getExchangeReport).toBe('function');
    expect(typeof AccountingReportsService.getExchangeImpactReport).toBe('function');
    expect(typeof AccountingReportsService.getTransfersReport).toBe('function');
    expect(typeof AccountingReportsService.getOverdueInvoicesReport).toBe('function');
    expect(typeof AccountingReportsService.getClientAccountAnalysisReport).toBe('function');
    expect(typeof AccountingReportsService.getCustomerAdvancesReport).toBe('function');
    expect(typeof AccountingReportsService.getProviderAdvancesReport).toBe('function');
    expect(typeof AccountingReportsService.getAdvancesSummaryReport).toBe('function');
  });

  it('scopes exchange report records to the requested tenant', async () => {
    const findManyMocks = [
      prisma.tasaCambio.findMany,
      prisma.transaccionMoneda.findMany,
      prisma.reconciliacionVenta.findMany,
      prisma.reconciliacionServicio.findMany,
      prisma.reconciliacionGasto.findMany,
      prisma.ajusteBancario.findMany,
      prisma.transferenciaBancaria.findMany,
    ];
    findManyMocks.forEach((findMany) => vi.mocked(findMany).mockResolvedValue([] as never));

    const { AccountingReportsService } = await import('../accounting-reports-service');
    await AccountingReportsService.getExchangeReport({ tenantId: 'tenant-a' });

    for (const findMany of [
      prisma.reconciliacionVenta.findMany,
      prisma.reconciliacionServicio.findMany,
      prisma.reconciliacionGasto.findMany,
      prisma.ajusteBancario.findMany,
      prisma.transferenciaBancaria.findMany,
    ]) {
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-a' }),
        }),
      );
    }
  });

  it('scopes exchange impact records to the requested tenant', async () => {
    const findManyMocks = [
      prisma.reconciliacionVenta.findMany,
      prisma.reconciliacionServicio.findMany,
      prisma.reconciliacionGasto.findMany,
      prisma.ajusteBancario.findMany,
      prisma.transferenciaBancaria.findMany,
    ];
    findManyMocks.forEach((findMany) => vi.mocked(findMany).mockResolvedValue([] as never));
    vi.mocked(prisma.moneda.findMany).mockResolvedValue([] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    await AccountingReportsService.getExchangeImpactReport({ tenantId: 'tenant-a' });

    for (const findMany of findManyMocks) {
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-a' }),
        }),
      );
    }
  });

  it('limits legacy currency transactions to tenant-owned references', async () => {
    const emptyFindManyMocks = [
      prisma.tasaCambio.findMany,
      prisma.reconciliacionServicio.findMany,
      prisma.reconciliacionGasto.findMany,
      prisma.ajusteBancario.findMany,
      prisma.transferenciaBancaria.findMany,
    ];
    emptyFindManyMocks.forEach((findMany) => vi.mocked(findMany).mockResolvedValue([] as never));
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
      {
        reconciliacionId: 'rec-a',
        venta: { ventaId: 'sale-a' },
        monto: 10,
        moneda: 'USD',
        montoConvertido: 10,
        tasaCambio: 1,
        fechaReconciliacion: new Date(),
      },
    ] as never);
    vi.mocked(prisma.transaccionMoneda.findMany).mockResolvedValue([] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    await AccountingReportsService.getExchangeReport({ tenantId: 'tenant-a' });

    expect(prisma.transaccionMoneda.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { tipoTransaccion: 'venta', referenciaId: { in: ['sale-a'] } },
          ]),
        }),
      }),
    );
  });

  it('no suma directa CUP + USD: cada moneda tiene su propio flujo neto', async () => {
    mockAllFindManyEmpty();
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([
      { cuentaId: 'cup-1', saldo: 100, moneda: 'CUP' },
      { cuentaId: 'usd-1', saldo: 50, moneda: 'USD' },
    ] as never);
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
      { tipoReconciliacion: 'VENTA', monto: 1000, moneda: 'CUP', montoConvertido: 1000 },
      { tipoReconciliacion: 'VENTA', monto: 50, moneda: 'USD', montoConvertido: 50 },
    ] as never);
    vi.mocked(prisma.reconciliacionGasto.findMany).mockResolvedValue([
      { tipoReconciliacion: 'GASTO', monto: 200, moneda: 'CUP', montoConvertido: 200, estado: 'PAGADA', tipoGasto: 'GASTODE' },
      { tipoReconciliacion: 'GASTO', monto: 10, moneda: 'USD', montoConvertido: 10, estado: 'PAGADA', tipoGasto: 'GASTODE' },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({ tenantId: 'tenant-a' });

    const cup = result.resumenPorMoneda.find((r) => r.moneda === 'CUP');
    const usd = result.resumenPorMoneda.find((r) => r.moneda === 'USD');

    expect(cup).toBeDefined();
    expect(usd).toBeDefined();
    expect(cup!.totalIngresos).toBe(1000);
    expect(cup!.totalEgresos).toBe(200);
    expect(cup!.flujoNeto).toBe(800);
    expect(usd!.totalIngresos).toBe(50);
    expect(usd!.totalEgresos).toBe(10);
    expect(usd!.flujoNeto).toBe(40);
  });

  it('préstamos y anticipos permanecen separados por moneda del préstamo', async () => {
    mockAllFindManyEmpty();
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
      { tipoReconciliacion: 'PRESTAMO_CASH', monto: 500, moneda: 'CUP', montoConvertido: 500 },
      { tipoReconciliacion: 'PRESTAMO_CASH', monto: 100, moneda: 'USD', montoConvertido: 100 },
      { tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO', monto: 200, moneda: 'CUP', montoConvertido: 200 },
      { tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO', monto: 30, moneda: 'USD', montoConvertido: 30 },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({
      tenantId: 'tenant-a',
      includePrestamosCash: true,
    });
    const cup = result.resumenPorMoneda.find((r) => r.moneda === 'CUP');
    const usd = result.resumenPorMoneda.find((r) => r.moneda === 'USD');

    expect(cup!.totalIngresos).toBe(500);
    expect(cup!.totalEgresos).toBe(200);
    expect(usd!.totalIngresos).toBe(100);
    expect(usd!.totalEgresos).toBe(30);
  });

  it('filtros de cuenta y moneda se combinan correctamente', async () => {
    mockAllFindManyEmpty();
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([
      { cuentaId: 'c1', saldo: 100, moneda: 'CUP' },
    ] as never);
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
      { tipoReconciliacion: 'VENTA', monto: 100, moneda: 'CUP', montoConvertido: 100 },
      { tipoReconciliacion: 'VENTA', monto: 200, moneda: 'USD', montoConvertido: 200 },
    ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({
      tenantId: 'tenant-a',
      cuentaId: 'c1',
      moneda: 'CUP',
    });

    expect(result.resumenPorMoneda).toHaveLength(1);
    expect(result.resumenPorMoneda[0].moneda).toBe('CUP');
    expect(result.resumenPorMoneda[0].totalIngresos).toBe(100);
  });
});

describe('getSummaryReport - período anterior', () => {
  it('devuelve periodoAnterior null cuando no hay rango de fechas', async () => {
    mockAllFindManyEmpty();
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({ tenantId: 'tenant-a' });

    expect(result.periodoAnterior).toBeNull();
  });

  it('calcula totales del período anterior para la ventana previa de igual duración', async () => {
    mockAllFindManyEmpty();
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reconciliacionVenta.findMany).mockClear();
    vi.mocked(prisma.reconciliacionVenta.findMany)
      // Ventana actual: 100 CUP
      .mockResolvedValueOnce([
        { tipoReconciliacion: 'VENTA', monto: 100, moneda: 'CUP', montoConvertido: 100 },
      ] as never)
      // Ventana previa: 80 CUP
      .mockResolvedValueOnce([
        { tipoReconciliacion: 'VENTA', monto: 80, moneda: 'CUP', montoConvertido: 80 },
      ] as never);

    const { AccountingReportsService } = await import('../accounting-reports-service');
    const result = await AccountingReportsService.getSummaryReport({
      tenantId: 'tenant-a',
      fechaInicio: '2026-08-01',
      fechaFin: '2026-08-31',
    });

    expect(result.periodoAnterior).not.toBeNull();
    expect(result.periodoAnterior).toMatchObject({
      fechaInicio: '2026-07-01',
      fechaFin: '2026-07-31',
    });
    expect(result.periodoAnterior!.porMoneda.CUP).toEqual({
      totalIngresos: 80,
      totalEgresos: 0,
      saldoNeto: 80,
    });

    const ventasCalls = vi.mocked(prisma.reconciliacionVenta.findMany).mock.calls;
    expect(ventasCalls.length).toBe(2);
    expect(ventasCalls[1][0]).toMatchObject({ where: expect.any(Object) });
  });

  it('no consulta ventanas previas cuando faltan fechas', async () => {
    mockAllFindManyEmpty();
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reconciliacionVenta.findMany).mockClear();

    const { AccountingReportsService } = await import('../accounting-reports-service');
    await AccountingReportsService.getSummaryReport({ tenantId: 'tenant-a' });

    expect(vi.mocked(prisma.reconciliacionVenta.findMany).mock.calls.length).toBe(1);
  });
});
