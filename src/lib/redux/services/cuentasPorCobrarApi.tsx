
import { apiSlice } from "./apiSlice"
import { CuentaPorCobrar } from "../../../app/models/model";

export interface ReporteAntiguedad {
  clienteId: string
  nombre: string
  corriente: number
  dias30: number
  dias60: number
  dias90: number
  dias120: number
  total: number
}

export interface FacturaReporte {
  id: string
  numero: string | null
  cliente: string
  fecha: string
  dias: number
  saldo: number
  categoria: 'Corriente' | '30-60 Días' | '60-90 Días' | '90-120 Días' | '+120 Días'
}

export interface IngresosPorEdadesResponse {
  reporte: ReporteAntiguedad[]
  facturas: FacturaReporte[]
}

export const cuentasPorCobrarApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getIngresosPorEdades: builder.query<IngresosPorEdadesResponse, void>({
      query: () => "/sugerencias/ingresos-por-edades",
      transformResponse: (response: { reporte: ReporteAntiguedad[], facturas: FacturaReporte[] }) => response,
      providesTags: ["CuentasPorCobrar"],
    }),
    getCuentasPorCobrar: builder.query<CuentaPorCobrar[], { estado?: string } | void>({
      query: (params) => {
        if (params && 'estado' in params) {
          return `/contabilidad/cuentas-por-cobrar?estado=${params.estado}`
        }
        return "/contabilidad/cuentas-por-cobrar"
      },
      transformResponse: (response: { cuentas: CuentaPorCobrar[] }) => response.cuentas,
      providesTags: ["CuentasPorCobrar"],
    }),
    addCuentaPorCobrar: builder.mutation<CuentaPorCobrar, Partial<CuentaPorCobrar>>({
      query: (cuenta) => ({
        url: "/contabilidad/cuentas-por-cobrar",
        method: "POST",
        body: cuenta,
      }),
      transformResponse: (response: { cuenta: CuentaPorCobrar }) => response.cuenta,
      invalidatesTags: ["CuentasPorCobrar"],
      transformErrorResponse: (response) => {
        // Handle HTML error responses
        if (response?.status === 404 || response?.status === 'PARSING_ERROR') {
          return { 
            serializedError: true, 
            message: 'Error de comunicación con el servidor. Por favor, intente nuevamente.',
            status: 404
          }
        }
        return response
      },
    }),
    updateCuentaPorCobrar: builder.mutation<CuentaPorCobrar, { id: string } & Partial<CuentaPorCobrar>>({
      query: ({ id, ...patch }) => ({
        url: `/contabilidad/cuentas-por-cobrar/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (response: { cuenta: CuentaPorCobrar }) => response.cuenta,
      invalidatesTags: ["CuentasPorCobrar"],
    }),
  }),
})

/**
 * @deprecated Usar Server Actions desde `@/features/contabilidad` en su lugar:
 *   - `getCuentasPorCobrarAction` → reemplaza `useGetCuentasPorCobrarQuery`
 *   - `createCuentaPorCobrarAction` → reemplaza `useAddCuentaPorCobrarMutation`
 *   - `updateCuentaPorCobrarAction` → reemplaza `useUpdateCuentaPorCobrarMutation`
 */
export const {
  useGetCuentasPorCobrarQuery,
  useAddCuentaPorCobrarMutation,
  useUpdateCuentaPorCobrarMutation,
  useGetIngresosPorEdadesQuery,
} = cuentasPorCobrarApi
