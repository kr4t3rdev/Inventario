import { apiSlice } from "./apiSlice";
import { OrdenReparacion, EstadoOrden, ComplejidadReparacion, FacturarOrdenResponse } from "../../../app/models/model";

export interface CreateOrdenRequest {
  clienteId: string
  equipoTipoId: string
  marca: string
  modelo?: string
  numeroSerie?: string
  contrasena?: string
  accesorios?: string
  problemaReportado: string
  prioridad?: string
  esGarantia?: boolean
  tecnicoId?: string
  fotos?: string[]
  equipos?: {
    equipoTipoId: string
    marca: string
    modelo?: string
    numeroSerie?: string
    contrasena?: string
    accesorios?: string
    problemaReportado: string
    fotos?: string[]
  }[]
}

export interface UpdateOrdenRequest {
  id: string
  estado?: EstadoOrden
  diagnosticoTecnico?: string
  fechaEstimada?: string
  fechaEntrega?: string
  tecnicoId?: string
  descuento?: number
  esGarantia?: boolean
  complejidad?: ComplejidadReparacion | null
  fotos?: string[]
  items?: {
    ordenEquipoId?: string | null
    piezaId?: string | null
    defectacionId?: string | null
    precio: number
    observaciones?: string
  }[]
  materiales?: {
    productoId: string
    cantidad: number
    precioUnitario: number
    total: number
  }[]
}

export interface TecnicoStats {
  id: string
  nombre: string
  cargo: string
  totalOrdenes: number
  ordenesCompletadas: number
  tasaCompletado: number
  totalGenerado: number
  manoDeObraGenerada: number
  comisionEstimada: number
}

export const OrdenesReparacionApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getTecnicosStats: builder.query<TecnicoStats[], { startDate?: string; endDate?: string } | void>({
            query: (params) => {
                const searchParams = new URLSearchParams();
                if (params?.startDate) searchParams.append("startDate", params.startDate);
                if (params?.endDate) searchParams.append("endDate", params.endDate);
                return `servicios/reparaciones/tecnicos/stats?${searchParams.toString()}`;
            },
            providesTags: ['OrdenesReparacion']
        }),
        getOrdenes: builder.query<OrdenReparacion[], { estado?: string; search?: string } | void>({
            query: (params) => {
                const searchParams = new URLSearchParams();
                if (params?.estado) searchParams.append("estado", params.estado);
                if (params?.search) searchParams.append("search", params.search);
                return `reparaciones/ordenes?${searchParams.toString()}`;
            },
            providesTags: ['OrdenesReparacion']
        }),
        getOrden: builder.query<OrdenReparacion, string>({
            query: (id) => `reparaciones/ordenes/${id}`,
            providesTags: (result, error, id) => [{ type: "OrdenesReparacion", id }],
        }),
        createOrden: builder.mutation<OrdenReparacion, CreateOrdenRequest>({
            query: (data) => ({
                url: 'reparaciones/ordenes',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['OrdenesReparacion'],
        }),
        updateOrden: builder.mutation<OrdenReparacion, UpdateOrdenRequest>({
            query: ({ id, ...patch }) => ({
                url: `reparaciones/ordenes/${id}`,
                method: 'PUT',
                body: patch,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: "OrdenesReparacion", id }, 
                'OrdenesReparacion'
            ],
        }),
        facturarOrden: builder.mutation<FacturarOrdenResponse, {
            id: string,
            puntoDeVentaId?: string,
            tipoTarjeta?: string,
            fechaVencimiento?: string,
            seriePrefijo?: string,
            cargoTransporte?: number,
            cuentaBancariaId?: string,
            metodoPago?: string,
            terminosPago?: string,
            tipoVencimiento?: string,
            tasaCambio?: number,
            moneda?: string
        }>({
            query: ({ id, ...body }) => ({
                url: `servicios/reparaciones/ordenes/${id}/facturar`,
                method: 'POST',
                body: body,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: "OrdenesReparacion", id }, 
                'OrdenesReparacion',
                'Configuracion'
            ],
        }),
        deleteOrden: builder.mutation<{ message: string }, string>({
            query: (id) => ({
                url: `reparaciones/ordenes/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['OrdenesReparacion'],
        }),
    })
})

export const {
    useGetOrdenesQuery,
    useGetOrdenQuery,
    useCreateOrdenMutation,
    useUpdateOrdenMutation,
    useDeleteOrdenMutation,
    useGetTecnicosStatsQuery,
    useFacturarOrdenMutation
} = OrdenesReparacionApi
