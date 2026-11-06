import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  pending: vi.fn().mockResolvedValue({ success: true, data: { ventaServicios: [], pagination: { page: 1, total: 0, totalPages: 0 } } }),
  history: vi.fn().mockResolvedValue({ success: true, data: { reconciliaciones: [] } }),
}));
vi.mock('@/features/contabilidad/actions-reconciliacion', () => ({
  getServiciosPendientesAction: actions.pending,
  getHistorialReconciliacionServiciosAction: actions.history,
}));
vi.mock('next/dynamic', () => ({ default: () => () => <div>Contenido de servicios</div> }));
vi.mock('@/features/contabilidad/components/accounting-page-shell', () => ({
  AccountingPageShell: ({ title, actions, children }: { title: string; actions: React.ReactNode; children: React.ReactNode }) => (
    <section><h1>{title}</h1>{actions}{children}</section>
  ),
}));
vi.mock('@/components/ui/animations', () => ({
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StaggerItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AnimatedCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
import { ReconciliacionServiciosPage } from './reconciliacion-servicios-page';

describe('ReconciliacionServiciosPage', () => {
  it('renders the accounting shell and loads pending services', async () => {
    render(<ReconciliacionServiciosPage />);
    expect(screen.getByRole('heading', { name: 'Reconciliación de Servicios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    await waitFor(() => expect(actions.pending).toHaveBeenCalled());
    expect(screen.getByText('Contenido de servicios')).toBeInTheDocument();
  });
});
