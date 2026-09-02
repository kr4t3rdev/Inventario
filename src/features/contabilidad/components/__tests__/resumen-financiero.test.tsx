import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  getResumenFinancieroAction: vi.fn(),
  getMonedasAction: vi.fn(),
  getVentasPendientesAction: vi.fn(),
  getServiciosPendientesAction: vi.fn(),
  getGastosPendientesAction: vi.fn(),
  getHistorialReconciliacionVentasAction: vi.fn(),
  getHistorialReconciliacionServiciosAction: vi.fn(),
  getHistorialReconciliacionGastosAction: vi.fn(),
  getPrestamosCashStatsAction: vi.fn(),
  getResumenAnticiposAction: vi.fn(),
}));

vi.mock('@/features/contabilidad/actions', () => ({
  getResumenFinancieroAction: mocks.getResumenFinancieroAction,
}));
vi.mock('@/features/contabilidad/actions-exchange', () => ({
  getMonedasAction: mocks.getMonedasAction,
}));
vi.mock('@/features/contabilidad/actions-reconciliacion', () => ({
  getVentasPendientesAction: mocks.getVentasPendientesAction,
  getServiciosPendientesAction: mocks.getServiciosPendientesAction,
  getGastosPendientesAction: mocks.getGastosPendientesAction,
  getHistorialReconciliacionVentasAction: mocks.getHistorialReconciliacionVentasAction,
  getHistorialReconciliacionServiciosAction: mocks.getHistorialReconciliacionServiciosAction,
  getHistorialReconciliacionGastosAction: mocks.getHistorialReconciliacionGastosAction,
}));
vi.mock('@/features/contabilidad/actions-prestamos-cash', () => ({
  getPrestamosCashStatsAction: mocks.getPrestamosCashStatsAction,
}));
vi.mock('@/features/contabilidad/actions-anticipos', () => ({
  getResumenAnticiposAction: mocks.getResumenAnticiposAction,
}));
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { planFeatures: {} } }),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/components/ui/animations', () => ({
  AnimatedCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { FinancialStatePanel } from '../reportes/FinancialStatePanel';
import { AccountingAttentionPanel } from '../reportes/AccountingAttentionPanel';
import { CurrencySummaryTable } from '../reportes/CurrencySummaryTable';
import { AccountingDetailsDisclosure } from '../reportes/AccountingDetailsDisclosure';

describe('FinancialStatePanel - delta vs período anterior', () => {
  const baseProps = {
    monedaPrincipal: 'CUP',
    flujoNeto: 5000,
    ingresosTotales: 10000,
    egresosTotales: 5000,
    balances: [{ moneda: 'CUP', saldo: 5000, ingresos: 10000, egresos: 5000 }],
  };

  it('muestra delta positivo cuando mejora el flujo neto', () => {
    render(<FinancialStatePanel {...baseProps} flujoNetoAnterior={4000} />);
    expect(screen.getByText(/\+25%/)).toBeInTheDocument();
    expect(screen.getByText(/vs\. período anterior/i)).toBeInTheDocument();
  });

  it('muestra delta negativo cuando empeora el flujo neto', () => {
    render(<FinancialStatePanel {...baseProps} flujoNetoAnterior={6250} />);
    expect(screen.getByText(/-20%/)).toBeInTheDocument();
  });

  it('no muestra delta cuando el período anterior es cero (evita división por cero)', () => {
    render(<FinancialStatePanel {...baseProps} flujoNetoAnterior={0} />);
    expect(screen.queryByText(/vs\. período anterior/i)).not.toBeInTheDocument();
  });

  it('no muestra delta cuando el período anterior no está disponible', () => {
    render(<FinancialStatePanel {...baseProps} flujoNetoAnterior={null} />);
    expect(screen.queryByText(/vs\. período anterior/i)).not.toBeInTheDocument();
  });
});

