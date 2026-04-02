import { apiSlice } from './apiSlice'
import {
  PrestamoCash,
  PrestamosCashStats,
  CreatePrestamoCashRequest,
  UpdatePrestamoCashRequest,
  RegistrarPagoPrestamoRequest,
} from '../../../app/models/model'

export const prestamosCashApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPrestamosCash: builder.query<PrestamoCash[], { estado?: string; clienteId?: string; moneda?: string } | void>({
      query: (params) => {
        const searchParams = new URLSearchParams()
        if (params && 'estado' in params && params.estado) searchParams.set('estado', params.estado)
        if (params && 'clienteId' in params && params.clienteId) searchParams.set('clienteId', params.clienteId)
        if (params && 'moneda' in params && params.moneda) searchParams.set('moneda', params.moneda)
        const qs = searchParams.toString()
        return `/contabilidad/prestamos-cash${qs ? `?${qs}` : ''}`
      },
      transformResponse: (response: { prestamos: PrestamoCash[] }) => response.prestamos,
      providesTags: ['PrestamosCash'],
    }),
    getPrestamosCashStats: builder.query<PrestamosCashStats, void>({
      query: () => '/contabilidad/prestamos-cash/stats',
      providesTags: ['PrestamosCash'],
    }),
    getPrestamoCash: builder.query<PrestamoCash, string>({
      query: (id) => `/contabilidad/prestamos-cash/${id}`,
      transformResponse: (response: { prestamo: PrestamoCash }) => response.prestamo,
      providesTags: (result, error, id) => [{ type: 'PrestamosCash', id }],
    }),
    createPrestamoCash: builder.mutation<PrestamoCash, CreatePrestamoCashRequest>({
      query: (prestamo) => ({
        url: '/contabilidad/prestamos-cash',
        method: 'POST',
        body: prestamo,
      }),
      transformResponse: (response: { prestamo: PrestamoCash }) => response.prestamo,
      invalidatesTags: ['PrestamosCash', 'CuentasPorCobrar'],
    }),
    updatePrestamoCash: builder.mutation<PrestamoCash, { id: string } & UpdatePrestamoCashRequest>({
      query: ({ id, ...data }) => ({
        url: `/contabilidad/prestamos-cash/${id}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: { prestamo: PrestamoCash }) => response.prestamo,
      invalidatesTags: (result, error, { id }) => [{ type: 'PrestamosCash', id }, 'PrestamosCash'],
    }),
    registrarPagoPrestamo: builder.mutation<void, { id: string } & RegistrarPagoPrestamoRequest>({
      query: ({ id, ...data }) => ({
        url: `/contabilidad/prestamos-cash/${id}/pagar`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['PrestamosCash', 'CuentasPorCobrar', 'CuentasBancarias'],
    }),
  }),
})

export const {
  useGetPrestamosCashQuery,
  useGetPrestamosCashStatsQuery,
  useGetPrestamoCashQuery,
  useCreatePrestamoCashMutation,
  useUpdatePrestamoCashMutation,
  useRegistrarPagoPrestamoMutation,
} = prestamosCashApi
