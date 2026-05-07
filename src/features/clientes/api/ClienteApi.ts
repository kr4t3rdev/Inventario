import { apiSlice } from "@/lib/redux/services/apiSlice"
import type { Cliente } from "@/app/models/model"

export const clientesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getClientes: builder.query<Cliente[], void>({
      query: () => "/cliente",
      providesTags: ["Clientes"],
    }),
    getCliente: builder.query<Cliente, string>({
      query: (id) => `/cliente/${id}`,
      providesTags: (result, error, id) => [{ type: "Clientes", id }],
    }),
    addCliente: builder.mutation<Cliente, Omit<Cliente, "clienteId" | "createdAt" | "updatedAt">>({
      query: (cliente) => ({ url: "/cliente", method: "POST", body: cliente }),
      invalidatesTags: ["Clientes"],
    }),
    updateCliente: builder.mutation<Cliente, Partial<Cliente> & { clienteId: string }>({
      query: ({ clienteId, ...patch }) => ({ url: `/cliente/${clienteId}`, method: "PATCH", body: patch }),
      invalidatesTags: (result, error, { clienteId }) => [{ type: "Clientes", clienteId }],
    }),
    deleteCliente: builder.mutation<{ success: boolean; id: string }, string>({
      query: (id) => ({ url: `/cliente/${id}`, method: "DELETE" }),
      invalidatesTags: ["Clientes"],
    }),
  }),
})

export const { useGetClientesQuery, useGetClienteQuery, useAddClienteMutation, useUpdateClienteMutation, useDeleteClienteMutation } = clientesApi