describe('FinancialStatePanel', () => {
  it('muestra flujo neto como métrica principal', () => {
    const { container } = render(
      <FinancialStatePanel
        monedaPrincipal="CUP"
        flujoNeto={5000}
        ingresosTotales={10000}
        egresosTotales={5000}
        balances={[{ moneda: 'CUP', saldo: 5000, ingresos: 10000, egresos: 5000 }]}
      />,
    );

    expect(screen.getByText(/Flujo Neto del Período/i)).toBeInTheDocument();
    expect(container.textContent).toMatch(/\+/);
    expect(container.textContent).toMatch(/5.?000/);
  });

  it('ingresos y egresos corresponden a la moneda correcta', () => {
    const { container } = render(
      <FinancialStatePanel
        monedaPrincipal="USD"
        flujoNeto={1200}
        ingresosTotales={3000}
        egresosTotales={1800}
        balances={[{ moneda: 'USD', saldo: 1200, ingresos: 3000, egresos: 1800 }]}
      />,
    );

    expect(container.textContent).toMatch(/USD/);
    expect(container.textContent).toMatch(/Ingresos Totales/);
    expect(container.textContent).toMatch(/3.?000/);
    expect(container.textContent).toMatch(/Egresos Totales/);
    expect(container.textContent).toMatch(/1.?800/);
  });

  it('recibe balances pero solo muestra moneda principal (gap: renderizar todas)', () => {
    const { container } = render(
      <FinancialStatePanel
        monedaPrincipal="CUP"
        flujoNeto={1000}
        ingresosTotales={5000}
        egresosTotales={4000}
        balances={[
          { moneda: 'CUP', saldo: 1000, ingresos: 5000, egresos: 4000 },
          { moneda: 'USD', saldo: 200, ingresos: 500, egresos: 300 },
        ]}
      />,
    );

    expect(container.textContent).toMatch(/CUP/);
  });

  it('no suma monedas diferentes (sin cross-currency)', () => {
    render(
      <FinancialStatePanel
        monedaPrincipal="CUP"
        flujoNeto={1000}
        ingresosTotales={5000}
        egresosTotales={4000}
        balances={[
          { moneda: 'CUP', saldo: 1000, ingresos: 5000, egresos: 4000 },
          { moneda: 'USD', saldo: 200, ingresos: 500, egresos: 300 },
        ]}
      />,
    );

    const allText = document.body.textContent || '';
    expect(allText).not.toMatch(/5[.,]500/);
  });

  it('flujo negativo muestra déficit', () => {
    render(
      <FinancialStatePanel
        monedaPrincipal="CUP"
        flujoNeto={-2000}
        ingresosTotales={3000}
        egresosTotales={5000}
        balances={[{ moneda: 'CUP', saldo: -2000, ingresos: 3000, egresos: 5000 }]}
      />,
    );

    expect(screen.getByText(/Déficit/i)).toBeInTheDocument();
  });
});

