import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  },
}));

import { prisma } from '@/lib/prisma';
import { endOfDay } from '@/lib/date-range';

describe('AccountingReportsService tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const model of [
      prisma.cuentaBancaria,
      prisma.reconciliacionVenta,
      prisma.reconciliacionServicio,
      prisma.reconciliacionGasto,
      prisma.transferenciaBancaria,
      prisma.ajusteBancario,
      prisma.inyeccionCapital,
      prisma.pagoDeuda,
    ]) {
      vi.mocked(model.findMany).mockResolvedValue([] as never);
    }
  });

  it('scopes every summary query to the authenticated tenant', async () => {
    const { AccountingReportsService } = await import('../accounting-reports-service');

    await AccountingReportsService.getSummaryReport({ tenantId: 'tenant-a' });

    expect(prisma.cuentaBancaria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
    expect(prisma.reconciliacionVenta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
    expect(prisma.reconciliacionServicio.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
    expect(prisma.reconciliacionGasto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
    expect(prisma.transferenciaBancaria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
    expect(prisma.ajusteBancario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
    expect(prisma.inyeccionCapital.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cuentaBancaria: { tenantId: 'tenant-a' } }),
      }),
    );
    expect(prisma.pagoDeuda.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cuentaBancaria: { tenantId: 'tenant-a' } }),
      }),
    );
  });

  it('scopes every movement query to the authenticated tenant', async () => {
    const { AccountingReportsService } = await import('../accounting-reports-service');

    await AccountingReportsService.getMovementsReport({ tenantId: 'tenant-a' });

    for (const query of [
      prisma.reconciliacionVenta.findMany,
      prisma.reconciliacionServicio.findMany,
      prisma.reconciliacionGasto.findMany,
      prisma.transferenciaBancaria.findMany,
      prisma.ajusteBancario.findMany,
    ]) {
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
      );
    }

    for (const query of [prisma.inyeccionCapital.findMany, prisma.pagoDeuda.findMany]) {
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ cuentaBancaria: { tenantId: 'tenant-a' } }),
        }),
      );
    }
  });

  it('includes the full end date in summary and movement date filters', async () => {
    const { AccountingReportsService } = await import('../accounting-reports-service');

    await AccountingReportsService.getSummaryReport({
      tenantId: 'tenant-a',
      fechaFin: '2026-01-31',
    });

    expect(prisma.reconciliacionVenta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaReconciliacion: { lte: endOfDay('2026-01-31') },
        }),
      }),
    );

    vi.clearAllMocks();
    for (const model of [
      prisma.reconciliacionVenta,
      prisma.reconciliacionServicio,
      prisma.reconciliacionGasto,
      prisma.transferenciaBancaria,
      prisma.ajusteBancario,
      prisma.inyeccionCapital,
      prisma.pagoDeuda,
    ]) {
      vi.mocked(model.findMany).mockResolvedValue([] as never);
    }

    await AccountingReportsService.getMovementsReport({
      tenantId: 'tenant-a',
      fechaFin: '2026-01-31',
    });

    expect(prisma.reconciliacionVenta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaReconciliacion: { lte: endOfDay('2026-01-31') },
        }),
      }),
    );
  });
});
