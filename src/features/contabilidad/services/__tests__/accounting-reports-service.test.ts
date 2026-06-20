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
});
