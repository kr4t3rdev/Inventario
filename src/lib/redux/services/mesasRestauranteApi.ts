import { MesaRestaurante, MesaRestauranteEstado } from '@/app/models/model';
import { apiSlice } from './apiSlice';

interface GetMesasParams {
  estado?: MesaRestauranteEstado | 'TODAS';
  numero?: number;
}

interface CreateMesaPayload {
  numero: number;
  capacidad: number;
  estado?: MesaRestauranteEstado;
}

interface UpdateMesaPayload {
  mesaId: string;
  numero?: number;
  capacidad?: number;
  estado?: MesaRestauranteEstado;
}

/**
 * @description API slice para gestión de mesas del módulo restaurante.
 * @returns {void} Endpoints RTK Query inyectados en apiSlice.
 */
export const mesasRestauranteApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMesasRestaurante: builder.query<MesaRestaurante[], GetMesasParams | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();

        if (params?.estado && params.estado !== 'TODAS') {
          queryParams.set('estado', params.estado);
        }

        if (params?.numero) {
          queryParams.set('numero', String(params.numero));
        }

        const queryString = queryParams.toString();
        return queryString
          ? `/restaurante/mesas?${queryString}`
          : '/restaurante/mesas';
      },
      providesTags: ['MesasRestaurante'],
    }),

    addMesaRestaurante: builder.mutation<MesaRestaurante, CreateMesaPayload>({
      query: (mesa) => ({
        url: '/restaurante/mesas',
        method: 'POST',
        body: mesa,
      }),
      invalidatesTags: ['MesasRestaurante'],
    }),

    updateMesaRestaurante: builder.mutation<MesaRestaurante, UpdateMesaPayload>({
      query: ({ mesaId, ...patch }) => ({
        url: `/restaurante/mesas/${mesaId}`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: ['MesasRestaurante'],
    }),

    deleteMesaRestaurante: builder.mutation<
      { success: boolean; mesaId: string },
      string
    >({
      query: (mesaId) => ({
        url: `/restaurante/mesas/${mesaId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['MesasRestaurante'],
    }),
  }),
});

export const {
  useGetMesasRestauranteQuery,
  useAddMesaRestauranteMutation,
  useUpdateMesaRestauranteMutation,
  useDeleteMesaRestauranteMutation,
} = mesasRestauranteApi;
