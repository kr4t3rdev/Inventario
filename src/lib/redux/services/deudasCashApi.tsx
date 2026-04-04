import { apiSlice } from './apiSlice'
import {
  DeudaCash,
  DeudasCashStats,
  CreateDeudaCashRequest,
  UpdateDeudaCashRequest,
  RegistrarPagoDeudaRequest,
} from '../../../app/models/model'

export const deudasCashApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDeudasCash: builder.query<DeudaCash[], { estado?: string; proveedorId?: string; moneda?: string } | void>({
      query: (params) => {
        const searchParams = new URLSearchParams()
        if (params && 'estado' in params && params.estado) searchParams.set('estado', params.estado)
        if (params && 'proveedorId' in params && params.proveedorId) searchParams.set('proveedorId', params.proveedorId)
        if (params && 'moneda' in params && params.moneda) searchParams.set('moneda', params.moneda)
        const qs = searchParams.toString()
        return `/contabilidad/deudas-cash${qs ? `?${qs}` : ''}`
      },
      transformResponse: (response: { deudas: DeudaCash[] }) => response.deudas,
      providesTags: ['DeudasCash'],
    }),
    getDeudaCash: builder.query<DeudaCash, string>({
      query: (id) => `/contabilidad/deudas-cash/${id}`,
      transformResponse: (response: { deuda: DeudaCash }) => response.deuda,
      providesTags: (result, error, id) => [{ type: 'DeudasCash', id }],
    }),
    createDeudaCash: builder.mutation<DeudaCash, CreateDeudaCashRequest>({
      query: (deuda) => ({
        url: '/contabilidad/deudas-cash',
        method: 'POST',
        body: deuda,
      }),
      transformResponse: (response: { deuda: DeudaCash }) => response.deuda,
      invalidatesTags: ['DeudasCash', 'CuentasPorPagar', 'CuentasBancarias'],
    }),
    updateDeudaCash: builder.mutation<DeudaCash, { id: string } & UpdateDeudaCashRequest>({
      query: ({ id, ...data }) => ({
        url: `/contabilidad/deudas-cash/${id}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: { deuda: DeudaCash }) => response.deuda,
      invalidatesTags: (result, error, { id }) => [{ type: 'DeudasCash', id }, 'DeudasCash'],
    }),
    registrarPagoDeuda: builder.mutation<void, { id: string } & RegistrarPagoDeudaRequest>({
      query: ({ id, ...data }) => ({
        url: `/contabilidad/deudas-cash/${id}/pagar`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['DeudasCash', 'CuentasPorPagar', 'CuentasBancarias'],
    }),
    getDeudasCashStats: builder.query<DeudasCashStats, void>({
      query: () => '/contabilidad/deudas-cash/stats',
      providesTags: ['DeudasCash'],
    }),
  }),
})

export const {
  useGetDeudasCashQuery,
  useGetDeudaCashQuery,
  useCreateDeudaCashMutation,
  useUpdateDeudaCashMutation,
  useRegistrarPagoDeudaMutation,
  useGetDeudasCashStatsQuery,
} = deudasCashApi
