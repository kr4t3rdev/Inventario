import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  getResumenCompletoAction: vi.fn(),
}));

const { getResumenCompletoAction } = mocks;

vi.mock('@/features/contabilidad/actions-resumen', () => ({
  getResumenCompletoAction: mocks.getResumenCompletoAction,
}));
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { planFeatures: { 'prestamos-cash': true, 'anticipos': true } } })
}));

function payloadBase() {
  return {
    success: true,
    data: {
      resumen: {
        estadisticas: { periodo: { fechaInicio: '2026-01-01', fechaFin: '2026-01-31' } },
        resumenPorMoneda: [
          { moneda: 'CUP', totalIngresos: 1000, totalEgresos: 400 },
          { moneda: 'USD', totalIngresos: 100, totalEgresos: 50 },
        ],
      },
      monedas: [{ codigo: 'CUP', esPrincipal: true }, { codigo: 'USD', esPrincipal: false }],
      prestamosStats: { montoPendienteCobro: { CUP: 500 } },
      resumenAnticipos: { resumen: { porMoneda: { CUP: { total: 200 } } } },
      conteos: { ventas: { pending: 0 }, servicios: { pending: 0 }, gastos: { pending: 0 } },
    },
  };
}
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
      span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
      section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    LazyMotion: ({ children }: any) => <>{children}</>,
    useSpring: () => ({
      set: vi.fn(),
      jump: vi.fn(),
      value: 0
    }),
    useTransform: (spring: any, cb: (v: any) => any) => cb(spring.value),
  };
});

vi.mock('@/components/ui/animations', () => ({
  AnimatedCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { ResumenFinanciero } from './resumen-financiero';

describe('ResumenFinanciero — Rediseño Fase 4', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const { __clearResumenCacheForTests } = await import('./resumen-financiero');
    __clearResumenCacheForTests();
    getResumenCompletoAction.mockResolvedValue(payloadBase());
  });

  it('presenta el flujo neto como la métrica protagonista', async () => {
    render(<ResumenFinanciero periodo="enero" page={1} limit={10} />);

    await waitFor(() => {
      // Target the protagonist label, not the duplicate column heading in the
      // currency table.
      expect(screen.getByText('Flujo Neto del Período', { selector: 'span' })).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('muestra saldos actuales por moneda sin sumarlos ciegamente', async () => {
    render(<ResumenFinanciero periodo="enero" page={1} limit={10} />);

    await waitFor(() => {
      expect(screen.getAllByText(/CUP/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/USD/i).length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('presenta el panel de atención con enlaces accionables', async () => {
    render(<ResumenFinanciero periodo="enero" page={1} limit={10} />);

    await waitFor(() => {
      const pendingVentas = screen.getByText(/Ventas pendientes/i);
      expect(pendingVentas.closest('a') || pendingVentas.closest('button')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('mantiene los detalles secundarios (Préstamos, Anticipos) plegados por defecto', async () => {
    render(<ResumenFinanciero periodo="enero" page={1} limit={10} />);

    await waitFor(() => {
      const loanDetails = screen.queryByText(/Detalle de Préstamos/i);
      if (loanDetails) {
        const accordion = loanDetails.closest('[role="button"]') || loanDetails.closest('button');
        expect(accordion).toHaveAttribute('aria-expanded', 'false');
      }
    }, { timeout: 3000 });
  });

  it('utiliza una toolbar compacta en lugar de una tarjeta de filtros gigante', async () => {
    render(<ResumenFinanciero periodo="enero" page={1} limit={10} />);

    await waitFor(() => {
      expect(screen.queryByText('Filtros globales')).not.toBeInTheDocument();
      expect(screen.getByText(/enero/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('usa la primera moneda disponible si el catálogo no marca una principal', async () => {
    const p = payloadBase();
    p.data.monedas = [{ codigo: 'USD', esPrincipal: false }];
    p.data.resumen = {
      estadisticas: { periodo: { fechaInicio: '2026-01-01', fechaFin: '2026-01-31' } },
      resumenPorMoneda: [{ moneda: 'USD', totalIngresos: 100, totalEgresos: 20, saldoActual: 80 } as any],
    };
    getResumenCompletoAction.mockResolvedValue(p);
    render(<ResumenFinanciero periodo="enero" page={1} limit={10} />);
    await waitFor(() => {
      const netFlowLabel = screen.getByText('Flujo Neto del Período', { selector: 'span' });
      expect(netFlowLabel.parentElement?.parentElement).toHaveTextContent('USD');
    });
  });

  it('muestra totales de pendientes y no solo los elementos de la página', async () => {
    const p = payloadBase();
    p.data.conteos = { ventas: { pending: 12 }, servicios: { pending: 14 }, gastos: { pending: 16 } };
    getResumenCompletoAction.mockResolvedValue(p);

    render(<ResumenFinanciero periodo="enero" page={1} limit={10} />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('14')).toBeInTheDocument();
      expect(screen.getByText('16')).toBeInTheDocument();
    });
  });

  it('muestra datos reales de préstamos y anticipos en el desglose', async () => {
    render(<ResumenFinanciero periodo="enero" page={1} limit={10} />);

    await waitFor(() => expect(getResumenCompletoAction).toHaveBeenCalled());
    const loans = await screen.findByRole('button', { name: /préstamos cash/i });
    await userEvent.click(loans);

    expect(await screen.findByText('500,00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /anticipos/i }));
    expect(await screen.findByText('200,00')).toBeInTheDocument();
    expect(screen.queryByText(/Detalle de préstamos otorgados/i)).not.toBeInTheDocument();
  });

  it('vuelve a solicitar el resumen cuando cambia la señal de actualización', async () => {
    const { rerender } = render(
      <ResumenFinanciero periodo="enero" page={1} limit={10} refreshToken={0} />,
    );

    await waitFor(() => expect(getResumenCompletoAction).toHaveBeenCalledTimes(1));
    rerender(<ResumenFinanciero periodo="enero" page={1} limit={10} refreshToken={1} />);

    await waitFor(() => expect(getResumenCompletoAction).toHaveBeenCalledTimes(2));
  });
});
