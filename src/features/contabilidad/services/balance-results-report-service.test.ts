import { beforeEach, describe, expect, it, vi } from 'vitest';

const reportResolverMock = vi.hoisted(() => ({
  resolveFinancialReport: vi.fn(),
}));

const accountingServicesMock = vi.hoisted(() => ({
  getCurrentBalance: vi.fn(),
  getReconciledResultForYear: vi.fn(),
}));

vi.mock(
  '@/features/contabilidad/services/historical-financial-report-service',
  () => reportResolverMock,
);
vi.mock(
  '@/features/contabilidad/services/current-balance-service',
  () => accountingServicesMock,
);
vi.mock(
  '@/features/contabilidad/services/reconciled-result-service',
  () => ({
    ...accountingServicesMock,
    presentReconciledPeriod: (period: Record<string, unknown>) => period,
  }),
);

const balance = {
  assets: {
    cashAndBanks: 100,
    inventory: { historical: 20, estimated: 0, total: 20 },
    receivables: 30,
    total: 150,
  },
  liabilities: { payables: 40, externalDebt: 10, total: 50 },
  equity: { capital: 80, retainedEarnings: 10, currentResult: 10, total: 100 },
  equation: { assets: 150, liabilitiesAndEquity: 150, difference: 0, status: 'CUADRADO' },
  coverage: { complete: false, unresolvedCount: 1, unresolvedAmount: 5, parts: [] },
  estimates: ['inventory'],
  incidents: [],
  functionalCurrency: 'CUP',
};

const result = {
  monthly: [{ month: 1, reconciledResult: 10 }],
  annual: { reconciledResult: 10 },
  incidents: [],
  estimates: [],
  functionalCurrency: 'CUP',
  timeZone: 'America/Havana',
};

describe('balance results report service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accountingServicesMock.getReconciledResultForYear.mockResolvedValue(result);
    accountingServicesMock.getCurrentBalance.mockResolvedValue(balance);
    reportResolverMock.resolveFinancialReport.mockImplementation(async ({ calculateLive }) => ({
      status: 'AVAILABLE',
      origin: 'LIVE',
      provisional: true,
      cutoffAt: '2026-08-21T15:30:00.000Z',
      periodId: 'period-2026',
      result: await calculateLive(new Date('2026-08-21T15:30:00.000Z')).then((value: any) => value.result),
      balance: await Promise.resolve(balance),
    }));
  });

  it('requires a tenant before reading accounting data', async () => {
    const { getBalanceResultsReport } = await import('./balance-results-report-service');

    await expect(getBalanceResultsReport({ tenantId: '', year: 2026 })).rejects.toMatchObject({
      code: 'TENANT_REQUIRED',
      status: 403,
    });
    expect(reportResolverMock.resolveFinancialReport).not.toHaveBeenCalled();
  });

  it('returns one shared contract with explicit live coverage', async () => {
    const { getBalanceResultsReport } = await import('./balance-results-report-service');

    const report = await getBalanceResultsReport({ tenantId: 'tenant-1', year: 2026 });

    expect(report).toMatchObject({
      balance: {
        activos: expect.objectContaining({ total: 150 }),
        cobertura: balance.coverage,
        monedaFuncional: 'CUP',
        fechaCorte: '2026-08-21T15:30:00.000Z',
      },
      estadoResultados: {
        anual: result.annual,
        monedaFuncional: 'CUP',
        zonaHoraria: 'America/Havana',
      },
      reporte: {
        origen: 'LIVE',
        provisional: true,
        periodoId: 'period-2026',
      },
    });
    expect(accountingServicesMock.getReconciledResultForYear).toHaveBeenCalledTimes(1);
    expect(accountingServicesMock.getCurrentBalance).toHaveBeenCalledTimes(1);
    expect(accountingServicesMock.getReconciledResultForYear).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      year: 2026,
      cutoffAt: new Date('2026-08-21T15:30:00.000Z'),
    });
  });

  it('preserves partial coverage and validates the requested currency', async () => {
    const { getBalanceResultsReport } = await import('./balance-results-report-service');

    const report = await getBalanceResultsReport({
      tenantId: 'tenant-1',
      year: 2026,
      moneda: 'CUP',
    });
    expect(report.balance.cobertura).toEqual(balance.coverage);

    await expect(getBalanceResultsReport({
      tenantId: 'tenant-1',
      year: 2026,
      moneda: 'USD',
    })).rejects.toMatchObject({ code: 'CURRENCY_NOT_SUPPORTED', status: 400 });
  });

  it('exposes unavailable historical evidence without recalculating', async () => {
    reportResolverMock.resolveFinancialReport.mockResolvedValue({
      status: 'UNAVAILABLE',
      reason: 'NO_HISTORICAL_EVIDENCE',
      periodId: null,
    });
    const { getBalanceResultsReport } = await import('./balance-results-report-service');

    await expect(getBalanceResultsReport({ tenantId: 'tenant-1', year: 2025 })).rejects.toMatchObject({
      code: 'NO_HISTORICAL_EVIDENCE',
      status: 409,
    });
    expect(accountingServicesMock.getCurrentBalance).not.toHaveBeenCalled();
    expect(accountingServicesMock.getReconciledResultForYear).not.toHaveBeenCalled();
  });

  it('no acepta el corte del cliente como reloj del servidor en años históricos', async () => {
    const { getBalanceResultsReport } = await import('./balance-results-report-service');
    const clientCutoff = new Date('2025-12-31T23:59:59.000Z');

    await getBalanceResultsReport({
      tenantId: 'tenant-1',
      year: 2025,
      cutoffAt: clientCutoff,
    }).catch(() => undefined);

    expect(reportResolverMock.resolveFinancialReport).toHaveBeenCalledTimes(1);
    const resolverArgs = reportResolverMock.resolveFinancialReport.mock.calls[0]?.[0] as {
      now: Date;
    };
    expect(resolverArgs.now.getTime()).not.toBe(clientCutoff.getTime());
  });

  it('delega el corte exacto al resolver sin leer auxiliares mutables', async () => {
    const { getBalanceResultsReport } = await import('./balance-results-report-service');
    const currentYear = new Date().getFullYear();
    const clientCutoff = new Date(`${currentYear}-08-01T00:00:00.000Z`);
    reportResolverMock.resolveFinancialReport.mockResolvedValue({
      status: 'AVAILABLE',
      origin: 'CHECKPOINT',
      provisional: false,
      cutoffAt: clientCutoff.toISOString(),
      resultThrough: clientCutoff.toISOString(),
      periodId: null,
      checkpointId: 'checkpoint-1',
      integrity: 'VALID',
      balance,
      result,
    });

    await getBalanceResultsReport({
      tenantId: 'tenant-1',
      year: currentYear,
      cutoffAt: clientCutoff,
    });

    expect(reportResolverMock.resolveFinancialReport).toHaveBeenCalledWith(expect.objectContaining({
      requestedCutoffAt: clientCutoff,
    }));
    expect(accountingServicesMock.getReconciledResultForYear).not.toHaveBeenCalled();
    expect(accountingServicesMock.getCurrentBalance).not.toHaveBeenCalled();
  });
});
