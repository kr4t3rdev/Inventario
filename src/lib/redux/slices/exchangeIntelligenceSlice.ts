import { createSlice, createSelector, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../store";
import {
  CostImpactResponse,
  DebtExposureResponse,
  PaymentEfficiencyResponse,
  KPIData,
  SimulationResult,
  ExchangeIntelligenceState,
} from "@/lib/types/exchange-intelligence";

// Initial state
const initialState: ExchangeIntelligenceState = {
  cost_impact: null,
  debt_exposure: null,
  payment_efficiency: null,
  kpis: null,
  simulation_result: null,
  loading: {
    cost_impact: false,
    debt_exposure: false,
    payment_efficiency: false,
    kpis: false,
    simulation: false,
  },
  errors: {
    cost_impact: null,
    debt_exposure: null,
    payment_efficiency: null,
    kpis: null,
    simulation: null,
  },
  filters: {
    fecha_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    fecha_fin: new Date().toISOString().split('T')[0], // today
    categoria_id: undefined,
    almacen_id: undefined,
    vendor_id: undefined,
    moneda: undefined,
  },
  custom_thresholds: {
    cost_increase_alert: 10, // 10%
    debt_exposure_alert: 5, // 5%
    spread_alert: 3, // 3%
    break_even_warning: 90, // 90%
    break_even_critical: 100, // 100%
    margin_alert: 15, // 15%
    differential_alert: 5, // 5%
    currency_trend_alert: 5, // 5%
  },
};

// Slice
const exchangeIntelligenceSlice = createSlice({
  name: "exchangeIntelligence",
  initialState,
  reducers: {
    // Data updates
    setCostImpact: (state, action: PayloadAction<CostImpactResponse>) => {
      state.cost_impact = action.payload;
      state.errors.cost_impact = null;
    },

    setDebtExposure: (state, action: PayloadAction<DebtExposureResponse>) => {
      state.debt_exposure = action.payload;
      state.errors.debt_exposure = null;
    },

    setPaymentEfficiency: (state, action: PayloadAction<PaymentEfficiencyResponse>) => {
      state.payment_efficiency = action.payload;
      state.errors.payment_efficiency = null;
    },

    setKPIs: (state, action: PayloadAction<KPIData>) => {
      state.kpis = action.payload;
      state.errors.kpis = null;
    },

    setSimulationResult: (state, action: PayloadAction<SimulationResult>) => {
      state.simulation_result = action.payload;
      state.errors.simulation = null;
    },

    // Loading states
    setLoading: (state, action: PayloadAction<{ section: keyof ExchangeIntelligenceState["loading"]; loading: boolean }>) => {
      state.loading[action.payload.section] = action.payload.loading;
    },

    // Error handling
    setError: (state, action: PayloadAction<{ section: keyof ExchangeIntelligenceState["errors"]; error: string | null }>) => {
      state.errors[action.payload.section] = action.payload.error;
    },

    clearError: (state, action: PayloadAction<keyof ExchangeIntelligenceState["errors"]>) => {
      state.errors[action.payload] = null;
    },

    clearAllErrors: (state) => {
      Object.keys(state.errors).forEach(key => {
        state.errors[key as keyof ExchangeIntelligenceState["errors"]] = null;
      });
    },

    // Filters
    setFilters: (state, action: PayloadAction<Partial<ExchangeIntelligenceState["filters"]>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },

    clearFilters: (state) => {
      state.filters = {
        fecha_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        fecha_fin: new Date().toISOString().split('T')[0],
        categoria_id: undefined,
        almacen_id: undefined,
        vendor_id: undefined,
        moneda: undefined,
      };
    },

    // Custom thresholds
    setCustomThresholds: (state, action: PayloadAction<Partial<ExchangeIntelligenceState["custom_thresholds"]>>) => {
      state.custom_thresholds = { ...state.custom_thresholds, ...action.payload };
    },

    resetCustomThresholds: (state) => {
      state.custom_thresholds = initialState.custom_thresholds;
    },

    // Cache invalidation
    invalidateData: (state, action: PayloadAction<(keyof ExchangeIntelligenceState["loading"])[]>) => {
      action.payload.forEach(section => {
        switch (section) {
          case "cost_impact":
            state.cost_impact = null;
            break;
          case "debt_exposure":
            state.debt_exposure = null;
            break;
          case "payment_efficiency":
            state.payment_efficiency = null;
            break;
          case "kpis":
            state.kpis = null;
            break;
          case "simulation":
            state.simulation_result = null;
            break;
        }
      });
    },

    // Reset entire state
    resetExchangeIntelligence: () => initialState,
  },
});

// Actions
export const {
  setCostImpact,
  setDebtExposure,
  setPaymentEfficiency,
  setKPIs,
  setSimulationResult,
  setLoading,
  setError,
  clearError,
  clearAllErrors,
  setFilters,
  clearFilters,
  setCustomThresholds,
  resetCustomThresholds,
  invalidateData,
  resetExchangeIntelligence,
} = exchangeIntelligenceSlice.actions;

// Basic selectors
export const selectExchangeIntelligenceState = (state: RootState) => state.exchangeIntelligence;
export const selectCostImpact = (state: RootState) => state.exchangeIntelligence.cost_impact;
export const selectDebtExposure = (state: RootState) => state.exchangeIntelligence.debt_exposure;
export const selectPaymentEfficiency = (state: RootState) => state.exchangeIntelligence.payment_efficiency;
export const selectKPIs = (state: RootState) => state.exchangeIntelligence.kpis;
export const selectSimulationResult = (state: RootState) => state.exchangeIntelligence.simulation_result;
export const selectLoading = (state: RootState) => state.exchangeIntelligence.loading;
export const selectErrors = (state: RootState) => state.exchangeIntelligence.errors;
export const selectFilters = (state: RootState) => state.exchangeIntelligence.filters;
export const selectCustomThresholds = (state: RootState) => state.exchangeIntelligence.custom_thresholds;

// Computed selectors
export const selectHasData = createSelector(
  [selectCostImpact, selectDebtExposure, selectPaymentEfficiency, selectKPIs],
  (costImpact, debtExposure, paymentEfficiency, kpis) => ({
    costImpact: costImpact !== null,
    debtExposure: debtExposure !== null,
    paymentEfficiency: paymentEfficiency !== null,
    kpis: kpis !== null,
  })
);

export const selectIsLoading = createSelector(
  [selectLoading],
  (loading) => Object.values(loading).some(Boolean)
);

export const selectHasErrors = createSelector(
  [selectErrors],
  (errors) => Object.values(errors).some(error => error !== null)
);

export const selectActiveAlerts = createSelector(
  [selectCostImpact, selectDebtExposure, selectPaymentEfficiency, selectKPIs, selectCustomThresholds],
  (costImpact, debtExposure, paymentEfficiency, kpis, thresholds) => {
    const alerts: Array<{
      type: string;
      message: string;
      severity: 'info' | 'warning' | 'critical';
      section: string;
    }> = [];

    // Cost impact alerts
    if (costImpact && costImpact.timeline.length > 0) {
      const avgIncrease = costImpact.timeline.reduce((sum, entry) => sum + entry.diferencia_porcentual, 0) / costImpact.timeline.length;

      if (avgIncrease > thresholds.cost_increase_alert) {
        alerts.push({
          type: 'cost_increase',
          message: `Incremento promedio de costos: ${avgIncrease.toFixed(2)}%`,
          severity: 'critical',
          section: 'cost_impact',
        });
      }
    }

    // Debt exposure alerts
    if (debtExposure && debtExposure.perdida_no_realizada > 0) {
      const lossPercentage = (debtExposure.perdida_no_realizada / debtExposure.deuda_original_local) * 100;
      if (lossPercentage > thresholds.debt_exposure_alert) {
        alerts.push({
          type: 'debt_exposure',
          message: `Pérdida no realizada: ${lossPercentage.toFixed(2)}%`,
          severity: 'critical',
          section: 'debt_exposure',
        });
      }
    }

    // Payment efficiency alerts
    if (paymentEfficiency && paymentEfficiency.spread_promedio > thresholds.spread_alert) {
      alerts.push({
        type: 'payment_efficiency',
        message: `Spread bancario promedio: ${paymentEfficiency.spread_promedio.toFixed(2)}%`,
        severity: 'warning',
        section: 'payment_efficiency',
      });
    }

    // KPI alerts
    if (kpis) {
      // Break-even alerts
      kpis.tasa_equilibrio.productos.forEach(producto => {
        if (producto.estado === 'critico') {
          alerts.push({
            type: 'break_even_critical',
            message: `${producto.nombre}: ${producto.proximidad_porcentaje.toFixed(1)}% sobre tasa de equilibrio`,
            severity: 'critical',
            section: 'kpis',
          });
        } else if (producto.estado === 'advertencia') {
          alerts.push({
            type: 'break_even_warning',
            message: `${producto.nombre}: ${producto.proximidad_porcentaje.toFixed(1)}% sobre tasa de equilibrio`,
            severity: 'warning',
            section: 'kpis',
          });
        }
      });

      // Margin alerts
      if (kpis.margen_real_vs_nominal.diferencia_porcentual > thresholds.margin_alert) {
        alerts.push({
          type: 'margin_alert',
          message: `Diferencia de márgenes: ${kpis.margen_real_vs_nominal.diferencia_porcentual.toFixed(2)}%`,
          severity: 'warning',
          section: 'kpis',
        });
      }

      // Debt priority alerts
      kpis.envejecimiento_deuda.forEach(deuda => {
        if (deuda.tendencia_moneda === 'alcista' && deuda.antiguedad_dias > 30) {
          alerts.push({
            type: 'debt_priority',
            message: `Deuda prioritaria: ${deuda.entidad} (${deuda.moneda} alcista)`,
            severity: 'warning',
            section: 'kpis',
          });
        }
      });
    }

    return alerts;
  }
);

export const selectCriticalAlertsCount = createSelector(
  [selectActiveAlerts],
  (alerts) => alerts.filter(alert => alert.severity === 'critical').length
);

export const selectWarningAlertsCount = createSelector(
  [selectActiveAlerts],
  (alerts) => alerts.filter(alert => alert.severity === 'warning').length
);

export const selectVulnerableProducts = createSelector(
  [selectKPIs],
  (kpis) => {
    if (!kpis) return [];
    return kpis.tasa_equilibrio.productos
      .filter(producto => producto.estado !== 'seguro')
      .sort((a, b) => b.proximidad_porcentaje - a.proximidad_porcentaje);
  }
);

export const selectHighPriorityDebts = createSelector(
  [selectKPIs],
  (kpis) => {
    if (!kpis) return [];
    return kpis.envejecimiento_deuda
      .filter(deuda => deuda.prioridad > 0.5)
      .sort((a, b) => b.prioridad - a.prioridad);
  }
);

export default exchangeIntelligenceSlice.reducer;