import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');

const serviceMock = vi.hoisted(() => ({
  getBalanceResultsReport: vi.fn(),
}));

vi.mock(
  '@/features/contabilidad/services/balance-results-report-service',
  () => serviceMock,
);

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { getBalanceResultsAction } from './actions-balance-results';

const user = {
  userId: 'user-1',
  name: 'Contabilidad',
  email: 'accounting@example.com',
  role: 'user' as const,
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'economico' as const,
  planFeatures: { contabilidad: true },
};

describe('getBalanceResultsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    serviceMock.getBalanceResultsReport.mockResolvedValue({
      balance: {},
      estadoResultados: {},
      reporte: {},
    });
  });

  it('requires the accounting feature and delegates the normalized input', async () => {
    const result = await getBalanceResultsAction({
      year: '2026',
      cutoffAt: '2026-08-21T15:30:00.000Z',
      moneda: 'cup',
    });

    expect(result).toEqual({
      success: true,
      data: { balance: {}, estadoResultados: {}, reporte: {} },
    });
    expect(serviceMock.getBalanceResultsReport).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      year: 2026,
      cutoffAt: new Date('2026-08-21T15:30:00.000Z'),
      moneda: 'CUP',
    });
  });

  it('returns a validation error for an invalid period or cutoff', async () => {
    const result = await getBalanceResultsAction({
      year: 'not-a-year',
      cutoffAt: 'not-a-date',
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(serviceMock.getBalanceResultsReport).not.toHaveBeenCalled();
  });

  it('rejects users without accounting access', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...user,
      planFeatures: { contabilidad: false },
    });

    const result = await getBalanceResultsAction({});

    expect(result).toMatchObject({
      success: false,
      error: { code: 'FEATURE_NOT_AVAILABLE' },
    });
    expect(serviceMock.getBalanceResultsReport).not.toHaveBeenCalled();
  });

  it('returns a tenant error when no company is selected', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...user, tenantId: undefined });

    const result = await getBalanceResultsAction({});

    expect(result).toMatchObject({
      success: false,
      error: { code: 'TENANT_REQUIRED' },
    });
    expect(serviceMock.getBalanceResultsReport).not.toHaveBeenCalled();
  });
});
