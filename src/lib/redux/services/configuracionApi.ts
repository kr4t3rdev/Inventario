import { apiSlice } from "./apiSlice";

export interface CuentaBancaria {
  cuentaId: string;
  nombreBanco: string;
  numeroCuenta: string;
  moneda: string;
  tipoCuenta: string;
}

export const configuracionApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCuentasBancarias: builder.query<CuentaBancaria[], void>({
      query: () => "/configuracion/cuentas-bancarias",
      providesTags: ["Configuracion"],
    }),
    getNextSerieNumber: builder.query<{ nextNumber: number; prefijo: string; preview: string }, string>({
      query: (prefijo) => `/configuracion/series/next?prefijo=${prefijo}`,
      providesTags: ["Configuracion"],
    }),
  }),
});

export const { useGetCuentasBancariasQuery, useGetNextSerieNumberQuery, useLazyGetNextSerieNumberQuery } = configuracionApi;
