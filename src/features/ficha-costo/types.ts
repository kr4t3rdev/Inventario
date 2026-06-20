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

// ─── Tipos de historial reconciliado ──────────────────────

/**
 * @description Línea de compra reconciliada con el cálculo del CPP.
 *   Extiende `HistorialCostosItem` con flags de ventana y gasto asignado.
 */
export interface HistorialReconciliadoItem extends HistorialCostosItem {
  /** True si la fecha cae dentro de la ventana CPP (12 meses). */
  enVentanaCPP: boolean
  /** Gasto proporcional prorrateado del GastoCompra del documento. */
  gastoProporcional: number
  /** True si la conversión de moneda fue aproximada (tasa con desfase). */
  tasaAproximada?: boolean
}

export interface HistorialProveedorResumen {
  proveedorId: string
  proveedorNombre: string
  cantidadTotal: number
  montoTotal: number
  participacionPorcentaje: number
  cantidadItems: number
}

export type EstadoCPP = 'CALCULADO' | 'CON_ADVERTENCIAS' | 'SIN_DATOS'

/**
 * @description Respuesta de `getHistorialReconciliadoAction`. Combina
 *   los items paginados (con flags de ventana y gasto) con el resumen
 *   por proveedor (calculado sobre el set completo en ventana, no la
 *   página actual) y el estado del CPP.
 */
export interface HistorialReconciliadoData {
  items: HistorialReconciliadoItem[]
  pagination: HistorialCostosPagination
  proveedores: HistorialProveedorResumen[]
  estadoCPP: EstadoCPP
  advertencias: string[]
}

export interface GetHistorialReconciliadoInput extends GetHistorialCostosInput {}

// ─── Tipos de trazabilidad FIFO en ventas ─────────────────

/**
 * @description Venta de un producto con trazabilidad FIFO. Incluye el
 *   costo real calculado desde PurchaseAllocation (o fallback a precioCosto
 *   para ventas legacy sin allocations) y el margen real.
 */
export interface VentaProductoItem {
  ventaItemId: string
  ventaId: string
  fecha: string // ISO
  clienteNombre: string
  cantidad: number
  precioUnitario: number
  ingresoTotal: number
  costoReal: number
  margenReal: number // porcentaje
  esLegacy: boolean // true si no tiene allocations FIFO
}

export interface VentasProductoResumen {
  totalVendido: number
  costoTotal: number
  margenPromedio: number // porcentaje
  cantidadVentas: number
}

/**
 * @description Respuesta de `getVentasProductoAction`. Combina las ventas
 *   paginadas con el resumen de rentabilidad calculado sobre todo el
 *   dataset filtrado (no solo la página actual).
 */
export interface VentasProductoData {
  items: VentaProductoItem[]
  pagination: HistorialCostosPagination
  resumen: VentasProductoResumen
}

export interface GetVentasProductoInput {
  productoId: string
  page?: number
  limit?: number
  fechaDesde?: string
  fechaHasta?: string
}
