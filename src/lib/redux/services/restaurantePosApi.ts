import {
  ComandaRestaurante,
  EstadoComandaRestaurante,
  PlatoRestaurante,
  TipoPlatoRestaurante,
} from '@/app/models/model';
import { apiSlice } from './apiSlice';

interface GetComandasParams {
  estado?: EstadoComandaRestaurante;
  mesaId?: string;
}

interface CreateComandaPayload {
  mesaId: string;
  empleadoId?: string;
  observaciones?: string;
}

interface AddComandaItemPayload {
  comandaId: string;
  platoId: string;
  cantidad: number;
  notas?: string;
}

interface AnularItemComandaPayload {
  comandaId: string;
  itemId: string;
  cantidad: number;
  motivo?: string;
}

interface CheckoutComandaPayload {
  comandaId: string;
  splitCount: number;
  descuento: number;
  propina: number;
  pagos: Array<{
    metodo: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
    monto: number;
  }>;
}

interface CreatePlatoRestaurantePayload {
  nombre: string;
  descripcion?: string;
  precio: number;
  tipoPlato: TipoPlatoRestaurante;
  disponible?: boolean;
  categoriaPlatoId?: string;
  esElaborado?: boolean;
}

/**
 * @description Endpoints RTK Query para POS restaurante.
 * @returns {void} Endpoints inyectados en apiSlice.
 */
export const restaurantePosApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPlatosRestaurante: builder.query<PlatoRestaurante[], { disponible?: boolean } | void>({
      query: (params) => {
        if (params?.disponible) {
          return '/restaurante/platos?disponible=true';
        }

        return '/restaurante/platos';
      },
      providesTags: ['PlatosRestaurante'],
    }),

    createPlatoRestaurante: builder.mutation<
      PlatoRestaurante,
      CreatePlatoRestaurantePayload
    >({
      query: (payload) => ({
        url: '/restaurante/platos',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['PlatosRestaurante'],
    }),

    getComandasRestaurante: builder.query<ComandaRestaurante[], GetComandasParams | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();

        if (params?.estado) {
          queryParams.set('estado', params.estado);
        }

        if (params?.mesaId) {
          queryParams.set('mesaId', params.mesaId);
        }

        const queryString = queryParams.toString();
        return queryString
          ? `/restaurante/comandas?${queryString}`
          : '/restaurante/comandas';
      },
      providesTags: ['ComandasRestaurante'],
    }),

    getComandaRestauranteById: builder.query<
      ComandaRestaurante & {
        checkout?: unknown | null;
        folio?: string | null;
        reimpresiones?: number;
      },
      string
    >({
      query: (comandaId) => `/restaurante/comandas/${comandaId}`,
      providesTags: (result, error, comandaId) => [
        { type: 'ComandasRestaurante', id: comandaId },
      ],
    }),

    createComandaRestaurante: builder.mutation<ComandaRestaurante, CreateComandaPayload>({
      query: (payload) => ({
        url: '/restaurante/comandas',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['ComandasRestaurante', 'MesasRestaurante'],
    }),

    addItemComandaRestaurante: builder.mutation<ComandaRestaurante, AddComandaItemPayload>({
      query: ({ comandaId, ...payload }) => ({
        url: `/restaurante/comandas/${comandaId}/items`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['ComandasRestaurante'],
    }),

    closeComandaRestaurante: builder.mutation<ComandaRestaurante, { comandaId: string }>({
      query: ({ comandaId }) => ({
        url: `/restaurante/comandas/${comandaId}/cerrar`,
        method: 'POST',
      }),
      invalidatesTags: ['ComandasRestaurante', 'MesasRestaurante'],
    }),

    checkoutComandaRestaurante: builder.mutation<
      { comanda: ComandaRestaurante; checkout: unknown },
      CheckoutComandaPayload
    >({
      query: ({ comandaId, ...payload }) => ({
        url: `/restaurante/comandas/${comandaId}/checkout`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['ComandasRestaurante', 'MesasRestaurante'],
    }),

    anularItemComandaRestaurante: builder.mutation<
      ComandaRestaurante,
      AnularItemComandaPayload
    >({
      query: ({ comandaId, itemId, ...payload }) => ({
        url: `/restaurante/comandas/${comandaId}/items/${itemId}/anular`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['ComandasRestaurante'],
    }),

    reimprimirComandaRestaurante: builder.mutation<
      { comandaId: string; folio: string | null; reimpresiones: number },
      { comandaId: string }
    >({
      query: ({ comandaId }) => ({
        url: `/restaurante/comandas/${comandaId}/reimprimir`,
        method: 'POST',
      }),
      invalidatesTags: ['ComandasRestaurante'],
    }),
  }),
});

export const {
  useGetPlatosRestauranteQuery,
  useCreatePlatoRestauranteMutation,
  useGetComandasRestauranteQuery,
  useGetComandaRestauranteByIdQuery,
  useCreateComandaRestauranteMutation,
  useAddItemComandaRestauranteMutation,
  useCloseComandaRestauranteMutation,
  useCheckoutComandaRestauranteMutation,
  useAnularItemComandaRestauranteMutation,
  useReimprimirComandaRestauranteMutation,
} = restaurantePosApi;
