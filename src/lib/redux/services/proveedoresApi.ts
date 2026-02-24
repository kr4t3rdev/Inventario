import { apiSlice } from "./apiSlice";
import { Proveedor } from "../../../app/models/model";

export const proveedoresApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getProveedores: builder.query<Proveedor[], void>({
            query: () => '/vendors',
            providesTags: ['Proveedores']
        }),
        getProveedor: builder.query<Proveedor, string>({
            query: (id) => `/vendors/${id}`,
            providesTags: (result, error, id) => [{ type: "Proveedores", id }],
        }),
        addProveedor: builder.mutation<Proveedor, Omit<Proveedor, "proveedorId" | "createdAt" | "updatedAt">>({
            query: (proveedor) => ({
                url: '/vendors',
                method: 'POST',
                body: proveedor,
            }),
            invalidatesTags: ['Proveedores'],
        }),
        updateProveedor: builder.mutation<Proveedor, Partial<Proveedor> & { proveedorId: string }>({
            query: ({ proveedorId, ...patch }) => ({
                url: `/vendors/${proveedorId}`,
                method: 'PATCH',
                body: patch,
            }),
            invalidatesTags: (result, error, { proveedorId }) => [{ type: "Proveedores", proveedorId }],
        }),
        deleteProveedor: builder.mutation<{ success: boolean; id: string }, string>({
            query: (id) => ({
                url: `/vendors/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Proveedores'],
        }),
    })
})

export const {
    useGetProveedoresQuery,
    useGetProveedorQuery,
    useAddProveedorMutation,
    useUpdateProveedorMutation,
    useDeleteProveedorMutation
} = proveedoresApi
