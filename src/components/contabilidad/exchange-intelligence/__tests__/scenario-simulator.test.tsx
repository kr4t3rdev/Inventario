/**
 * Tests para el componente ScenarioSimulator
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, beforeEach } from 'vitest';
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

describe('ScenarioSimulator', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        exchangeIntelligence: (state = {}) => state,
      },
    });
  });

  it('debe renderizar configuración e impacto base', () => {
    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    expect(screen.getByText('Configuración del Escenario')).toBeTruthy();
    expect(screen.getByText('Impacto Proyectado')).toBeTruthy();
    expect(screen.getByText('Variación del T/C (%)')).toBeTruthy();
    expect(screen.getByText('Escenario Controlado')).toBeTruthy();
  });

  it('debe actualizar métricas cuando cambia la variación por input directo', () => {
    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '10' } });

    expect(screen.getByText('Advertencia de Riesgo')).toBeTruthy();
    expect(screen.getByText(/erosión moderada de márgenes/i)).toBeTruthy();
    expect(screen.getAllByText('640.00%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$55,000').length).toBeGreaterThan(0);
  });

  it('debe mostrar estado de riesgo crítico en variaciones altas', () => {
    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={mockKPIData} />
      </Provider>
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '15' } });

    expect(screen.getByText('Riesgo Crítico')).toBeTruthy();
    expect(screen.getByText(/depreciación superior al 10%/i)).toBeTruthy();
  });

  it('debe mostrar mensaje cuando no hay datos', () => {
    render(
      <Provider store={store}>
        <ScenarioSimulator datos_actuales={undefined as any} />
      </Provider>
    );

    expect(screen.getByText('No hay datos suficientes para realizar simulaciones.')).toBeTruthy();
  });
});
