import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/lib/plan-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/plan-access')>()),
  canAccessAccountingItem: () => true,
}));

vi.mock('@/features/contabilidad/actions-resumen', () => ({
  buildResumenCompleto: vi.fn().mockResolvedValue(null),
  getResumenCompletoAction: vi.fn(),
}));

vi.mock('@/features/contabilidad/components/resumen-financiero', () => ({
  ResumenFinanciero: () => <div data-testid="resumen-financiero" />,
}));

vi.mock('./resumen-financiero-server', () => ({
  ResumenFinancieroServer: () => <div data-testid="resumen-financiero" />,
}));

vi.mock('@/features/contabilidad/components/deudas-cash-stats-widget', () => ({
  DeudasCashStatsWidget: () => <div data-testid="deudas-cash-widget" />,
}));

vi.mock('@/features/contabilidad/components/accounting-health-card', () => ({
  AccountingHealthCard: () => null,
}));

vi.mock('@/components/ui/animations', () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AnimatedCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import ContabilidadDashboard, { ResumenSkeleton } from './page';

const usuario = {
  userId: 'u1',
  role: 'user',
  tenantId: 'tenant-a',
  planFeatures: { contabilidad: true, 'prestamos-cash': true, 'deudas-cash': true },
};

async function renderDashboard() {
  mocks.getCurrentUser.mockResolvedValue(usuario);
  render(await ContabilidadDashboard());
  await screen.findByTestId('resumen-financiero');
}

describe('ContabilidadDashboard', () => {
  it('expone un componente de página', () => {
    expect(ContabilidadDashboard).toBeTypeOf('function');
  });

  it('no renderiza la sección duplicada "Centro de Actividad"', async () => {
    await renderDashboard();
    expect(screen.queryByText('Centro de Actividad')).not.toBeInTheDocument();
  });

  it('ofrece un único enlace al hub de conciliación', async () => {
    await renderDashboard();
    const link = screen.getByRole('link', { name: /ver centro de conciliación/i });
    expect(link).toHaveAttribute('href', '/busy/contabilidad/reconciliacion');
  });

  it('ordena los accesos rápidos por frecuencia de uso esperada', async () => {
    await renderDashboard();

    const accionesEsperadas = [
      'Cuentas Bancarias',
      'Reconciliación',
      'Transferencias',
      'Préstamos en Efectivo',
      'Deudas en Efectivo',
      'Tasas de Cambio',
      'Ajustes Manuales',
      'Auditoría',
    ];
    const títulosVisibles = screen
      .getAllByRole('link')
      .map((el) => el.textContent ?? '')
      .map((texto) => accionesEsperadas.find((a) => texto.startsWith(a)))
      .filter((t): t is string => Boolean(t));

    expect(títulosVisibles).toEqual(accionesEsperadas);
  });

  it('los accesos rápidos no amplifican el icono en hover (no scale-110)', async () => {
    await renderDashboard();
    expect(document.querySelector('[class*="group-hover:scale-110"]')).toBeNull();
  });

  it('no muestra el eyebrow "Accesos Directos"; el H2 se sostiene solo', async () => {
    await renderDashboard();

    expect(screen.queryByText('Accesos Directos')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Gestión General' }),
    ).toBeInTheDocument();
  });

  it('el skeleton del resumen no usa opacidades casi invisibles (/5)', () => {
    const { container } = render(<ResumenSkeleton />);

    const allClasses = Array.from(container.querySelectorAll('[class]')).flatMap((el) =>
      Array.from(el.classList),
    );
    expect(allClasses).not.toContain('dark:bg-slate-800/5');
  });
});
