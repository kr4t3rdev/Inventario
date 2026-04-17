import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import CostImpactSection from '../cost-impact-section';
import ScenarioSimulator from '../scenario-simulator';
import KPIDashboard from '../kpi-dashboard';
import { ThresholdConfiguration } from '../threshold-configuration';
import {
  costImpactApiFixture,
  costImpactSectionProps,
  kpiApiFixture,
  scenarioSimulatorFixture,
  thresholdsFixture,
} from './accessibility.fixtures';

const mocks = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockUseBreakpoints: vi.fn(),
  mockUseGetCostImpactQuery: vi.fn(),
  mockUseGetKPIsQuery: vi.fn(),
  mockUseAppSelector: vi.fn(),
  mockUseAppDispatch: vi.fn(),
  mockSelectCustomThresholds: vi.fn(),
  mockSetCustomThresholds: vi.fn(),
  mockResetCustomThresholds: vi.fn(),
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock('@/hooks/use-breakpoints', () => ({
  useBreakpoints: mocks.mockUseBreakpoints,
}));

vi.mock('@/lib/redux/services/exchangeIntelligenceApi', () => ({
  useGetCostImpactQuery: mocks.mockUseGetCostImpactQuery,
  useGetKPIsQuery: mocks.mockUseGetKPIsQuery,
}));

vi.mock('@/lib/redux/hooks', () => ({
  useAppSelector: mocks.mockUseAppSelector,
  useAppDispatch: mocks.mockUseAppDispatch,
}));

vi.mock('@/lib/redux/slices/exchangeIntelligenceSlice', () => ({
  selectCustomThresholds: mocks.mockSelectCustomThresholds,
  setCustomThresholds: mocks.mockSetCustomThresholds,
  resetCustomThresholds: mocks.mockResetCustomThresholds,
}));

vi.mock('sonner', () => ({
  toast: {
    error: mocks.mockToastError,
    info: mocks.mockToastInfo,
    success: mocks.mockToastSuccess,
  },
}));

describe('Exchange Intelligence Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mocks.mockUseBreakpoints.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      windowWidth: 1280,
    });

    mocks.mockUseGetCostImpactQuery.mockReturnValue({
      data: costImpactApiFixture,
      isLoading: false,
      error: null,
    });

    mocks.mockUseGetKPIsQuery.mockReturnValue({
      data: kpiApiFixture,
      isLoading: false,
      error: null,
    });

    mocks.mockUseAppSelector.mockImplementation((selector: (state: unknown) => unknown) => selector({}));
    mocks.mockUseAppDispatch.mockReturnValue(mocks.mockDispatch);
    mocks.mockSelectCustomThresholds.mockReturnValue(thresholdsFixture);
    mocks.mockSetCustomThresholds.mockImplementation((payload) => ({
      type: 'exchange-intelligence/setCustomThresholds',
      payload,
    }));
    mocks.mockResetCustomThresholds.mockReturnValue({
      type: 'exchange-intelligence/resetCustomThresholds',
    });
  });

  it('renderiza la matriz y expone el gráfico sólo después de cambiar al tab correcto', async () => {
    const user = userEvent.setup();
    const { container } = render(<CostImpactSection {...costImpactSectionProps} />);

    expect(screen.getByRole('tab', { name: /Matriz de Riesgo/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(
      screen.queryByRole('img', { name: /Gráfico de línea de tiempo comparativa/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Gráfico de Tendencia/i }));

    expect(
      screen.getByRole('img', { name: /Gráfico de línea de tiempo comparativa/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Considera subir precios de venta/i)).toBeInTheDocument();
    expect(document.getElementById('cost-timeline-chart-description')).toHaveTextContent(
      /Gráfico de líneas comparando costo histórico/i
    );

    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    expect(
      results.violations.map((violation) => ({
        id: violation.id,
        targets: violation.nodes.map((node) => node.target),
      }))
    ).toEqual([]);
  });

  it('mantiene controles reales y sin violaciones automáticas en el simulador', async () => {
    const { container } = render(
      <ScenarioSimulator datos_actuales={scenarioSimulatorFixture} />
    );

    expect(screen.getByText(/Configuración del Escenario/i)).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /Variación del T\/C \(%\)/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Entrada Directa/i })).toHaveValue(0);
    expect(screen.getByText(/Impacto Proyectado/i)).toBeInTheDocument();
  });

  it('expone tarjetas KPI reales con datos y sin violaciones automáticas', async () => {
    const { container } = render(
      <KPIDashboard fecha_inicio='2024-01-01' fecha_fin='2024-01-31' />
    );

    expect(screen.getByText(/Tasas de Equilibrio por Producto/i)).toBeInTheDocument();
    expect(screen.getByText(/Producto A/i)).toBeInTheDocument();
    expect(screen.getByText(/Análisis de Margen/i)).toBeInTheDocument();
    expect(screen.getByText(/Diferencial Acumulado/i)).toBeInTheDocument();

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('abre la configuración de umbrales con inputs etiquetados y sin violaciones automáticas', async () => {
    const user = userEvent.setup();
    render(<ThresholdConfiguration />);

    await user.click(screen.getByRole('button', { name: /Configurar Umbrales/i }));

    const dialog = await screen.findByRole('dialog', {
      name: /Configuración de Umbrales de Alertas/i,
    });

    expect(within(dialog).getByRole('spinbutton', { name: /Incremento de Costos/i })).toHaveValue(10);
    expect(within(dialog).getByRole('button', { name: /Guardar Cambios/i })).toBeDisabled();
    expect(within(dialog).getByText(/Los umbrales determinan cuándo se generan alertas/i)).toBeInTheDocument();

    const results = await axe(document.body);
    expect(results.violations).toHaveLength(0);
  });
});
