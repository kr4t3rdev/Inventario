import { apiSlice } from '@/lib/redux/services/apiSlice'
import type { GastoConcepto, GastoElemento } from '@/app/models/model'

export const gastosConceptosApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getGastoConceptos: builder.query<GastoConcepto[], { onlyActive?: boolean } | void>({
      query: (params) => { const qs = params?.onlyActive ? '?onlyActive=true' : ''; return `/gastosDE/conceptos${qs}` },
      providesTags: ['GastosConceptos'],
    }),
    getGastoConcepto: builder.query<GastoConcepto, string>({
      query: (conceptoId) => `/gastosDE/conceptos/${conceptoId}`,
      providesTags: (result, error, id) => [{ type: 'GastosConceptos', id }],
    }),
    addGastoConcepto: builder.mutation<GastoConcepto, Omit<GastoConcepto, 'conceptoId' | 'createdAt' | 'updatedAt'>>({
      query: (concepto) => ({ url: '/gastosDE/conceptos', method: 'POST', body: concepto }),
      invalidatesTags: ['GastosConceptos'],
    }),
    updateGastoConcepto: builder.mutation<GastoConcepto, { conceptoId: string } & Partial<GastoConcepto>>({
      query: ({ conceptoId, ...patch }) => ({ url: `/gastosDE/conceptos/${conceptoId}`, method: 'PATCH', body: patch }),
      invalidatesTags: (result, error, { conceptoId }) => [{ type: 'GastosConceptos', conceptoId }],
    }),
    deleteGastoConcepto: builder.mutation<void, string>({
      query: (conceptoId) => ({ url: `/gastosDE/conceptos/${conceptoId}`, method: 'DELETE' }),
      invalidatesTags: ['GastosConceptos'],
    }),
    getGastoElementos: builder.query<GastoElemento[], string>({
      query: (conceptoId) => `/gastosDE/conceptos/${conceptoId}/elementos`,
      providesTags: (result, error, conceptoId) => [{ type: 'GastosElementos', conceptoId }],
    }),
    addGastoElemento: builder.mutation<GastoElemento, { conceptoId: string } & Omit<GastoElemento, 'elementoId' | 'createdAt' | 'updatedAt' | 'conceptoId'>>({
      query: ({ conceptoId, ...elemento }) => ({ url: `/gastosDE/conceptos/${conceptoId}/elementos`, method: 'POST', body: elemento }),
      invalidatesTags: (result, error, { conceptoId }) => [{ type: 'GastosElementos', conceptoId }, 'GastosConceptos'],
    }),
    updateGastoElemento: builder.mutation<GastoElemento, { conceptoId: string; elementoId: string } & Partial<GastoElemento>>({
      query: ({ conceptoId, elementoId, ...patch }) => ({ url: `/gastosDE/conceptos/${conceptoId}/elementos/${elementoId}`, method: 'PATCH', body: patch }),
      invalidatesTags: (result, error, { conceptoId, elementoId }) => [{ type: 'GastosElementos', conceptoId }, 'GastosConceptos'],
    }),
    deleteGastoElemento: builder.mutation<void, { conceptoId: string; elementoId: string }>({
      query: ({ conceptoId, elementoId }) => ({ url: `/gastosDE/conceptos/${conceptoId}/elementos/${elementoId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { conceptoId }) => [{ type: 'GastosElementos', conceptoId }, 'GastosConceptos'],
    }),
  }),
})

export const { useGetGastoConceptosQuery, useGetGastoConceptoQuery, useAddGastoConceptoMutation, useUpdateGastoConceptoMutation, useDeleteGastoConceptoMutation, useGetGastoElementosQuery, useAddGastoElementoMutation, useUpdateGastoElementoMutation, useDeleteGastoElementoMutation } = gastosConceptosApi
