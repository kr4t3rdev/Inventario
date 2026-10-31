import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  buildResumenCompleto: vi.fn(),
}));

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/features/contabilidad/actions-resumen', () => ({
  buildResumenCompleto: mocks.buildResumenCompleto,
}));

vi.mock('@/lib/plan-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/plan-access')>()),
  canAccessAccountingItem: () => true,
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { planFeatures: {} } }),
}));

vi.mock('@/features/contabilidad/components/resumen-financiero', () => ({
  ResumenFinanciero: (props: Record<string, unknown>) => (
    <div data-testid="resumen-financiero" data-props={JSON.stringify({ periodo: props.periodo, showPeriodSelector: props.showPeriodSelector, hasInitialData: props.initialData != null })} />
  ),
}));

vi.mock('@/features/contabilidad/components/deudas-cash-stats-widget', () => ({
  DeudasCashStatsWidget: () => <div data-testid="deudas-cash-widget" />,
}));

vi.mock('@/features/contabilidad/components/accounting-health-card', () => ({
  AccountingHealthCard: () => null,
}));

vi.mock('@/app/busy/contabilidad/resumen-financiero-server', () => ({
  ResumenFinancieroServer: () => <div data-testid="resumen-financiero" />,
}));

vi.mock('@/components/ui/animations', () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AnimatedCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import ContabilidadDashboard from './page';


const usuario = {
  userId: 'u1',
  role: 'user',
  tenantId: 'tenant-a',
  planFeatures: { contabilidad: true, 'prestamos-cash': true, 'deudas-cash': true },
};

describe('ContabilidadDashboard (server shell)', () => {
  it('es una función async (Server Component, sin use client)', () => {
    expect(ContabilidadDashboard.constructor.name).toBe('AsyncFunction');
  });

  it('renderiza header, enlace al hub y accesos con el usuario del servidor', async () => {
    mocks.getCurrentUser.mockResolvedValue(usuario);
    render(await ContabilidadDashboard());

    expect(screen.getByRole('heading', { name: 'Contabilidad' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver centro de conciliación/i })).toHaveAttribute('href', '/busy/contabilidad/reconciliacion');
    expect(screen.getByRole('heading', { name: 'Gestión General' })).toBeInTheDocument();
  });

  it('mantiene el acceso a préstamos existentes en Básico sin habilitar la función', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      ...usuario,
      planName: 'Básico',
      planFeatures: { contabilidad: true, 'prestamos-cash': false },
    });
    render(await ContabilidadDashboard());

    expect(screen.getByRole('link', { name: /préstamos en efectivo/i })).toHaveAttribute(
      'href',
      '/busy/contabilidad/prestamos-cash',
    );
  });

  it('mantiene el acceso a deudas existentes en Básico sin habilitar la función', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      ...usuario,
      planName: 'Básico',
      planFeatures: { contabilidad: true, 'deudas-cash': false },
    });
    render(await ContabilidadDashboard());

    expect(screen.getByRole('link', { name: /deudas en efectivo/i })).toHaveAttribute(
      'href',
      '/busy/contabilidad/deudas-cash',
    );
  });
});
