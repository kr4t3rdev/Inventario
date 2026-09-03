import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getReconciliacionStatsAction: vi.fn().mockResolvedValue({
    success: true,
    data: { modules: { ventas: { pending: 0 }, servicios: { pending: 0 }, gastos: { pending: 0 } } },
  }),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: {
      role: 'user',
      planFeatures: {
        contabilidad: true,
        'prestamos-cash': true,
        'deudas-cash': true,
      },
    },
  }),
}));

vi.mock('@/lib/plan-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/plan-access')>()),
  canAccessAccountingItem: () => true,
}));

vi.mock('@/features/contabilidad/actions-reconciliacion', () => ({
  getReconciliacionStatsAction: mocks.getReconciliacionStatsAction,
}));

vi.mock('@/features/contabilidad/components/resumen-financiero', () => ({
  ResumenFinanciero: () => <div data-testid="resumen-financiero" />,
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

import ContabilidadDashboard from './page';

describe('ContabilidadDashboard', () => {
  it('expone un componente de página', async () => {
    const source = await import('./page');
    expect(source.default).toBeTypeOf('function');
  });

  it('no renderiza la sección duplicada "Centro de Actividad"', async () => {
    render(<ContabilidadDashboard />);
    expect(
      await screen.findByTestId('resumen-financiero'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Centro de Actividad')).not.toBeInTheDocument();
  });

  it('ofrece un único enlace al hub de conciliación', async () => {
    render(<ContabilidadDashboard />);
    const link = await screen.findByRole('link', {
      name: /ver centro de conciliación/i,
    });
    expect(link).toHaveAttribute('href', '/busy/contabilidad/reconciliacion');
  });

  it('no llama getReconciliacionStatsAction (los conteos viven en el resumen)', async () => {
    render(<ContabilidadDashboard />);
    await screen.findByTestId('resumen-financiero');
    expect(mocks.getReconciliacionStatsAction).not.toHaveBeenCalled();
  });

  it('ordena los accesos rápidos por frecuencia de uso esperada', async () => {
    render(<ContabilidadDashboard />);
    await screen.findByTestId('resumen-financiero');

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
});

describe('ContabilidadDashboard - hover quieto', () => {
  it('los accesos rápidos no amplifican el icono en hover (no scale-110)', async () => {
    const { container } = render(<ContabilidadDashboard />);
    await screen.findByTestId('resumen-financiero');

    expect(container.querySelector('[class*="group-hover:scale-110"]')).toBeNull();
  });
});

describe('ContabilidadDashboard - sin kickers ni opacidades fantasma', () => {
  it('no muestra el eyebrow "Accesos Directos"; el H2 se sostiene solo', async () => {
    render(<ContabilidadDashboard />);
    await screen.findByTestId('resumen-financiero');

    expect(screen.queryByText('Accesos Directos')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Gestión General' }),
    ).toBeInTheDocument();
  });

  it('el skeleton del resumen no usa opacidades casi invisibles (/5)', async () => {
    const { ResumenSkeleton } = await import('./page');
    const { container } = render(<ResumenSkeleton />);

    const allClasses = Array.from(container.querySelectorAll('[class]')).flatMap((el) =>
      Array.from(el.classList),
    );
    expect(allClasses).not.toContain('dark:bg-slate-800/5');
  });
});
