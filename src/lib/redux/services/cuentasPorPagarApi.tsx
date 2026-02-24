import { apiSlice } from './apiSlice'
import type {
  CuentaPorPagar,
  CreateCuentaPorPagarRequest,
  PagarCuentaPorPagarRequest,
  PagoCuentaPorPagar
} from '@/app/models/model'

export interface CuentasPorPagarResponse {
  cuentas: CuentaPorPagar[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface GetCuentasPorPagarParams {
  estado?: string
  tipo?: string
  search?: string
  page?: number
  limit?: number
}

export const cuentasPorPagarApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCuentasPorPagar: builder.query<CuentasPorPagarResponse, GetCuentasPorPagarParams | void>({
      query: (params) => ({
        url: '/contabilidad/cuentas-por-pagar',
        params: params ?? undefined
      }),
      providesTags: ['CuentasPorPagar']
    }),
    createCuentaPorPagar: builder.mutation<CuentaPorPagar, CreateCuentaPorPagarRequest>({
      query: (data) => ({
        url: '/contabilidad/cuentas-por-pagar',
        method: 'POST',
        body: data
      }),
      transformResponse: (response: { cuenta: CuentaPorPagar }) => response.cuenta,
      invalidatesTags: ['CuentasPorPagar']
    }),
    pagarCuentaPorPagar: builder.mutation<
      { cuenta: CuentaPorPagar; pago: PagoCuentaPorPagar },
      { numeroFactura: string; tipo: 'compra' | 'servicio'; data: PagarCuentaPorPagarRequest }
    >({
      query: ({ numeroFactura, tipo, data }) => ({
        url: '/contabilidad/cuentas-por-pagar/pagar',
        method: 'POST',
        body: {
          numeroFactura,
          tipo,
          ...data
        }
      }),
      transformResponse: (response: { cuenta: CuentaPorPagar; pago: PagoCuentaPorPagar }) => response,
      invalidatesTags: ['CuentasPorPagar']
    })
  })
})

export const {
  useGetCuentasPorPagarQuery,
  useCreateCuentaPorPagarMutation,
  usePagarCuentaPorPagarMutation
} = cuentasPorPagarApi
