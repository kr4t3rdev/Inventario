/**
 * Tests para el componente ScenarioSimulator
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ScenarioSimulator from '../scenario-simulator';
import { KPIData } from '@/lib/types/exchange-intelligence';

// Datos de prueba con estructura correcta de KPIData
const mockKPIData: KPIData = {
  tasa_equilibrio: {
    productos: [
      {
        producto_id: '1',
        nombre: 'Producto A',
        tasa_equilibrio: 25.0,
        tasa_actual: 20.0,
        proximidad_porcentaje: 80,
        estado: 'advertencia',
      },
    ],
  },
  margen_real_vs_nominal: {
    margen_nominal: 1000,
    margen_real: 800,
    diferencia_porcentual: -20,
    tendencia_historica: [],
  },
  diferencial_cambiario_acumulado: {
    ytd: 50000,
    desglose_mensual: [],
    comparacion_anio_anterior: 45000,
  },
  envejecimiento_deuda: [
    {
      deuda_id: '1',
      entidad: 'Proveedor A',
      moneda: 'USD',
      monto: 10000,
      antiguedad_dias: 30,
      tendencia_moneda: 'alcista',
      prioridad: 0.8,
      impacto_30_dias: 500,
    },
  ],
};

const mockSimulationResult = {
  costo_reposicion_proyectado: 150000,
  perdida_no_realizada_proyectada: 25000,
  margen_real_proyectado: 750,
  utilidad_neta_proyectada: 120000,
  alertas_generadas: [
    {
      tipo: 'cost_increase',
      mensaje: 'Incremento significativo en costos de reposición',
      severidad: 'warning' as const,
    },
  ],
};

// Mock de useSimulateScenarioMutation
const mockSimulateScenario = vi.fn();
const mockUseSimulateScenarioMutation = vi.fn();

vi.mock('@/lib/redux/services/exchangeIntelligenceApi', () => ({
  useSimulateScenarioMutation: (...args: any[]) => mockUseSimulateScenarioMutation(...args),
}));

// Mock de Recharts
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

describe('ScenarioSimulator', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseSimulateScenarioMutation.mockReturnValue([
      mockSimulateScenario,
      {
        data: null,
        isLoading: false,
        error: null,
      },
    ]);

    store = configureStore({
      reducer: {
        exchangeIntelligence: (state = {}) => state,
      },
    });
  });

  it('debe renderizar correctamente con datos iniciales', () => {
    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    expect(screen.getByText('Simulador de Escenarios')).toBeInTheDocument();
    expect(screen.getByText('Ajusta las tasas de cambio y observa el impacto en tiempo real')).toBeInTheDocument();
    expect(screen.getByText('Tasa USD')).toBeInTheDocument();
    expect(screen.getByText('Escenarios Predefinidos')).toBeInTheDocument();
  });

  it('debe renderizar sin datos', () => {
    const emptyKPIData: KPIData = {
      tasa_equilibrio: { productos: [] },
      margen_real_vs_nominal: {
        margen_nominal: 0,
        margen_real: 0,
        diferencia_porcentual: 0,
        tendencia_historica: [],
      },
      diferencial_cambiario_acumulado: {
        ytd: 0,
        desglose_mensual: [],
        comparacion_anio_anterior: 0,
      },
      envejecimiento_deuda: [],
    };

    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={emptyKPIData} />
      </Provider>
    );

    expect(screen.getByText('Simulador de Escenarios')).toBeInTheDocument();
    expect(screen.getByText('Tasa USD')).toBeInTheDocument();
  });

  it('debe mostrar mensaje cuando no hay simulación', () => {
    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    expect(screen.getByText('Ajusta las tasas para ver la simulación')).toBeInTheDocument();
  });

  it('debe aplicar preset optimista correctamente', () => {
    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    const optimistaButton = screen.getByText('Optimista (-10%)');
    fireEvent.click(optimistaButton);

    // Verificar que se llama a la simulación
    expect(mockSimulateScenario).toHaveBeenCalled();
  });

  it('debe aplicar preset pesimista correctamente', () => {
    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    const pesimistaButton = screen.getByText('Pesimista (+10%)');
    fireEvent.click(pesimistaButton);

    expect(mockSimulateScenario).toHaveBeenCalled();
  });

  it('debe resetear simulación correctamente', () => {
    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);

    expect(mockSimulateScenario).toHaveBeenCalled();
  });

  it('debe mostrar resultados de simulación cuando hay datos', () => {
    mockUseSimulateScenarioMutation.mockReturnValue([
      mockSimulateScenario,
      {
        data: mockSimulationResult,
        isLoading: false,
        error: null,
      },
    ]);

    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    expect(screen.getByText('Impacto Proyectado')).toBeInTheDocument();
    expect(screen.getByText('$150,000')).toBeInTheDocument();
    expect(screen.getByText('$25,000')).toBeInTheDocument();
    expect(screen.getByText('$750')).toBeInTheDocument();
    expect(screen.getByText('$120,000')).toBeInTheDocument();
  });

  it('debe mostrar alertas generadas', () => {
    mockUseSimulateScenarioMutation.mockReturnValue([
      mockSimulateScenario,
      {
        data: mockSimulationResult,
        isLoading: false,
        error: null,
      },
    ]);

    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    expect(screen.getByText('Alertas Generadas')).toBeInTheDocument();
    expect(screen.getByText('Incremento significativo en costos de reposición')).toBeInTheDocument();
    expect(screen.getByText('Advertencia')).toBeInTheDocument();
  });

  it('debe mostrar loading state', () => {
    mockUseSimulateScenarioMutation.mockReturnValue([
      mockSimulateScenario,
      {
        data: null,
        isLoading: true,
        error: null,
      },
    ]);

    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('debe mostrar error state', () => {
    mockUseSimulateScenarioMutation.mockReturnValue([
      mockSimulateScenario,
      {
        data: null,
        isLoading: false,
        error: { message: 'Error de simulación' },
      },
    ]);

    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    expect(screen.getByText('Error en la simulación')).toBeInTheDocument();
  });

  it('debe guardar escenario correctamente', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    const input = screen.getByPlaceholderText('Nombre del escenario');
    const saveButton = screen.getByText('Guardar');

    // Intentar guardar sin nombre
    fireEvent.click(saveButton);
    expect(alertMock).toHaveBeenCalledWith('Por favor ingrese un nombre para el escenario');

    // Guardar con nombre
    fireEvent.change(input, { target: { value: 'Escenario de Prueba' } });
    fireEvent.click(saveButton);
    expect(alertMock).toHaveBeenCalledWith('Escenario "Escenario de Prueba" guardado exitosamente');

    alertMock.mockRestore();
  });

  it('debe renderizar gráfico de utilidad neta', () => {
    mockUseSimulateScenarioMutation.mockReturnValue([
      mockSimulateScenario,
      {
        data: mockSimulationResult,
        isLoading: false,
        error: null,
      },
    ]);

    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });
});
