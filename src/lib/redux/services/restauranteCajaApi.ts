import { apiSlice } from './apiSlice';
import { CierreCajaPos } from '@/app/models/model';

interface CajaResumenResponse {
  fechaInicio: string;
  fechaFin: string;
  totalComandas: number;
  totalFacturado: number;
  porMetodo: {
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    noClasificado: number;
  };
}

interface CerrarCajaPayload {
  fechaInicio: string;
  fechaFin: string;
  observaciones?: string;
}

interface ReabrirCierreCajaPayload {
  cierreId: string;
  motivo: string;
}

interface TurnoCajaPosResponse {
  turnoActivo: CierreCajaPos | null;
  turnos: CierreCajaPos[];
}

/**
 * @description Endpoints RTK Query para resumen y cierre de caja restaurante.
 * @returns {void} Endpoints inyectados en apiSlice.
 */
export const restauranteCajaApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getResumenCajaRestaurante: builder.query<
      CajaResumenResponse,
      { fechaInicio?: string; fechaFin?: string } | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();

        if (params?.fechaInicio) {
          queryParams.set('fechaInicio', params.fechaInicio);
        }

        if (params?.fechaFin) {
          queryParams.set('fechaFin', params.fechaFin);
        }

        const queryString = queryParams.toString();

        return queryString
          ? `/restaurante/caja/cierre?${queryString}`
          : '/restaurante/caja/cierre';
      },
      providesTags: ['ComandasRestaurante'],
    }),

    cerrarCajaRestaurante: builder.mutation<
      { cierre: unknown; resumen: CajaResumenResponse },
      CerrarCajaPayload
    >({
      query: (payload) => ({
        url: '/restaurante/caja/cierre',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['ComandasRestaurante'],
    }),

    getCierresCajaRestaurante: builder.query<CierreCajaPos[], { limit?: number } | void>({
      query: (params) =>
        params?.limit
          ? `/restaurante/caja/cierres?limit=${params.limit}`
          : '/restaurante/caja/cierres',
      providesTags: ['ComandasRestaurante'],
    }),

    reabrirCierreCajaRestaurante: builder.mutation<
      CierreCajaPos,
      ReabrirCierreCajaPayload
    >({
      query: ({ cierreId, motivo }) => ({
        url: `/restaurante/caja/cierres/${cierreId}/reabrir`,
        method: 'POST',
        body: { motivo },
      }),
      invalidatesTags: ['ComandasRestaurante'],
    }),

    getTurnosCajaRestaurante: builder.query<TurnoCajaPosResponse, void>({
      query: () => '/restaurante/caja/turnos',
      providesTags: ['ComandasRestaurante'],
    }),

    abrirTurnoCajaRestaurante: builder.mutation<CierreCajaPos, { observaciones?: string }>({
      query: (payload) => ({
        url: '/restaurante/caja/turnos',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['ComandasRestaurante'],
    }),

    cerrarTurnoCajaRestaurante: builder.mutation<
      { turno: CierreCajaPos; resumen: CajaResumenResponse },
      { observaciones?: string }
    >({
      query: (payload) => ({
        url: '/restaurante/caja/turnos/cerrar',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['ComandasRestaurante'],
    }),
  }),
});

export const {
  useGetResumenCajaRestauranteQuery,
  useCerrarCajaRestauranteMutation,
  useGetCierresCajaRestauranteQuery,
  useReabrirCierreCajaRestauranteMutation,
  useGetTurnosCajaRestauranteQuery,
  useAbrirTurnoCajaRestauranteMutation,
  useCerrarTurnoCajaRestauranteMutation,
} = restauranteCajaApi;
