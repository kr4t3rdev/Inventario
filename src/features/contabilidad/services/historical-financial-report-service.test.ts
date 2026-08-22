import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const mock = {
    periodoContable: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation(async (callback) => callback(mock));
  return mock;
});

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const balance = {
  asOf: '2025-12-31T23:59:59.999Z',
  functionalCurrency: 'CUP',
  assets: {
    cashAndBanks: 100,
    inventory: { historical: 20, estimated: 0, total: 20 },
    receivables: 30,
    total: 150,
  },
  liabilities: { payables: 40, externalDebt: 10, total: 50 },
  equity: { capital: 80, retainedEarnings: 10, currentResult: 10, total: 100 },
  equation: {
    assets: 150,
    liabilitiesAndEquity: 150,
    difference: 0,
    status: 'CUADRADO' as const,
  },
  coverage: { complete: true, unresolvedCount: 0, unresolvedAmount: 0, parts: [] },
  estimates: [],
  incidents: [],
};

const result = {
  monthly: [],
  annual: { reconciledResult: 10 },
  incidents: [],
  estimates: [],
  functionalCurrency: 'CUP',
  timeZone: 'America/Havana',
};

describe('historical financial report service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('declara provisional el período contable actual abierto y conserva el corte exacto', async () => {
    prismaMock.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'period-2026',
      estado: 'ABIERTO',
      fechaInicio: new Date('2026-01-01T05:00:00.000Z'),
      fechaFin: new Date('2027-01-01T04:59:59.999Z'),
      snapshotPeriodos: [],
    });
    const calculateLive = vi.fn().mockResolvedValue({ balance, result });
    const { resolveFinancialReport } = await import(
      '@/features/contabilidad/services/historical-financial-report-service'
    );
    const now = new Date('2026-08-21T15:30:00.000Z');

    const report = await resolveFinancialReport({
      tenantId: 'tenant-1',
      year: 2026,
      now,
      calculateLive,
    });

    expect(report).toMatchObject({
      status: 'AVAILABLE',
      origin: 'LIVE',
      provisional: true,
      cutoffAt: now.toISOString(),
      periodId: 'period-2026',
    });
    expect(calculateLive).toHaveBeenCalledWith(now);
  });

  it('devuelve el snapshot aprobado v2 sin recalcular datos actuales', async () => {
    const {
      createFinancialSnapshot,
      resolveFinancialReport,
    } = await import('@/features/contabilidad/services/historical-financial-report-service');
    const snapshot = await createFinancialSnapshot({
      cutoffAt: new Date('2025-12-31T23:59:59.999Z'),
      capturedAt: new Date('2026-01-02T12:00:00.000Z'),
      balance,
      result,
      sources: { bankAccounts: 2, reconciliations: 14 },
    });
    prismaMock.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'period-2025',
      estado: 'APROBADO',
      fechaInicio: new Date('2025-01-01T05:00:00.000Z'),
      fechaFin: new Date('2026-01-01T04:59:59Z'),
      hashIntegridad: snapshot.hash,
      snapshotPeriodos: [{
        snapshotId: 'snapshot-v2',
        version: 1,
        resumenJson: snapshot.payload,
        hashIntegridad: snapshot.hash,
        createdAt: new Date('2026-01-02T12:00:00.000Z'),
      }],
    });
    const calculateLive = vi.fn();

    const report = await resolveFinancialReport({
      tenantId: 'tenant-1',
      year: 2025,
      now: new Date('2026-08-21T15:30:00.000Z'),
      calculateLive,
    });

    expect(report).toMatchObject({
      status: 'AVAILABLE',
      origin: 'SNAPSHOT',
      provisional: false,
      snapshotVersion: 2,
      integrity: 'VALID',
      balance,
      result,
    });
    expect(calculateLive).not.toHaveBeenCalled();
  });

  it('no recalcula live un período actual que ya está cerrado', async () => {
    prismaMock.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'period-2026',
      estado: 'CERRADO',
      fechaInicio: new Date('2026-01-01T05:00:00.000Z'),
      fechaFin: new Date('2027-01-01T04:59:59.000Z'),
      snapshotPeriodos: [],
    });
    const calculateLive = vi.fn().mockResolvedValue({ balance, result });
    const { resolveFinancialReport } = await import(
      '@/features/contabilidad/services/historical-financial-report-service'
    );

    const report = await resolveFinancialReport({
      tenantId: 'tenant-1',
      year: 2026,
      now: new Date('2026-08-21T15:30:00.000Z'),
      calculateLive,
    });

    expect(report).toEqual({
      status: 'UNAVAILABLE',
      reason: 'PERIOD_NOT_APPROVED',
      periodId: 'period-2026',
    });
    expect(calculateLive).not.toHaveBeenCalled();
  });

  it('rechaza un snapshot v2 modificado después de su aprobación', async () => {
    const {
      createFinancialSnapshot,
      resolveFinancialReport,
    } = await import('@/features/contabilidad/services/historical-financial-report-service');
    const snapshot = await createFinancialSnapshot({
      cutoffAt: new Date('2025-12-31T23:59:59.999Z'),
      capturedAt: new Date('2026-01-02T12:00:00.000Z'),
      balance,
      result,
      sources: {},
    });
    prismaMock.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'period-2025',
      estado: 'APROBADO',
      fechaInicio: new Date('2025-01-01T05:00:00.000Z'),
      fechaFin: new Date('2026-01-01T04:59:59.999Z'),
      snapshotPeriodos: [{
        snapshotId: 'snapshot-v2',
        version: 1,
        resumenJson: {
          ...snapshot.payload,
          balance: { ...balance, assets: { ...balance.assets, total: 999 } },
        },
        hashIntegridad: snapshot.hash,
        createdAt: new Date('2026-01-02T12:00:00.000Z'),
      }],
    });

    const report = await resolveFinancialReport({
      tenantId: 'tenant-1',
      year: 2025,
      now: new Date('2026-08-21T15:30:00.000Z'),
      calculateLive: vi.fn(),
    });

    expect(report).toMatchObject({
      status: 'UNAVAILABLE',
      reason: 'INTEGRITY_FAILED',
      periodId: 'period-2025',
    });
  });

  it('marca snapshots legacy v1 como evidencia incompleta sin usar saldos actuales', async () => {
    prismaMock.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'period-2024',
      estado: 'APROBADO',
      fechaInicio: new Date('2024-01-01T05:00:00.000Z'),
      fechaFin: new Date('2025-01-01T04:59:59.999Z'),
      snapshotPeriodos: [{
        snapshotId: 'snapshot-v1',
        version: 1,
        resumenJson: { version: 1, saldosPorMoneda: { CUP: 200 } },
        hashIntegridad: 'legacy-hash',
        createdAt: new Date('2025-01-02T12:00:00.000Z'),
      }],
    });
    const calculateLive = vi.fn();
    const { resolveFinancialReport } = await import(
      '@/features/contabilidad/services/historical-financial-report-service'
    );

    const report = await resolveFinancialReport({
      tenantId: 'tenant-1',
      year: 2024,
      now: new Date('2026-08-21T15:30:00.000Z'),
      calculateLive,
    });

    expect(report).toMatchObject({
      status: 'UNAVAILABLE',
      reason: 'LEGACY_INCOMPLETE',
      snapshotVersion: 1,
      periodId: 'period-2024',
    });
    expect(calculateLive).not.toHaveBeenCalled();
  });

  it('no ofrece un período aprobado sin snapshot histórico', async () => {
    prismaMock.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'period-2024',
      estado: 'APROBADO',
      fechaInicio: new Date('2024-01-01T05:00:00.000Z'),
      fechaFin: new Date('2025-01-01T04:59:59.999Z'),
      snapshotPeriodos: [],
    });
    const { resolveFinancialReport } = await import(
      '@/features/contabilidad/services/historical-financial-report-service',
    );

    const report = await resolveFinancialReport({
      tenantId: 'tenant-1',
      year: 2024,
      now: new Date('2026-08-21T15:30:00.000Z'),
      calculateLive: vi.fn(),
    });

    expect(report).toMatchObject({
      status: 'UNAVAILABLE',
      reason: 'NO_HISTORICAL_EVIDENCE',
      periodId: 'period-2024',
    });
  });

  it('no usa el cálculo live para un período histórico todavía abierto', async () => {
    prismaMock.periodoContable.findFirst.mockResolvedValue({
      periodoId: 'period-2025',
      estado: 'ABIERTO',
      fechaInicio: new Date('2025-01-01T05:00:00.000Z'),
      fechaFin: new Date('2026-01-01T04:59:59.999Z'),
      snapshotPeriodos: [],
    });
    const calculateLive = vi.fn();
    const { resolveFinancialReport } = await import(
      '@/features/contabilidad/services/historical-financial-report-service',
    );

    const report = await resolveFinancialReport({
      tenantId: 'tenant-1',
      year: 2025,
      now: new Date('2026-08-21T15:30:00.000Z'),
      calculateLive,
    });

    expect(report).toMatchObject({
      status: 'UNAVAILABLE',
      reason: 'PERIOD_NOT_APPROVED',
      periodId: 'period-2025',
    });
    expect(calculateLive).not.toHaveBeenCalled();
  });

  it('ofrece únicamente años aprobados con snapshot v2 íntegro', async () => {
    const {
      createFinancialSnapshot,
      listAvailableFinancialPeriods,
    } = await import('@/features/contabilidad/services/historical-financial-report-service');
    const validSnapshot = await createFinancialSnapshot({
      cutoffAt: new Date('2025-12-31T23:59:59.999Z'),
      capturedAt: new Date('2026-01-02T12:00:00.000Z'),
      balance,
      result,
      sources: {},
    });
    prismaMock.periodoContable.findMany.mockResolvedValue([
      {
        periodoId: 'period-2025',
        codigo: 'A-2025',
        estado: 'APROBADO',
        fechaInicio: new Date('2025-01-01T05:00:00.000Z'),
        fechaFin: new Date('2026-01-01T04:59:59.999Z'),
        hashIntegridad: validSnapshot.hash,
        snapshotPeriodos: [{
          snapshotId: 'snapshot-v2',
          version: 1,
          resumenJson: validSnapshot.payload,
          hashIntegridad: validSnapshot.hash,
          createdAt: new Date('2026-01-02T12:00:00.000Z'),
        }],
      },
      {
        periodoId: 'period-2024',
        codigo: 'A-2024',
        estado: 'APROBADO',
        fechaInicio: new Date('2024-01-01T05:00:00.000Z'),
        fechaFin: new Date('2025-01-01T04:59:59.999Z'),
        snapshotPeriodos: [{
          snapshotId: 'snapshot-v1',
          version: 1,
          resumenJson: { version: 1 },
          hashIntegridad: 'legacy-hash',
          createdAt: new Date('2025-01-02T12:00:00.000Z'),
        }],
      },
    ]);

    const periods = await listAvailableFinancialPeriods('tenant-1');

    expect(periods).toEqual([{
      periodId: 'period-2025',
      code: 'A-2025',
      year: 2025,
      cutoffAt: validSnapshot.payload.cutoffAt,
      snapshotVersion: 2,
    }]);
  });
});
