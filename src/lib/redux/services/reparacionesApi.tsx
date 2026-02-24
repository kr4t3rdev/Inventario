import { apiSlice } from "./apiSlice";
import { EquipoReparacion, PiezaReparacion, OrdenReparacion, FacturarOrdenResponse, DefectacionCatalogo } from "../../../app/models/model";

export const ReparacionesApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        // ... (existing endpoints)

        // Defectaciones Catalogo
        getDefectaciones: builder.query<DefectacionCatalogo[], void>({
            query: () => '/reparaciones/defectaciones',
            providesTags: ['Defectaciones']
        }),
        addDefectacion: builder.mutation<DefectacionCatalogo, { defecto: string, costo: number }>({
            query: (data) => ({
                url: '/reparaciones/defectaciones',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Defectaciones'],
        }),
        updateDefectacion: builder.mutation<DefectacionCatalogo, { id: string, defecto: string, costo: number }>({
            query: ({ id, ...patch }) => ({
                url: `/reparaciones/defectaciones/${id}`,
                method: 'PUT',
                body: patch,
            }),
            invalidatesTags: ['Defectaciones'],
        }),
        deleteDefectacion: builder.mutation<{ success: boolean; id: string }, string>({
            query: (id) => ({
                url: `/reparaciones/defectaciones/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Defectaciones'],
        }),

        getEquiposReparacion: builder.query<EquipoReparacion[], void>({
            query: () => '/reparaciones/equipos',
            providesTags: ['EquiposReparacion']
        }),
        getEquipoReparacion: builder.query<EquipoReparacion, string>({
            query: (id) => `/reparaciones/equipos/${id}`,
            providesTags: (result, error, id) => [{ type: "EquiposReparacion", id }],
        }),
        addEquipoReparacion: builder.mutation<EquipoReparacion, { nombre: string, descripcion?: string }>({
            query: (data) => ({
                url: '/reparaciones/equipos',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['EquiposReparacion'],
        }),
        updateEquipoReparacion: builder.mutation<EquipoReparacion, { id: string, nombre: string, descripcion?: string }>({
            query: ({ id, ...patch }) => ({
                url: `/reparaciones/equipos/${id}`,
                method: 'PUT',
                body: patch,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: "EquiposReparacion", id }],
        }),
        deleteEquipoReparacion: builder.mutation<{ success: boolean; id: string }, string>({
            query: (id) => ({
                url: `/reparaciones/equipos/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['EquiposReparacion'],
        }),
        
        // Ordenes de Reparacion
        getOrdenesReparacion: builder.query<OrdenReparacion[], void>({
            query: () => '/reparaciones/ordenes',
            providesTags: ['OrdenesReparacion']
        }),
        getOrdenReparacion: builder.query<OrdenReparacion, string>({
            query: (id) => `/reparaciones/ordenes/${id}`,
            providesTags: (result, error, id) => [{ type: "OrdenesReparacion", id }],
        }),
        addOrdenReparacion: builder.mutation<OrdenReparacion, Partial<OrdenReparacion>>({
            query: (data) => ({
                url: '/reparaciones/ordenes',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['OrdenesReparacion'],
        }),
        updateOrdenReparacion: builder.mutation<OrdenReparacion, { id: string, [key: string]: any }>({
            query: ({ id, ...patch }) => ({
                url: `/reparaciones/ordenes/${id}`,
                method: 'PUT',
                body: patch,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: "OrdenesReparacion", id }],
        }),
        deleteOrdenReparacion: builder.mutation<{ success: boolean; id: string }, string>({
            query: (id) => ({
                url: `/reparaciones/ordenes/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['OrdenesReparacion'],
        }),
        // Piezas
        addPiezaReparacion: builder.mutation<PiezaReparacion, Omit<PiezaReparacion, "id" | "createdAt" | "updatedAt" | "equipo">>({
            query: (data) => ({
                url: '/reparaciones/piezas',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['EquiposReparacion'], // Invalidamos equipos para que se refresque la lista con piezas
        }),
        updatePiezaReparacion: builder.mutation<PiezaReparacion, { id: string, nombre: string, costoPequeno: number, costoMediano: number, costoGrande: number }>({
            query: ({ id, ...patch }) => ({
                url: `/reparaciones/piezas/${id}`,
                method: 'PUT',
                body: patch,
            }),
            invalidatesTags: ['EquiposReparacion'],
        }),
        deletePiezaReparacion: builder.mutation<{ success: boolean; id: string }, string>({
            query: (id) => ({
                url: `/reparaciones/piezas/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['EquiposReparacion'],
        }),
    })
})

export const {
    useGetEquiposReparacionQuery,
    useGetEquipoReparacionQuery,
    useAddEquipoReparacionMutation,
    useUpdateEquipoReparacionMutation,
    useDeleteEquipoReparacionMutation,
    useAddPiezaReparacionMutation,
    useUpdatePiezaReparacionMutation,
    useDeletePiezaReparacionMutation,
    useGetDefectacionesQuery,
    useAddDefectacionMutation,
    useUpdateDefectacionMutation,
    useDeleteDefectacionMutation
    ,
    // Ordenes Reparacion
    useGetOrdenesReparacionQuery,
    useGetOrdenReparacionQuery,
    useAddOrdenReparacionMutation,
    useUpdateOrdenReparacionMutation,
    useDeleteOrdenReparacionMutation
} = ReparacionesApi
