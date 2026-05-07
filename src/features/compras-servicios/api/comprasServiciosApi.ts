import { CompraServicio } from '@/app/models/model'

import { apiSlice } from '@/lib/redux/services/apiSlice'

type EstadoCompraServicio = 'PENDIENTE' | 'PAGADA'
type FormaPagoCompraServicio = 'PAGO_PARCIAL' | 'PAGO_COMPLETO' | 'ANTICIPO_PAGO'

interface AnticipoAllocation {
  anticipoId: string
  montoAplicado: number
}

interface CreateCompraServicioRequest {
  servicioId: string
  proveedorId?: string | null
  numeroFactura?: string | null
  costoUnitario: number
  cantidad: number
  formaPago: FormaPagoCompraServicio
  estado: EstadoCompraServicio
  descripcion?: string | null
  fechaServicio?: string | null
  fechaVencimiento?: string | null
  anticipos?: AnticipoAllocation[]
}

export const comprasServiciosApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getComprasServicios: builder.query<CompraServicio[], void>({
      query: () => '/compras-servicios',
      providesTags: ['Servicios'],
    }),
    createCompraServicio: builder.mutation<CompraServicio, CreateCompraServicioRequest>({
      query: (payload) => ({
        url: '/compras-servicios',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['Servicios', 'Dashboard'],
    }),
    updateCompraServicio: builder.mutation<
      CompraServicio,
      { id: string; data: Partial<CreateCompraServicioRequest> }
    >({
      query: ({ id, data }) => ({
        url: `/compras-servicios/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Servicios', 'Dashboard'],
    }),
    deleteCompraServicio: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/compras-servicios/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Servicios', 'Dashboard'],
    }),
  }),
})

export const {
  useGetComprasServiciosQuery,
  useCreateCompraServicioMutation,
  useUpdateCompraServicioMutation,
  useDeleteCompraServicioMutation,
} = comprasServiciosApi
