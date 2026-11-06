import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/contabilidad/actions-reconciliacion', () => ({ getReconciliacionStatsAction: vi.fn() }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/plan-access', () => ({ shouldHideBasicAccountingItem: () => false }));
vi.mock('@/features/contabilidad/components/accounting-page-shell', () => ({
  AccountingPageShell: ({ title, actions, children }: { title: string; actions: React.ReactNode; children: React.ReactNode }) => <section><h1>{title}</h1>{actions}{children}</section>,
}));
import { ReconciliacionHubClient } from './reconciliacion-hub-client';

describe('ReconciliacionHubClient', () => {
  it('renders the accounting shell and preserves reconciliation navigation', () => {
    render(<ReconciliacionHubClient initialStats={{}} />);
    expect(screen.getByRole('heading', { name: 'Reconciliación' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gestionar Ventas' })).toHaveAttribute('href', '/busy/contabilidad/reconciliacion/ventas');
    expect(screen.getByRole('link', { name: 'Gestionar Servicios' })).toHaveAttribute('href', '/busy/contabilidad/reconciliacion/servicios');
    expect(screen.getByRole('link', { name: 'Gestionar Gastos' })).toHaveAttribute('href', '/busy/contabilidad/reconciliacion/gastos');
  });
});
