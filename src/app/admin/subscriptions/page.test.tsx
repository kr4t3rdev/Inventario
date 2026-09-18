import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSubscriptionRevenueActionMock = vi.fn();

vi.mock('@/features/admin', () => ({
  getAdminSubscriptionRevenueAction: (...args: unknown[]) => getAdminSubscriptionRevenueActionMock(...args),
}));

import SubscriptionsRevenuePage from './page';

const revenueFixture = {
  mrr: 1200,
  arr: 14400,
  revenueByPlan: [],
  activeLicenses: 3,
  inactiveLicenses: 1,
  avgRevenuePerTenant: 400,
  churnRate: 0,
  ltv: 1200,
  licenseHistory: [
    { mes: '2026-05', nuevasLicencias: 1, renovaciones: 0, ingresos: 400, mrr: 400, licenciasActivas: 1 },
    { mes: '2026-06', nuevasLicencias: 2, renovaciones: 0, ingresos: 800, mrr: 1200, licenciasActivas: 3 },
  ],
  comparison: {
    mrrChange: 800,
    mrrChangePercent: 200,
    revenueChange: 400,
    revenueChangePercent: 100,
    licensesChange: 2,
  },
  dateRange: {
    start: '2026-01-01T00:00:00.000Z',
    end: '2026-06-30T23:59:59.000Z',
    months: 6,
  },
  projectedRevenue: {
    fromExpiring: 400,
    fromNew: 1,
    expiringCount: 1,
  },
};

describe('/admin/subscriptions page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra un estado de error cuando la action falla en vez de quedarse cargando para siempre', async () => {
    getAdminSubscriptionRevenueActionMock.mockResolvedValue({
      success: false,
      error: { message: 'Error interno del servidor' },
    });

    render(<SubscriptionsRevenuePage />);

    await waitFor(() => {
      expect(screen.getByText('No se pudo cargar revenue de suscripciones')).toBeInTheDocument();
    });

    expect(screen.getByText('Error interno del servidor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('renderiza las métricas cuando la action responde correctamente', async () => {
    getAdminSubscriptionRevenueActionMock.mockResolvedValue({
      success: true,
      data: revenueFixture,
    });

    render(<SubscriptionsRevenuePage />);

    await waitFor(() => {
      expect(screen.getByText('Revenue de Suscripciones')).toBeInTheDocument();
    });

    expect(screen.getAllByText('MRR').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$1,200').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Licencias Activas').length).toBeGreaterThan(0);
  });
});
