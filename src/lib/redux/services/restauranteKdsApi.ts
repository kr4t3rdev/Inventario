import { KdsComanda, EstadoComandaItemRestaurante } from '@/app/models/model';
import { apiSlice } from './apiSlice';

/**
 * @description Endpoints RTK Query para KDS (pantalla de cocina).
 * @returns {void} Endpoints inyectados.
 */
export const restauranteKdsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getKdsQueue: builder.query<KdsComanda[], void>({
      query: () => '/restaurante/kds',
      providesTags: ['KdsRestaurante', 'ComandasRestaurante'],
    }),

    updateKdsItemEstado: builder.mutation<
      { item: unknown; comandaId: string; pendingCount: number },
      { itemId: string; estado: EstadoComandaItemRestaurante }
    >({
      query: ({ itemId, estado }) => ({
        url: `/restaurante/kds/items/${itemId}/estado`,
        method: 'PATCH',
        body: { estado },
      }),
      invalidatesTags: ['KdsRestaurante', 'ComandasRestaurante'],
    }),
  }),
});

export const { useGetKdsQueueQuery, useUpdateKdsItemEstadoMutation } = restauranteKdsApi;
