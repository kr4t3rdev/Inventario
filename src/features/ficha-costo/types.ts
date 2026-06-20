/**
 * @description Tipos compartidos del módulo Ficha de Costo. Son puros
 *   (no dependen de Prisma ni de Next.js) para poder reusarlos entre
 *   las Server Actions, los componentes y los tests.
 */

// ─── Tipos de retorno de la ficha principal ───────────────

export type EstadoMargen = 'SALUDABLE' | 'BAJO' | 'PERDIDA' | 'SIN_PRECIO'

export interface FichaCostoProducto {
  id: string
  nombre: string
  codigoInterno: string | null
  tipo: 'SIMPLE' | 'COMPUESTO'
  precioCosto: number
  precioVenta: number
}

export interface FichaCostoComponentes {
  materiales: number | null
  manoObra: number | null
  indirectos: number | null
  porcentajes: {
    materiales: number | null
    manoObra: number | null
    indirectos: number | null
  }
}

export interface FichaCostoCalculado {
  valor: number
  metodo: 'CPP' | 'COMPOSICION' | null
  moneda: string
  componentes?: FichaCostoComponentes
}

export interface FichaCostoMerma {
  /** Cantidad total de mermas en los últimos 30 días. */
  cantidad30d: number
  /** Porcentaje sobre el stock actual (proxy de impacto). */
  porcentajeSobreStock: number | null
  /** Desperdicio promedio esperado según receta (0 si no hay receta). */
  desperdicioEsperadoPromedio: number | null
}

export interface FichaCostoMargen {
  absoluto: number | null
  porcentaje: number | null
  estado: EstadoMargen
}

export type EstadoVariacion = 'OK' | 'MAYOR' | 'MENOR' | 'SIN_DATOS'

export interface FichaCostoVariacion {
  absoluto: number | null
  porcentaje: number | null
  estado: EstadoVariacion
}

export interface FichaCostoData {
  producto: FichaCostoProducto
  costoCalculado: FichaCostoCalculado
  margen: FichaCostoMargen
  variacion: FichaCostoVariacion
  merma: FichaCostoMerma
  advertencias: string[]
  ultimaActualizacion: string
}

// ─── Tipos de composición ─────────────────────────────────

export interface ComposicionMaterial {
  productoId: string
  nombre: string
  cantidad: number
  desperdicio: number
  cpp: number
  costoTotal: number
  sinCosto: boolean
}

export interface ComposicionCostoData {
  materiales: number
  manoObra: number
  indirectos: number
  total: number
  ingredientesSinCosto: number
  detalle: ComposicionMaterial[]
  porcentajes: {
    materiales: number
    manoObra: number
    indirectos: number
  }
}

export interface GetComposicionCostoInput {
  productoId: string
  manoObra?: number
  indirectos?: number
}

// ─── Tipos de historial ───────────────────────────────────

export interface HistorialCostosItem {
  compraDocumentoItemId: string
  fecha: string
  numeroFactura: string
  proveedor: string
  proveedorId: string
  cantidad: number
  precioUnitario: number
  totalLinea: number
}

export interface HistorialCostosPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface HistorialCostosData {
  items: HistorialCostosItem[]
  pagination: HistorialCostosPagination
}

export interface GetHistorialCostosInput {
  productoId: string
  page?: number
  limit?: number
  fechaDesde?: string
  fechaHasta?: string
  proveedorId?: string
}

// ─── Tipos de producto y precios ──────────────────────────

export interface ProductoFichaListItem {
  id: string
  nombre: string
  codigoInterno: string | null
  precioCosto: number
  precioVenta: number
  tipo: 'SIMPLE' | 'COMPUESTO'
}

export interface ListarProductosParaFichaInput {
  search?: string
  limit?: number
}

export interface UpdatePrecioCostoInput {
  productoId: string
  precioCosto: number
  notes?: string
}

export interface UpdatePrecioCostoResult {
  id: string
  precioCosto: number
}

export interface PrecioEnListaResult {
  lista: { id: string; nombre: string }
  precio: number
}

export interface GetListasPreciosProductoInput {
  productoId: string
}
