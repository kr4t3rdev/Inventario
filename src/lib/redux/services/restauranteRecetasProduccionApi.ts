import {
  EstadoProduccionRestaurante,
  OrdenProduccionRestaurante,
  RecetaRestaurante,
} from '@/app/models/model';
import { apiSlice } from './apiSlice';

interface CreateRecetaPayload {
  nombre: string;
  rendimiento: number;
  instrucciones?: string;
  tiempoPrep?: number;
}

interface UpdateRecetaPayload {
  recetaId: string;
  nombre?: string;
  rendimiento?: number;
  instrucciones?: string;
  tiempoPrep?: number | null;
}

interface SetIngredientesPayload {
  recetaId: string;
  ingredientes: {
    productoId: string;
    cantidad: number;
    desperdicio: number;
  }[];
}

interface CreateOrdenProduccionPayload {
  recetaId: string;
  cantidad: number;
  observaciones?: string;
  fechaProduccion?: string;
}

/**
 * @description Endpoints RTK Query para recetas y producción del restaurante.
 * @returns {void} Endpoints inyectados en apiSlice.
 */
export const restauranteRecetasProduccionApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRecetasRestaurante: builder.query<RecetaRestaurante[], { search?: string } | void>({
      query: (params) => {
        if (params?.search?.trim()) {
          return `/restaurante/recetas?search=${encodeURIComponent(params.search.trim())}`;
        }

        return '/restaurante/recetas';
      },
      providesTags: ['RecetasRestaurante'],
    }),

    createRecetaRestaurante: builder.mutation<RecetaRestaurante, CreateRecetaPayload>({
      query: (payload) => ({
        url: '/restaurante/recetas',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['RecetasRestaurante'],
    }),

    updateRecetaRestaurante: builder.mutation<RecetaRestaurante, UpdateRecetaPayload>({
      query: ({ recetaId, ...payload }) => ({
        url: `/restaurante/recetas/${recetaId}`,
        method: 'PATCH',
        body: payload,
      }),
      invalidatesTags: ['RecetasRestaurante'],
    }),

    deleteRecetaRestaurante: builder.mutation<{ success: boolean; recetaId: string }, string>({
      query: (recetaId) => ({
        url: `/restaurante/recetas/${recetaId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['RecetasRestaurante'],
    }),

    setIngredientesRecetaRestaurante: builder.mutation<
      RecetaRestaurante,
      SetIngredientesPayload
    >({
      query: ({ recetaId, ingredientes }) => ({
        url: `/restaurante/recetas/${recetaId}/ingredientes`,
        method: 'POST',
        body: { ingredientes },
      }),
      invalidatesTags: ['RecetasRestaurante'],
    }),

    getOrdenesProduccionRestaurante: builder.query<
      OrdenProduccionRestaurante[],
      { estado?: EstadoProduccionRestaurante } | void
    >({
      query: (params) => {
        if (params?.estado) {
          return `/restaurante/produccion?estado=${params.estado}`;
        }

        return '/restaurante/produccion';
      },
      providesTags: ['ProduccionRestaurante'],
    }),

    createOrdenProduccionRestaurante: builder.mutation<
      OrdenProduccionRestaurante,
      CreateOrdenProduccionPayload
    >({
      query: (payload) => ({
        url: '/restaurante/produccion',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['ProduccionRestaurante'],
    }),

    iniciarOrdenProduccionRestaurante: builder.mutation<
      OrdenProduccionRestaurante,
      { ordenProduccionId: string }
    >({
      query: ({ ordenProduccionId }) => ({
        url: `/restaurante/produccion/${ordenProduccionId}/iniciar`,
        method: 'POST',
      }),
      invalidatesTags: ['ProduccionRestaurante'],
    }),

    completarOrdenProduccionRestaurante: builder.mutation<
      OrdenProduccionRestaurante,
      { ordenProduccionId: string }
    >({
      query: ({ ordenProduccionId }) => ({
        url: `/restaurante/produccion/${ordenProduccionId}/completar`,
        method: 'POST',
      }),
      invalidatesTags: ['ProduccionRestaurante', 'Productos'],
    }),
  }),
});

export const {
  useGetRecetasRestauranteQuery,
  useCreateRecetaRestauranteMutation,
  useUpdateRecetaRestauranteMutation,
  useDeleteRecetaRestauranteMutation,
  useSetIngredientesRecetaRestauranteMutation,
  useGetOrdenesProduccionRestauranteQuery,
  useCreateOrdenProduccionRestauranteMutation,
  useIniciarOrdenProduccionRestauranteMutation,
  useCompletarOrdenProduccionRestauranteMutation,
} = restauranteRecetasProduccionApi;
