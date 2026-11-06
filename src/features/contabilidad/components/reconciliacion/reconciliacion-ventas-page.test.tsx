import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  pending: vi.fn().mockResolvedValue({ success: true, data: { ventas: [], saldoPendienteTotal: 0, pagination: { page: 1, total: 0, totalPages: 0 } } }),
  history: vi.fn().mockResolvedValue({ success: true, data: { reconciliaciones: [], estadisticas: { porMoneda: [], porTipoDePago: [], montoConvertidoTotal: 0, montoTotal: 0 }, pagination: {} } }),
}));
vi.mock('@/features/contabilidad/actions-reconciliacion', () => ({ getVentasPendientesAction: actions.pending, getHistorialReconciliacionVentasAction: actions.history }));
vi.mock('@/features/contabilidad', () => ({ createCuentaPorCobrarAction: vi.fn(), getCuentasPorCobrarAction: vi.fn().mockResolvedValue({ success: true, data: { cuentas: [] } }) }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../ventas-pendientes-table', () => ({ VentasPendientesTable: () => <div>Tabla de ventas</div> }));
vi.mock('./reconciliacion-ventas-form', () => ({ ReconciliacionVentasForm: () => null }));
vi.mock('./resumen-reconciliacion', () => ({ ResumenReconciliacion: () => null }));
vi.mock('@/features/contabilidad/components/accounting-page-shell', () => ({
  AccountingPageShell: ({ title, actions, children }: { title: string; actions: React.ReactNode; children: React.ReactNode }) => <section><h1>{title}</h1>{actions}{children}</section>,
}));
vi.mock('@/components/ui/animations', () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StaggerItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AnimatedCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
import { ReconciliacionVentasPage } from './reconciliacion-ventas-page';

describe('ReconciliacionVentasPage', () => {
  it('renders the accounting shell and loads pending sales', async () => {
    render(<ReconciliacionVentasPage />);
    expect(screen.getByRole('heading', { name: 'Reconciliación de Ventas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    await waitFor(() => expect(actions.pending).toHaveBeenCalled());
    expect(screen.getByText('Tabla de ventas')).toBeInTheDocument();
  });
});
