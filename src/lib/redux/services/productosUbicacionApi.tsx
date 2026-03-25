import { apiSlice } from "./apiSlice"

export interface ProductoConStock {
  id: string
  nombre: string
  descripcion: string | null
  precioCosto: number
  precioVenta: number
  precioVentaResuelto: number
  precioFuente: "LISTA" | "BASE"
  listaPrecioIdAplicada: string | null
  stock: number
  stockEnUbicacion: number
  fotos: string[]
  categoriaId: string
  unidadId: string
  vendorId: string
  codigoBarras?: string
  createdAt: string
  updatedAt: string
  categoria?: {
    catId: string
    nombre: string
  }
  unidad?: {
    unidadId: string
    nombre: string
    simbolo: string
  }
  vendor?: {
    vendorId: string
    nombre: string
  }
}

export const productosUbicacionApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProductosPorUbicacion: builder.query<ProductoConStock[], string>({
      query: (ubicacionId) => `/productos/por-ubicacion/${ubicacionId}`,
      providesTags: ["ProductosUbicacion"],
    }),
  }),
})

export const { useGetProductosPorUbicacionQuery } = productosUbicacionApi
