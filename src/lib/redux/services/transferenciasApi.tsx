import { apiSlice } from "./apiSlice"
import { Transferencia } from "../../../app/models/model";

interface GetTransferenciasResponse {
  transferencias: Transferencia[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export const transferenciasApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTransferencias: builder.query<GetTransferenciasResponse, void>({
      query: () => "/transferencias",
      providesTags: ["Transferencias"],
    }),
    getTransferencia: builder.query<Transferencia, string>({
      query: (id) => `/transferencias/${id}`,
      providesTags: (result, error, id) => [{ type: "Transferencias", id }],
    }),
    addTransferencia: builder.mutation<
      Transferencia,
      Omit<Transferencia, "transferenciaId" | "createdAt" | "updatedAt">
    >({
      query: (transferencia) => ({
        url: "/transferencias",
        method: "POST",
        body: transferencia,
      }),
      invalidatesTags: ["Transferencias"],
    }),
    updateTransferencia: builder.mutation<Transferencia, Partial<Transferencia> & { transferenciaId: string }>({
      query: ({ transferenciaId, ...patch }) => ({
        url: `/transferencias/${transferenciaId}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: (result, error, { transferenciaId }) => [{ type: "Transferencias", transferenciaId }],
    }),
    deleteTransferencia: builder.mutation<{ success: boolean; id: string; message?: string }, string>({
      query: (id) => ({
        url: `/transferencias/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Transferencias", "Productos", "StockUbicacion"],
    }),
  }),
})

export const {
  useGetTransferenciasQuery,
  useGetTransferenciaQuery,
  useAddTransferenciaMutation,
  useUpdateTransferenciaMutation,
  useDeleteTransferenciaMutation,
} = transferenciasApi
