import { apiSlice } from "@/lib/redux/services/apiSlice";
import type { Empleado } from "@/app/models/model";

export const empleadosApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getEmpleados: builder.query<Empleado[], void>({
            query: () => '/empleados',
            providesTags: ['Empleados']
        }),
        getEmpleado: builder.query<Empleado, string>({
            query: (empleadoId) => `/empleados/${empleadoId}`,
            providesTags: (result, error, empleadoId) => [{ type: "Empleados", empleadoId }],
        }),
        addEmpleado: builder.mutation<Empleado, Omit<Empleado, "empId" | "createdAt" | "updatedAt">>({
            query: (empleado) => ({
                url: '/empleados',
                method: 'POST',
                body: empleado,
            }),
            invalidatesTags: ['Empleados'],
        }),
        updateEmpleado: builder.mutation<Empleado, Partial<Empleado> & { empleadoId: string }>({
            query: ({ empleadoId, ...patch }) => ({
                url: `/empleados/${empleadoId}`,
                method: 'PATCH',
                body: patch,
            }),
            invalidatesTags: (result, error, { empleadoId }) => [{ type: "Empleados", empleadoId }],
        }),
        deleteEmpleado: builder.mutation<{ success: boolean; id: string }, string>({
            query: (empleadoId) => ({
                url: `/empleados/${empleadoId}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Empleados'],
        }),
    })
})

export const {
    useGetEmpleadosQuery,
    useGetEmpleadoQuery,
    useAddEmpleadoMutation,
    useUpdateEmpleadoMutation,
    useDeleteEmpleadoMutation
} = empleadosApi
