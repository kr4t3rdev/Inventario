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
});
