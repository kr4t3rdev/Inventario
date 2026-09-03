import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  getSummaryReport: vi.fn(),
  getMonedasAction: vi.fn(),
  getPrestamosCashStatsAction: vi.fn(),
  getResumenAnticiposAction: vi.fn(),
  getReconciliacionStatsAction: vi.fn(),
}));

vi.mock('../services/accounting-reports-service', () => ({
  AccountingReportsService: { getSummaryReport: mocks.getSummaryReport },
}));
vi.mock('../actions-exchange', () => ({ getMonedasAction: mocks.getMonedasAction }));
vi.mock('../actions-prestamos-cash', () => ({
  getPrestamosCashStatsAction: mocks.getPrestamosCashStatsAction,
}));
vi.mock('../actions-anticipos', () => ({
  getResumenAnticiposAction: mocks.getResumenAnticiposAction,
}));
vi.mock('../actions-reconciliacion', () => ({
  getReconciliacionStatsAction: mocks.getReconciliacionStatsAction,
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { getResumenCompletoAction } from '../actions-resumen';

const adminCompleto = {
  userId: 'u1',
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin' as const,
  isActive: true,
  tenantId: 'tenant-a',
  tenantRole: 'manager' as const,
  planFeatures: {
    contabilidad: true,
    servicios: true,
    'prestamos-cash': true,
    'deudas-cash': true,
    anticipos: true,
  },
};

const resumenOk = { resumenPorMoneda: [{ moneda: 'CUP', saldoActual: 0, totalIngresos: 0, totalEgresos: 0 }] };

describe('getResumenCompletoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(adminCompleto as never);
    mocks.getSummaryReport.mockResolvedValue(resumenOk);
    mocks.getMonedasAction.mockResolvedValue({ success: true, data: [{ codigo: 'CUP', esPrincipal: true }] });
    mocks.getPrestamosCashStatsAction.mockResolvedValue({ success: true, data: { totalActivos: 2 } });
    mocks.getResumenAnticiposAction.mockResolvedValue({ success: true, data: { resumen: {} } });
    mocks.getReconciliacionStatsAction.mockResolvedValue({
      success: true,
      data: { modules: { ventas: { pending: 3 }, servicios: { pending: 1 }, gastos: { pending: 2 } } },
    });
  });

  it('agrega resumen, monedas, préstamos, anticipos y conteos en una sola respuesta', async () => {
    const result = await getResumenCompletoAction({ fechaInicio: '2026-08-01', fechaFin: '2026-08-31' });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      resumen: resumenOk,
      monedas: [{ codigo: 'CUP', esPrincipal: true }],
      prestamosStats: { totalActivos: 2 },
      conteos: { ventas: { pending: 3 }, servicios: { pending: 1 }, gastos: { pending: 2 } },
    });
    expect(mocks.getSummaryReport).toHaveBeenCalledTimes(1);
    expect(mocks.getReconciliacionStatsAction).toHaveBeenCalledTimes(1);
  });

  it('tolera fallos parciales: monedas fallidas devuelven [] sin romper el resumen', async () => {
    mocks.getMonedasAction.mockResolvedValue({ success: false, error: { message: 'fallo' } });

    const result = await getResumenCompletoAction({});

    expect(result.success).toBe(true);
    expect(result.data?.monedas).toEqual([]);
    expect(result.data?.resumen).toEqual(resumenOk);
  });

  it('no consulta préstamos si el plan no los incluye', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...adminCompleto,
      planFeatures: { contabilidad: true, anticipos: true },
    } as never);

    const result = await getResumenCompletoAction({});

    expect(result.success).toBe(true);
    expect(mocks.getPrestamosCashStatsAction).not.toHaveBeenCalled();
    expect(result.data?.prestamosStats).toBeNull();
  });

  it('rechaza usuarios sin la feature contabilidad', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...adminCompleto,
      role: 'user',
      planFeatures: {},
    } as never);

    const result = await getResumenCompletoAction({});
    expect(result.success).toBe(false);
  });
});
