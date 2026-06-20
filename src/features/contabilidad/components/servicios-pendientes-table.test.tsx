import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('framer-motion', () => ({
  LazyMotion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  m: { div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div> },
  motion: { div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div> },
  useReducedMotion: () => true,
}));

vi.mock('@/features/contabilidad/actions-reconciliacion', () => ({
  getServiciosPendientesAction: vi.fn(),
}));

vi.mock('@/components/ui/animations', () => ({
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StaggerItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AnimatedCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

import { ServiciosPendientesTable } from './servicios-pendientes-table';

describe('ServiciosPendientesTable', () => {
  it('muestra un trigger visible para reconciliar cada servicio', async () => {
    const user = userEvent.setup();
    const onReconciliar = vi.fn();

    render(
      <ServiciosPendientesTable
        onReconciliar={onReconciliar}
        servicios={[
          {
            ventaServicioId: 'vs-001',
            createdAt: '2026-06-19T12:00:00.000Z',
            total: 120,
            cliente: { nombre: 'Cliente demo' },
            servicio: { descripcion: 'Servicio demo', moneda: 'CUP' },
            reconciliada: false,
          } as never,
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /reconciliar/i }));

    expect(onReconciliar).toHaveBeenCalledWith(
      expect.objectContaining({ ventaServicioId: 'vs-001' }),
    );
  });
});
