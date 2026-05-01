import { apiSlice } from './apiSlice'

interface VentaServicio {
  ventaServicioId?: string;
  servicio?: {
    servicioId: string;
    descripcion: string;
    precio: number;
    fechaServicio: Date;
    reconciliada: boolean;
    moneda: string;
  };
  cantidad: number;
  costo: number;
  total: number;
  observaciones?: string;
  cliente?: {
    clienteId: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface AnticipoAllocation {
  anticipoId: string
  montoAplicado: number
}

interface CreateVentaServicioRequest {
  servicioId?: string;
  clienteId?: string;
  cantidad?: number;
  costo?: number;
  total?: number;
  observaciones?: string;
  anticipos?: AnticipoAllocation[];
  lineas?: Array<{
    tipoLinea: 'SERVICIO' | 'PRODUCTO';
    servicioId?: string;
    productoId?: string;
    cantidad: number;
    precioUnitario: number;
    observaciones?: string;
  }>;
}

export const ventaServiciosApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getVentaServicios: builder.query<VentaServicio[], void>({
      query: () => '/venta-servicios',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ ventaServicioId }) => ({
                type: 'VentaServicios' as const,
                id: ventaServicioId
              })),
              { type: 'VentaServicios' as const, id: 'LIST' }
            ]
          : [{ type: 'VentaServicios' as const, id: 'LIST' }]
    }),
    
    getVentaServicioById: builder.query<VentaServicio, string>({
      query: (id) => `/venta-servicios/${id}`,
      providesTags: (result, error, id) => [{ type: 'VentaServicios' as const, id }]
    }),
    
    addVentaServicio: builder.mutation<VentaServicio, CreateVentaServicioRequest>({
      query: (ventaServicio) => ({
        url: '/venta-servicios',
        method: 'POST',
        body: ventaServicio
      }),
      invalidatesTags: [{ type: 'VentaServicios', id: 'LIST' }]
    }),
    
    updateVentaServicio: builder.mutation<VentaServicio, Partial<VentaServicio> & { id: string }>({
      query: ({ id, ...ventaServicio }) => ({
        url: `/api/venta-servicios/${id}`,
        method: 'PUT',
        body: ventaServicio
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'VentaServicios' as const, id },
        { type: 'VentaServicios' as const, id: 'LIST' }
      ]
    }),
    
    deleteVentaServicio: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/api/venta-servicios/${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: [{ type: 'VentaServicios', id: 'LIST' }]
    })
  })
})

export const {
  useGetVentaServiciosQuery,
  useGetVentaServicioByIdQuery,
  useAddVentaServicioMutation,
  useUpdateVentaServicioMutation,
  useDeleteVentaServicioMutation
} = ventaServiciosApi
