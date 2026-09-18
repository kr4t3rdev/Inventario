/**
 * @description Tipos compartidos del módulo Ficha de Costo. Son puros
 *   (no dependen de Prisma ni de Next.js) para poder reusarlos entre
 *   las Server Actions, los componentes y los tests.
 */

// ─── Tipos de retorno de la ficha principal ───────────────

export type EstadoMargen = 'SALUDABLE' | 'BAJO' | 'PERDIDA' | 'SIN_PRECIO' | 'SIN_DATOS'
export type CostSheetEntityType = 'PRODUCTO' | 'SERVICIO'
export type FichaCostoEntityKind = 'SIMPLE' | 'COMPUESTO' | 'SERVICIO'

export interface FichaCostoEntityRef {
  entityId: string
  entityType: CostSheetEntityType
}

export interface FichaCostoProducto {
  id: string
  entityType: CostSheetEntityType
  nombre: string
  codigoInterno: string | null
  tipo: FichaCostoEntityKind
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

export type GetFichaCostoInput = string | FichaCostoEntityRef

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
  entityType: CostSheetEntityType
  nombre: string
  codigoInterno: string | null
  precioCosto: number
  precioVenta: number
  tipo: FichaCostoEntityKind
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

// ─── Tipos de plantilla de ficha de costo ─────────────────


// ─── Line items de la ficha de costo ──────────────────────

export type CategoriaCosto = 
  | 'materiales'
  | 'mano-obra'
  | 'indirectos'
  | 'transporte'
  | 'comisiones'
  | 'empaque'
  | 'aduana'
  | 'servicios'
  | 'otros'

export interface LineItem {
  id: string
  concepto: string
  descripcion?: string
  cantidad: number
  costoUnitario: number
  categoria: CategoriaCosto
}

export const CATEGORIAS_COSTO: { value: CategoriaCosto; label: string }[] = [
  { value: 'materiales', label: 'Materiales' },
  { value: 'mano-obra', label: 'Mano de obra' },
  { value: 'indirectos', label: 'Costos indirectos' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'comisiones', label: 'Comisiones' },
  { value: 'empaque', label: 'Empaque' },
  { value: 'aduana', label: 'Aduana' },
  { value: 'servicios', label: 'Servicios contratados' },
  { value: 'otros', label: 'Otros' },
]

export function isCategoriaCosto(value: unknown): value is CategoriaCosto {
  return CATEGORIAS_COSTO.some((category) => category.value === value)
}

export function isValidLineItem(value: unknown): value is LineItem {
  if (!value || typeof value !== 'object') return false

  const item = value as Partial<LineItem>
  return (
    typeof item.id === 'string' &&
    item.id.trim().length > 0 &&
    typeof item.concepto === 'string' &&
    item.concepto.trim().length > 0 &&
    (item.descripcion === undefined || typeof item.descripcion === 'string') &&
    typeof item.cantidad === 'number' &&
    Number.isFinite(item.cantidad) &&
    item.cantidad >= 0 &&
    typeof item.costoUnitario === 'number' &&
    Number.isFinite(item.costoUnitario) &&
    item.costoUnitario >= 0 &&
    isCategoriaCosto(item.categoria)
  )
}

export function sanitizeLineItems(items: unknown[]): LineItem[] {
  return items.filter(isValidLineItem)
}

export function lineItemTotal(item: LineItem): number {
  return item.cantidad * item.costoUnitario
}

export function calcularTotalLineItems(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + lineItemTotal(item), 0)
}

export function calcularTotalesPorCategoria(items: LineItem[]): Record<CategoriaCosto, number> {
  const totals: Record<string, number> = {}
  for (const item of items) {
    totals[item.categoria] = (totals[item.categoria] ?? 0) + lineItemTotal(item)
  }
  return totals as Record<CategoriaCosto, number>
}

