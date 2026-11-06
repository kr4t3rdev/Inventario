import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/contabilidad/actions-reconciliacion', () => ({
  getGastosPendientesAction: vi.fn().mockResolvedValue({
    success: true,
    data: { gastos: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } },
  }),
}));
vi.mock('@/components/ui/date-range-picker', () => ({
  DateRangePicker: ({ onChange }: { onChange: (range: { from: Date; to: Date }) => void }) => (
    <button onClick={() => onChange({ from: new Date(2026, 9, 29), to: new Date(2026, 10, 5) })}>
      Seleccionar fechas de prueba
    </button>
  ),
}));
vi.mock('@/features/contabilidad/components/accounting-page-shell', () => ({
  AccountingPageShell: ({ title, actions, children }: { title: string; actions: React.ReactNode; children: React.ReactNode }) => (
    <section><h1>{title}</h1>{actions}{children}</section>
  ),
}));
vi.mock('../gastos-pendientes-table', () => ({ GastosPendientesTable: () => <div>Tabla de gastos</div> }));
vi.mock('./reconciliacion-gastos-form', () => ({ ReconciliacionGastosForm: () => null }));
vi.mock('@/components/ui/animations', () => ({
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StaggerItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AnimatedCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
import { ReconciliacionGastosPage } from './reconciliacion-gastos-page';

describe('ReconciliacionGastosPage', () => {
  it('renders the accounting shell and formats the selected dates in Spanish', async () => {
    render(<ReconciliacionGastosPage />);
    expect(screen.getByRole('heading', { name: 'Reconciliación de Gastos' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar fechas de prueba' }));
    expect(await screen.findByText('29 de octubre, 2026')).toBeInTheDocument();
    expect(screen.getByText('05 de noviembre, 2026')).toBeInTheDocument();
    expect(screen.getByText('Tabla de gastos')).toBeInTheDocument();
  });
});
