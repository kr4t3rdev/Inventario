import { apiSlice } from "./apiSlice";
import { Servicios } from "../../../app/models/model";

export const ServicioApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getServicios: builder.query<Servicios[], void>({
            query: () => '/servicios',
            providesTags: ['Servicios']
        }),
        getServicio: builder.query<Servicios, string>({
            query: (id) => `/servicios/${id}`,
            providesTags: (result, error, id) => [{ type: "Servicios", id }],
        }),
        addServicios: builder.mutation<Servicios, Omit<Servicios, "id" | "createdAt" | "updatedAt">>({
            query: (Servicios) => ({
                url: '/servicios',
                method: 'POST',
                body: Servicios,
            }),
            invalidatesTags: ['Servicios'],
        }),
        updateServicios: builder.mutation<Servicios, Partial<Servicios> & { servicioId: string }>({
            query: ({ servicioId, ...patch }) => ({
                url: `/servicios/${servicioId}`,
                method: 'PATCH',
                body: patch,
            }),
            invalidatesTags: (result, error, { servicioId }) => [{ type: "Servicios", servicioId }],
        }),
        deleteServicios: builder.mutation<{ success: boolean; id: string }, string | null>({
            query: (servicioId) => ({
                url: `/servicios/${servicioId}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Servicios'],
        }),
    })
})

export const {
    useGetServicioQuery,
    useAddServiciosMutation,
    useGetServiciosQuery,
    useDeleteServiciosMutation,
    useUpdateServiciosMutation
} = ServicioApi
