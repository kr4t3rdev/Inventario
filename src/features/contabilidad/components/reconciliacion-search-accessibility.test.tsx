import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/features/contabilidad/actions-reconciliacion', () => ({
  getGastosPendientesAction: vi.fn().mockResolvedValue({ success: true, data: { gastos: [] } }),
  getVentasPendientesAction: vi.fn().mockResolvedValue({ success: true, data: { ventas: [], pagination: { page: 1, totalPages: 0, total: 0 } } }),
  getServiciosPendientesAction: vi.fn().mockResolvedValue({ success: true, data: { ventaServicios: [] } }),
}));
vi.mock('@/features/contabilidad', () => ({
  getCuentasPorCobrarAction: vi.fn().mockResolvedValue({ success: true, data: { cuentas: [] } }),
}));
vi.mock('@/components/ui/animations', () => ({
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StaggerItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AnimatedCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
import { GastosPendientesTable } from './gastos-pendientes-table';
import { VentasPendientesTable } from './ventas-pendientes-table';
import { ServiciosPendientesTable } from './servicios-pendientes-table';

describe('reconciliation search accessibility', () => {
  it('labels expense search and displays zero pages when empty', async () => {
    render(<GastosPendientesTable gastos={[]} currentPage={1} totalPages={0} />);
    expect(await screen.findByRole('textbox', { name: 'Buscar gastos' })).toBeInTheDocument();
    expect(screen.getByText(/Página 0 de 0/)).toBeInTheDocument();
  });
  it('labels sales search', async () => {
    render(<VentasPendientesTable />);
    expect(await screen.findByRole('textbox', { name: 'Buscar ventas' })).toBeInTheDocument();
  });
  it('labels services search', async () => {
    render(<ServiciosPendientesTable servicios={[]} />);
    expect(await screen.findByRole('textbox', { name: 'Buscar servicios' })).toBeInTheDocument();
  });
});
