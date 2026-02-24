import { apiSlice } from "./apiSlice";
import { Almacen } from "../../../app/models/model";

export const almacenesApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getAlmacenes: builder.query<Almacen[], void>({
            query: () => '/almacenes',
            providesTags: ['Almacenes']
        }),
        getAlmacen: builder.query<Almacen, string>({
            query: (id) => `/almacenes/${id}`,
            providesTags: (result, error, id) => [{ type: "Almacenes", id }],
        }),
        addAlmacen: builder.mutation<Almacen, Omit<Almacen, "almacenId" | "createdAt" | "updatedAt">>({
            query: (almacen) => ({
                url: '/almacenes',
                method: 'POST',
                body: almacen,
            }),
            invalidatesTags: ['Almacenes'],
        }),
        updateAlmacen: builder.mutation<Almacen, Partial<Almacen> & { almacenId: string }>({
            query: ({ almacenId, ...patch }) => ({
                url: `/almacenes/${almacenId}`,
                method: 'PATCH',
                body: patch,
            }),
            invalidatesTags: (result, error, { almacenId }) => [{ type: "Almacenes", almacenId }],
        }),
        deleteAlmacen: builder.mutation<{ success: boolean; id: string }, string>({
            query: (id) => ({
                url: `/almacenes/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Almacenes'],
        }),
    })
})

export const {
    useGetAlmacenesQuery,
    useGetAlmacenQuery,
    useAddAlmacenMutation,
    useUpdateAlmacenMutation,
    useDeleteAlmacenMutation
} = almacenesApi