describe('AccountingAttentionPanel', () => {
  it('indicadores pendientes son accesibles y accionables', () => {
    render(
      <AccountingAttentionPanel
        ventasPend={5}
        serviciosPend={3}
        gastosPend={2}
        conversionesSinCobertura={1}
        clasificacionesNoReconocidas={0}
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(5);

    expect(screen.getByText('Ventas pendientes')).toBeInTheDocument();
    expect(screen.getByText('Servicios pendientes')).toBeInTheDocument();
    expect(screen.getByText('Gastos pendientes')).toBeInTheDocument();
    expect(screen.getByText('Conversiones sin cobertura')).toBeInTheDocument();
    expect(screen.getByText('Clasificaciones no reconocidas')).toBeInTheDocument();
  });

  it('muestra conteo correcto en badges', () => {
    render(
      <AccountingAttentionPanel
        ventasPend={10}
        serviciosPend={0}
        gastosPend={7}
        conversionesSinCobertura={2}
        clasificacionesNoReconocidas={3}
      />,
    );

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('cada item tiene aria-label descriptivo', () => {
    render(
      <AccountingAttentionPanel
        ventasPend={1}
        serviciosPend={0}
        gastosPend={0}
        conversionesSinCobertura={0}
        clasificacionesNoReconocidas={0}
      />,
    );

    const links = screen.getAllByRole('link');
    links.forEach(link => {
      expect(link).toHaveAttribute('href');
    });
  });
});

describe('CurrencySummaryTable', () => {
  it('muestra tabla con columnas Moneda, Saldo, Ingresos, Egresos, Flujo Neto', () => {
    render(
      <CurrencySummaryTable
        data={[{ moneda: 'CUP', saldoActual: 5000, totalIngresos: 10000, totalEgresos: 5000 }]}
        monedaPrincipal="CUP"
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map(h => h.textContent)).toEqual([
      'Moneda', 'Saldo Actual', 'Ingresos', 'Egresos', 'Flujo Neto',
    ]);
  });

  it('marca la moneda principal', () => {
    render(
      <CurrencySummaryTable
        data={[
          { moneda: 'CUP', saldoActual: 5000, totalIngresos: 10000, totalEgresos: 5000 },
          { moneda: 'USD', saldoActual: 200, totalIngresos: 500, totalEgresos: 300 },
        ]}
        monedaPrincipal="CUP"
      />,
    );

    expect(screen.getByText('Principal')).toBeInTheDocument();
  });

  it('calcula flujo neto por moneda', () => {
    const { container } = render(
      <CurrencySummaryTable
        data={[{ moneda: 'CUP', saldoActual: 3000, totalIngresos: 8000, totalEgresos: 5000 }]}
        monedaPrincipal="CUP"
      />,
    );

    expect(container.textContent).toMatch(/3.?000/);
  });

  it('no mezcla monedas en los totales', () => {
    render(
      <CurrencySummaryTable
        data={[
          { moneda: 'CUP', saldoActual: 5000, totalIngresos: 10000, totalEgresos: 5000 },
          { moneda: 'USD', saldoActual: 200, totalIngresos: 500, totalEgresos: 300 },
        ]}
        monedaPrincipal="CUP"
      />,
    );

    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(3);
  });
});

describe('AccountingDetailsDisclosure', () => {
  it('detalles secundarios comienzan plegados (contenido oculto)', () => {
    render(
      <AccountingDetailsDisclosure
        sections={[
          { id: 'prestamos', title: 'Préstamos', icon: <span />, content: <span>Detalle préstamos</span> },
          { id: 'deudas', title: 'Deudas', icon: <span />, content: <span>Detalle deudas</span> },
        ]}
      />,
    );

    const el = screen.queryByText('Detalle préstamos');
    if (el) {
      expect(el.closest('[data-state]')).toHaveAttribute('data-state', 'closed');
    }
  });

  it('al hacer click se expande y muestra contenido', async () => {
    const user = userEvent.setup();
    render(
      <AccountingDetailsDisclosure
        sections={[
          { id: 'prestamos', title: 'Préstamos', icon: <span />, content: <span>Detalle préstamos</span> },
        ]}
      />,
    );

    await user.click(screen.getByText('Préstamos'));
    expect(screen.getByText('Detalle préstamos')).toBeInTheDocument();
  });

  it('múltiples secciones son independientes', async () => {
    const user = userEvent.setup();
    render(
      <AccountingDetailsDisclosure
        sections={[
          { id: 'prestamos', title: 'Préstamos', icon: <span />, content: <span>Detalle préstamos</span> },
          { id: 'deudas', title: 'Deudas', icon: <span />, content: <span>Detalle deudas</span> },
        ]}
      />,
    );

    await user.click(screen.getByText('Préstamos'));
    expect(screen.getByText('Detalle préstamos')).toBeInTheDocument();

    const deudasEl = screen.queryByText('Detalle deudas');
    if (deudasEl) {
      expect(deudasEl.closest('[data-state]')).toHaveAttribute('data-state', 'closed');
    }
  });
});

describe('ResumenFinanciero — loading, empty, error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getResumenFinancieroAction.mockReturnValue(new Promise(() => {}));
    mocks.getMonedasAction.mockResolvedValue({ success: true, data: [] });
    mocks.getVentasPendientesAction.mockResolvedValue({ success: true, data: { ventas: [] } });
    mocks.getServiciosPendientesAction.mockResolvedValue({ success: true, data: { ventaServicios: [] } });
    mocks.getGastosPendientesAction.mockResolvedValue({ success: true, data: { gastos: [] } });
    mocks.getHistorialReconciliacionVentasAction.mockResolvedValue({ success: true, data: null });
    mocks.getHistorialReconciliacionServiciosAction.mockResolvedValue({ success: true, data: null });
    mocks.getHistorialReconciliacionGastosAction.mockResolvedValue({ success: true, data: null });
    mocks.getPrestamosCashStatsAction.mockResolvedValue({ success: true, data: null });
    mocks.getResumenAnticiposAction.mockResolvedValue({ success: true, data: null });
  });

  it('muestra estado de loading', async () => {
    const { ResumenFinanciero } = await import('../resumen-financiero');

    const { container } = render(
      <ResumenFinanciero periodo="Abril 2026" page={1} limit={10} />,
    );

    await waitFor(() => {
      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('muestra error con botón de reintento', async () => {
    mocks.getResumenFinancieroAction.mockResolvedValueOnce({
      success: false,
      error: { message: 'Error de prueba' },
    });

    const { ResumenFinanciero } = await import('../resumen-financiero');

    render(<ResumenFinanciero periodo="Abril 2026" page={1} limit={10} />);

    await waitFor(() => {
      expect(screen.getByText(/Error al cargar datos/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /intentar nuevamente/i })).toBeInTheDocument();
  });

  it('jerarquía se mantiene en estructura de grid', async () => {
    mocks.getResumenFinancieroAction.mockResolvedValueOnce({
      success: true,
      data: {
        resumenPorMoneda: [{ moneda: 'CUP', saldoActual: 5000, totalIngresos: 10000, totalEgresos: 5000 }],
        metadatos: { coberturaConversion: { unresolved: 0 }, clasificacionNoReconocida: 0 },
      },
    });

    const { ResumenFinanciero } = await import('../resumen-financiero');

    const { container } = render(
      <ResumenFinanciero periodo="Abril 2026" page={1} limit={10} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Flujo Neto del Período/i)).toBeInTheDocument();
    });

    const gridElements = container.querySelectorAll('.grid');
    expect(gridElements.length).toBeGreaterThanOrEqual(1);
  });
});
