import { apiSlice } from "./apiSlice"
import { Producto, Categoria } from "../../../app/models/model"

export interface ProductoConStockUbicacion {
  id:string
  nombre:string
  descripcion?: string | null
  codigoInterno?: string | null
  fotos?: string[]
  precioCosto:number
  precioVenta:number
  stock: number
  stockMinimo: number
  stockUbicacion: number
  stockTotal: number
  subcategoriaId: string | null
  categoriaId: string
  unidadId?: string | null
  vendorId?: string | null
  subcategoria: {
    catId: string
    nombre: string
    parentId?: string
    parent?: Categoria
    subcategorias?: Categoria[]
  }
  categoria: {
    catId: string
    nombre: string
  }
  unidad?: {
    unidadId: string
    nombre: string
    simbolo: string
  } | null
  vendor?: {
    vendorId: string
    nombre: string
  } | null
}

export const stockUbicacionApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getStockPorUbicacion: builder.query<
      ProductoConStockUbicacion[],
      { ubicacionId: string; tipoUbicacion: "almacen" | "punto_venta"; includeZero?: boolean }
    >({
      query: ({ ubicacionId, tipoUbicacion, includeZero }) => {
        const params = new URLSearchParams({ ubicacionId, tipoUbicacion })
        if (includeZero) {
          params.set("includeZero", "true")
        }
        return `/productos/stock-ubicacion?${params.toString()}`
      },
      providesTags: ["StockUbicacion"],
    }),
  }),
})

export const { useGetStockPorUbicacionQuery } = stockUbicacionApi
