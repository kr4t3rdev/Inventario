import { apiSlice } from "./apiSlice";
import { GastosDE } from "../../../app/models/model";

export const gastosDEApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getGastosDE: builder.query<GastosDE[], void>({
            query: () => '/gastosDE',
            providesTags: ['GastosDE']
        }),
        getGastoDE: builder.query<GastosDE, string>({
            query: (id) => `/gastosDE/${id}`,
            providesTags: (result, error, id) => [{ type: "GastosDE", id }],
        }),
        addGastosDE: builder.mutation<GastosDE, Omit<GastosDE, "id" | "createdAt" | "updatedAt" | "periodo">>({
            query: (GastosDE) => ({
                url: '/gastosDE',
                method: 'POST',
                body: GastosDE,
            }),
            invalidatesTags: ['GastosDE'],
        }),
        updateGastosDE: builder.mutation<GastosDE, Partial<GastosDE> & { gastosDEId: string }>({
            query: ({ gastosDEId, ...patch }) => ({
                url: `/gastosDE/${gastosDEId}`,
                method: 'PATCH',
                body: patch,
            }),
            invalidatesTags: (result, error, { gastosDEId }) => [{ type: "GastosDE", gastosDEId }],
        }),
        deleteGastosDE: builder.mutation<{ success: boolean; id: string }, string | null>({
            query: (gastosDEId) => ({
                url: `/gastosDE/${gastosDEId}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['GastosDE'],
        }),
    })
})

export const {
    useGetGastosDEQuery,
    useGetGastoDEQuery,
    useAddGastosDEMutation,
    useUpdateGastosDEMutation,
    useDeleteGastosDEMutation
} = gastosDEApi
