import { apiSlice } from "./apiSlice";
import { Pagosalario } from "../../../app/models/model";

export const pagoSalarioApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getPagoSalarios: builder.query<Pagosalario[], void>({
            query: () => '/pago-salario',
            providesTags: ['PagoSalarios']
        }),
        getPagoSalario: builder.query<Pagosalario, string>({
            query: (pgId) => `/pago-salario/${pgId}`,
            providesTags: (result, error, pgId) => [{ type: "PagoSalarios", pgId }],
        }),
        addPagoSalario: builder.mutation<Pagosalario, Omit<Pagosalario, "pgId" | "createdAt" | "updatedAt" | "periodo">>({
            query: (pagoSalario) => ({
                url: '/pago-salario',
                method: 'POST',
                body: pagoSalario,
            }),
            invalidatesTags: ['PagoSalarios'],
        }),
        updatePagoSalario: builder.mutation<Pagosalario, Partial<Pagosalario> & { pgId: string }>({
            query: ({ pgId, ...patch }) => ({
                url: `/pago-salario/${pgId}`,
                method: 'PATCH',
                body: patch,
            }),
            invalidatesTags: (result, error, { pgId }) => [{ type: "PagoSalarios", pgId }],
        }),
        deletePagoSalario: builder.mutation<{ success: boolean; id: string }, string>({
            query: (pgId) => ({
                url: `/pago-salario/${pgId}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['PagoSalarios'],
        }),
    })
})

export const {
    useGetPagoSalariosQuery,
    useGetPagoSalarioQuery,
    useAddPagoSalarioMutation,
    useUpdatePagoSalarioMutation,
    useDeletePagoSalarioMutation
} = pagoSalarioApi