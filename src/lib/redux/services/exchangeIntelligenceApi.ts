import { apiSlice } from "./apiSlice";
import {
  CostImpactResponse,
  DebtExposureResponse,
  PaymentEfficiencyResponse,
  KPIsResponse,
  SimulateScenarioRequest,
  SimulateScenarioResponse,
} from "@/lib/types/exchange-intelligence";
import { CACHE_STRATEGY } from "@/lib/utils/cache-strategy";

export const exchangeIntelligenceApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Cost Impact Analysis
    getCostImpact: builder.query<CostImpactResponse, {
      fecha_inicio: string;
      fecha_fin: string;
      categoria_id?: string;
      almacen_id?: string;
      vendor_id?: string;
    }>({
      query: (params) => ({
        url: "/contabilidad/exchange/cost-impact",
        params,
      }),
      providesTags: ["ExchangeIntelligence"],
      ...CACHE_STRATEGY.COST_IMPACT,
    }),

    // Debt Exposure Analysis
    getDebtExposure: builder.query<DebtExposureResponse, {
      fecha_corte?: string;
    }>({
      query: (params) => ({
        url: "/contabilidad/exchange/debt-exposure",
        params,
      }),
      providesTags: ["ExchangeIntelligence"],
      ...CACHE_STRATEGY.DEBT_EXPOSURE,
    }),

    // Payment Efficiency Analysis
    getPaymentEfficiency: builder.query<PaymentEfficiencyResponse, {
      fecha_inicio: string;
      fecha_fin: string;
      moneda?: string;
    }>({
      query: (params) => ({
        url: "/contabilidad/exchange/payment-efficiency",
        params,
      }),
      providesTags: ["ExchangeIntelligence"],
      ...CACHE_STRATEGY.PAYMENT_EFFICIENCY,
    }),

    // KPIs
    getKPIs: builder.query<KPIsResponse, {
      fecha_inicio: string;
      fecha_fin: string;
    }>({
      query: (params) => ({
        url: "/contabilidad/exchange/kpis",
        params,
      }),
      providesTags: ["ExchangeIntelligence"],
      ...CACHE_STRATEGY.KPIs,
    }),

    // Scenario Simulation
    simulateScenario: builder.mutation<SimulateScenarioResponse, SimulateScenarioRequest>({
      query: (scenario) => ({
        url: "/contabilidad/exchange/simulate-scenario",
        method: "POST",
        body: scenario,
      }),
      invalidatesTags: ["ExchangeIntelligence"],
    }),
  }),
});

// Export hooks
export const {
  useGetCostImpactQuery,
  useGetDebtExposureQuery,
  useGetPaymentEfficiencyQuery,
  useGetKPIsQuery,
  useSimulateScenarioMutation,
} = exchangeIntelligenceApi;

// Cache invalidation utility
export const invalidateExchangeIntelligenceCache = () => {
  return [{ type: "ExchangeIntelligence" as const, id: "LIST" }];
};