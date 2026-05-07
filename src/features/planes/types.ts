export interface Plan {
  planId: string
  nombre: string
  descripcion: string | null
  precio: number
  duracionDias: number
  maxUsuarios: number
  maxAlmacenes: number
  maxProductos: number
  createdAt: Date
  updatedAt: Date
}