export function lineItemsToLegacyFields(items: LineItem[]): { 
  costoMateriales: number
  costoManoObra: number
  costoIndirectos: number 
} {
  const catTotals = calcularTotalesPorCategoria(items)
  // Map flexible categories to legacy fields
  return {
    costoMateriales: (catTotals['materiales'] ?? 0) + (catTotals['empaque'] ?? 0) + (catTotals['aduana'] ?? 0),
    costoManoObra: (catTotals['mano-obra'] ?? 0),
    costoIndirectos: (catTotals['indirectos'] ?? 0) + (catTotals['transporte'] ?? 0) + (catTotals['comisiones'] ?? 0) + (catTotals['servicios'] ?? 0) + (catTotals['otros'] ?? 0),
  }
}

export function legacyFieldsToLineItems(fields: {
  costoMateriales?: number
  costoManoObra?: number
  costoIndirectos?: number
}): LineItem[] {
  const normalized = [
    {
      id: 'legacy-materiales',
      concepto: 'Materiales (legacy)',
      cantidad: 1,
      costoUnitario: fields.costoMateriales ?? 0,
      categoria: 'materiales' as const,
    },
    {
      id: 'legacy-mano-obra',
      concepto: 'Mano de obra (legacy)',
      cantidad: 1,
      costoUnitario: fields.costoManoObra ?? 0,
      categoria: 'mano-obra' as const,
    },
    {
      id: 'legacy-indirectos',
      concepto: 'Costos indirectos (legacy)',
      cantidad: 1,
      costoUnitario: fields.costoIndirectos ?? 0,
      categoria: 'indirectos' as const,
    },
  ]

  return normalized.filter((item) => item.costoUnitario > 0)
}

// Backward compatibility: legacy rows could still have lineItems serialized inside `notas`
export function serializeNotas(lineItems: LineItem[], userNotes?: string): string {
  return JSON.stringify({ _v: 1, lineItems, notas: userNotes || '' })
}

export function parseNotas(notas: string | null): { lineItems: LineItem[]; userNotes: string } {
  if (!notas) return { lineItems: [], userNotes: '' }
  try {
    const parsed = JSON.parse(notas)
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.lineItems)) {
      return {
        lineItems: sanitizeLineItems(parsed.lineItems),
        userNotes: typeof parsed.notas === 'string' ? parsed.notas : '',
      }
    }
  } catch {}
  return { lineItems: [], userNotes: notas }
}
/**
 * @description Plantilla de ficha de costo versionada para un producto.
 *   Solo una versión puede estar activa por producto. Los valores de costo
 *   se almacenan en Float para soportar decimales.
 */
export interface PlantillaCosto {
  id: string
  tenantId: string
  productoId: string
  version: number
  nombre: string
  costoMateriales: number
  costoManoObra: number
  costoIndirectos: number
  margenObjetivo: number
  precioSugerido: number
  esActiva: boolean
  notas: string | null
  createdAt: string
  updatedAt: string
  createdById: string
  /** Line items del documento real o del fallback legacy normalizado */
  lineItems: LineItem[]
  userNotes: string
  /** Total calculado de todos los line items */
  costeTotal: number
}

export interface PlantillaCostoInput {
  productoId: string
  nombre: string
  costoMateriales?: number
  costoManoObra?: number
  costoIndirectos?: number
  margenObjetivo: number
  notas?: string
  lineItems?: LineItem[]
}

export interface UpdatePlantillaInput {
  plantillaId: string
  nombre?: string
  costoMateriales?: number
  costoManoObra?: number
  costoIndirectos?: number
  margenObjetivo?: number
  notas?: string
  lineItems?: LineItem[]
}

export interface ActivarPlantillaInput {
  plantillaId: string
  productoId: string
}

export interface AplicarPrecioSugeridoInput {
  plantillaId: string
  productoId: string
}

export interface PlantillaActivaResult {
  plantilla: PlantillaCosto | null
  costoTotal: number
  precioSugerido: number
  deltaCostoVsActual: number | null
  deltaPrecioVsVenta: number | null
}

export interface ComparacionPlantilla {
  costoPlantilla: number
  costoActual: number
  precioVentaActual: number
  precioSugerido: number
  margenObjetivo: number
  margenActual: number | null
}
