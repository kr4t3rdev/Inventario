'use server'

import { revalidatePath } from 'next/cache'
import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import {
  requireTenant,
  requireFeature,
  requireManagerRole,
} from '@/lib/services/tenant-scope'
import { recordCostChange, CostChangeReason } from '@/lib/cost-history-utils'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import {
  calcularCPP,
  calcularCostoMateriales,
  calcularMargen,
  normalizarMoneda,
  calcularVariacion,
  type CompraInput,
  type IngredienteInput,
} from './lib/cost-calculator'
import { lookupFromCache, precargarTasas } from './lib/exchange-lookup'

// ─── Tipos de retorno ────────────────────────────────────

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

const VENTANA_MESES = 12

// ─── Server Action principal ─────────────────────────────

/**
 * @description Devuelve la ficha de costo consolidada del producto dentro
 *   del tenant activo. Para productos simples calcula el Costo Promedio
 *   Ponderado (CPP) a partir de las compras de los últimos 12 meses. Para
 *   productos compuestos devuelve el costo de materiales de la receta
 *   asociada (sin mano de obra ni indirectos, que son inputs manuales en UI).
 */
export const getFichaCostoAction = withAction(
  async (productoId: string, user: AuthenticatedUser): Promise<FichaCostoData> => {
    const tenantId = requireTenant(user)
    requireFeature(user, 'productos', 'ver la ficha de costo')

    const producto = await prisma.producto.findFirst({
      where: { id: productoId, tenantId },
      select: {
        id: true,
        nombre: true,
        codigoInterno: true,
        esCompuesto: true,
        precioCosto: true,
        precioVenta: true,
      },
    })

    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const advertencias: string[] = []
    let costoCalculado: FichaCostoCalculado

    if (producto.esCompuesto) {
      costoCalculado = await calcularCostoCompuesto(productoId, tenantId, advertencias)
    } else {
      costoCalculado = await calcularCostoSimple(productoId, tenantId, advertencias)
    }

    const margen = calcularMargen(costoCalculado.valor, producto.precioVenta)
    const fichaMargen: FichaCostoMargen = {
      absoluto: margen.absoluto,
      porcentaje: margen.porcentaje,
      estado: margen.estado,
    }

    // Costo estándar = precioCosto cargado en el producto. Variación
    // mide la diferencia entre el CPP real y ese estándar.
    const variacionCalc = calcularVariacion(costoCalculado.valor, producto.precioCosto)
    const fichaVariacion: FichaCostoVariacion = {
      absoluto: variacionCalc.absoluto,
      porcentaje: variacionCalc.porcentaje,
      estado: variacionCalc.estado,
    }

    // Mermas registradas en los últimos 30 días
    const hace30Dias = new Date()
    hace30Dias.setDate(hace30Dias.getDate() - 30)
    const mermasAgg = await prisma.merma.aggregate({
      where: {
        productoId,
        tenantId,
        createdAt: { gte: hace30Dias },
      },
      _sum: { cantidad: true },
    })
    const cantidadMerma = mermasAgg._sum?.cantidad ?? 0

    // Desperdicio esperado promedio de la receta
    let desperdicioEsperadoPromedio: number | null = null
    if (producto.esCompuesto) {
      const receta = await prisma.receta.findFirst({
        where: { productoId, tenantId },
        include: { RecetaIngrediente: true },
      })
      if (receta && receta.RecetaIngrediente.length > 0) {
        const suma = receta.RecetaIngrediente.reduce(
          (s, i) => s + (i.desperdicio ?? 0),
          0,
        )
        desperdicioEsperadoPromedio = suma / receta.RecetaIngrediente.length
      }
    }

    const stockActual = await prisma.producto.findFirst({
      where: { id: productoId, tenantId },
      select: { stock: true },
    })
    const porcentajeSobreStock =
      stockActual && stockActual.stock > 0
        ? (cantidadMerma / stockActual.stock) * 100
        : null

    const fichaMerma: FichaCostoMerma = {
      cantidad30d: cantidadMerma,
      porcentajeSobreStock,
      desperdicioEsperadoPromedio,
    }

    // Alerta por margen bajo o pérdida: agregar al listado de advertencias.
    if (margen.estado === 'BAJO') {
      advertencias.push(
        `Margen bajo: ${margen.porcentaje?.toFixed(1)}% — considerar subir precio de venta o reducir costo`,
      )
    } else if (margen.estado === 'PERDIDA') {
      advertencias.push(
        `Margen negativo (${margen.porcentaje?.toFixed(1)}%): se vende a pérdida — revisar urgente`,
      )
    }

    return {
      producto: {
        id: producto.id,
        nombre: producto.nombre,
        codigoInterno: producto.codigoInterno,
        tipo: producto.esCompuesto ? 'COMPUESTO' : 'SIMPLE',
        precioCosto: producto.precioCosto,
        precioVenta: producto.precioVenta,
      },
      costoCalculado,
      margen: fichaMargen,
      variacion: fichaVariacion,
      merma: fichaMerma,
      advertencias,
      ultimaActualizacion: new Date().toISOString(),
    }
  },
)

// ─── Historial de compras ────────────────────────────────

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

const HISTORIAL_DEFAULT_LIMIT = 20

/**
 * @description Devuelve el historial paginado de líneas de compra del producto
 *   con su proveedor, número de factura, fecha, cantidad y precios.
 *   Filtros opcionales por rango de fechas y proveedor. Límite por defecto: 20.
 */
export const getHistorialCostosAction = withAction(
  async (
    input: GetHistorialCostosInput,
    user: AuthenticatedUser,
  ): Promise<HistorialCostosData> => {
    const tenantId = requireTenant(user)
    requireFeature(user, 'productos', 'ver el historial de costos')

    const producto = await prisma.producto.findFirst({
      where: { id: input.productoId, tenantId },
      select: { id: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const page = input.page && input.page > 0 ? input.page : 1
    const limit =
      input.limit && input.limit > 0 && input.limit <= 100 ? input.limit : HISTORIAL_DEFAULT_LIMIT
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      productoId: input.productoId,
      tenantId,
    }
    const docWhere: Record<string, unknown> = { deletedAt: null }
    if (input.fechaDesde) {
      docWhere.fechaCompra = { ...((docWhere.fechaCompra as object) ?? {}), gte: new Date(input.fechaDesde) }
    }
    if (input.fechaHasta) {
      docWhere.fechaCompra = { ...((docWhere.fechaCompra as object) ?? {}), lte: new Date(input.fechaHasta) }
    }
    if (input.proveedorId) {
      docWhere.proveedorId = input.proveedorId
    }
    if (Object.keys(docWhere).length > 0) {
      where.compraDocumento = docWhere
    }

    const [items, total] = await Promise.all([
      prisma.compraDocumentoItem.findMany({
        where,
        orderBy: { compraDocumento: { fechaCompra: 'desc' } },
        skip,
        take: limit,
        select: {
          compraDocumentoItemId: true,
          cantidad: true,
          precioUnitario: true,
          totalLinea: true,
          compraDocumento: {
            select: {
              fechaCompra: true,
              numeroFactura: true,
              proveedorId: true,
              proveedor: { select: { nombre: true } },
            },
          },
        },
      }),
      prisma.compraDocumentoItem.count({ where }),
    ])

    return {
      items: items.map((it) => ({
        compraDocumentoItemId: it.compraDocumentoItemId,
        fecha: it.compraDocumento.fechaCompra.toISOString(),
        numeroFactura: it.compraDocumento.numeroFactura || '',
        proveedor: it.compraDocumento.proveedor.nombre,
        proveedorId: it.compraDocumento.proveedorId,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        totalLinea: it.totalLinea,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    }
  },
)

// ─── Composición con MO/Indirectos ────────────────────────

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

/**
 * @description Recalcula la composición de un producto compuesto sumando
 *   el costo de materiales (CPP de cada ingrediente × cantidad) más los
 *   valores manuales de mano de obra e indirectos. Los valores manuales
 *   no se persisten; la UI los envía en cada cálculo.
 */
export const getComposicionCostoAction = withAction(
  async (
    input: GetComposicionCostoInput,
    user: AuthenticatedUser,
  ): Promise<ComposicionCostoData> => {
    const tenantId = requireTenant(user)
    requireFeature(user, 'productos', 'ver la composición de costo')

    const producto = await prisma.producto.findFirst({
      where: { id: input.productoId, tenantId },
      select: { id: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const manoObra = normalizarMontoManual(input.manoObra)
    const indirectos = normalizarMontoManual(input.indirectos)

    const receta = await prisma.receta.findFirst({
      where: { productoId: input.productoId, tenantId },
      include: {
        RecetaIngrediente: {
          include: { Producto: { select: { id: true, nombre: true } } },
        },
      },
    })

    const detalle: ComposicionMaterial[] = []
    let materiales = 0
    let ingredientesSinCosto = 0

    if (receta) {
      for (const ing of receta.RecetaIngrediente) {
        const { cpp, advertencias } = await calcularCostoSimpleInterno(
          ing.productoId,
          tenantId,
        )
        if (cpp === 0) ingredientesSinCosto += 1
        const factorDesp = 1 + (ing.desperdicio ?? 0) / 100
        const cantidadEfectiva = ing.cantidad * factorDesp
        const costoTotal = cpp * cantidadEfectiva
        materiales += costoTotal
        detalle.push({
          productoId: ing.productoId,
          nombre: ing.Producto.nombre,
          cantidad: ing.cantidad,
          desperdicio: ing.desperdicio,
          cpp,
          costoTotal,
          sinCosto: cpp === 0,
        })
        // Las advertencias del cálculo interno se ignoran en este endpoint
        // para no contaminar la respuesta; ya se reportan en la ficha.
        void advertencias
      }
    }

    const total = materiales + manoObra + indirectos
    const totalPos = total > 0 ? total : 1
    return {
      materiales,
      manoObra,
      indirectos,
      total,
      ingredientesSinCosto,
      detalle,
      porcentajes: {
        materiales: round2((materiales / totalPos) * 100),
        manoObra: round2((manoObra / totalPos) * 100),
        indirectos: round2((indirectos / totalPos) * 100),
      },
    }
  },
)

function normalizarMontoManual(value: number | undefined): number {
  if (value === undefined || value === null) return 0
  if (!Number.isFinite(value) || value < 0) {
    throw new ActionError('manoObra/indirectos deben ser números >= 0', 'VALIDATION_ERROR')
  }
  return value
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Listar productos para ficha ─────────────────────────

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

/**
 * @description Devuelve la lista de productos del tenant con un resumen
 *   mínimo (id, nombre, código, precios, tipo) para alimentar el
 *   selector de la página principal de Ficha de Costo.
 */
export const listarProductosParaFichaAction = withAction(
  async (
    input: ListarProductosParaFichaInput,
    user: AuthenticatedUser,
  ): Promise<ProductoFichaListItem[]> => {
    const tenantId = requireTenant(user)
    requireFeature(user, 'productos', 'ver la ficha de costo')

    const where: Record<string, unknown> = { tenantId }
    if (input.search && input.search.trim()) {
      const s = input.search.trim()
      where.OR = [
        { nombre: { contains: s, mode: 'insensitive' } },
        { codigoInterno: { contains: s, mode: 'insensitive' } },
        { codigoNegocio: { contains: s, mode: 'insensitive' } },
      ]
    }

    const productos = await prisma.producto.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        codigoInterno: true,
        precioCosto: true,
        precioVenta: true,
        esCompuesto: true,
      },
      orderBy: { nombre: 'asc' },
      take: input.limit ?? 500,
    })

    return productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      codigoInterno: p.codigoInterno,
      precioCosto: p.precioCosto,
      precioVenta: p.precioVenta,
      tipo: p.esCompuesto ? 'COMPUESTO' : 'SIMPLE',
    }))
  },
)

// ─── Actualizar precio de costo ───────────────────────────

export interface UpdatePrecioCostoInput {
  productoId: string
  precioCosto: number
  notes?: string
}

export interface UpdatePrecioCostoResult {
  id: string
  precioCosto: number
}

/**
 * @description Actualiza el `precioCosto` de un producto dentro del tenant
 *   activo. Requiere rol de manager. Registra el cambio en
 *   `ProductoCostHistory` para auditoría.
 */
export const updatePrecioCostoAction = withAction(
  async (
    input: UpdatePrecioCostoInput,
    user: AuthenticatedUser,
  ): Promise<UpdatePrecioCostoResult> => {
    const tenantId = requireTenant(user)
    requireManagerRole(user, 'editar el precio de costo')
    requireFeature(user, 'productos', 'editar el precio de costo')

    if (!Number.isFinite(input.precioCosto) || input.precioCosto < 0) {
      throw new ActionError('El precio de costo debe ser un número >= 0', 'VALIDATION_ERROR')
    }

    const producto = await prisma.producto.findFirst({
      where: { id: input.productoId, tenantId },
      select: { id: true, precioCosto: true, precioVenta: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const actualizado = await prisma.producto.update({
      where: { id: input.productoId },
      data: { precioCosto: input.precioCosto },
      select: { id: true, precioCosto: true },
    })

    if (producto.precioCosto !== input.precioCosto) {
      try {
        await recordCostChange(prisma, {
          productoId: producto.id,
          oldPrecioCosto: producto.precioCosto,
          newPrecioCosto: input.precioCosto,
          oldPrecioVenta: producto.precioVenta,
          newPrecioVenta: producto.precioVenta,
          reason: CostChangeReason.MANUAL_EDIT,
          changedBy: user.userId || 'system',
          notes: input.notes ?? 'Edición manual desde ficha de costo',
        })
      } catch (err) {
        console.error('Error registrando cost history (no bloqueante):', err)
      }
    }

    revalidatePath(`/busy/ficha-costo/${input.productoId}`)
    revalidatePath('/busy/ficha-costo')

    return actualizado
  },
)

// ─── Listas de precios del producto ──────────────────────

export interface PrecioEnListaResult {
  lista: { id: string; nombre: string }
  precio: number
}

export interface GetListasPreciosProductoInput {
  productoId: string
}

/**
 * @description Devuelve los precios del producto en cada lista de precios
 *   del tenant. Útil para mostrar en la ficha de costo.
 */
export const getListasPreciosProductoAction = withAction(
  async (
    input: GetListasPreciosProductoInput,
    user: AuthenticatedUser,
  ): Promise<PrecioEnListaResult[]> => {
    const tenantId = requireTenant(user)
    requireFeature(user, 'productos', 'ver listas de precios')

    const producto = await prisma.producto.findFirst({
      where: { id: input.productoId, tenantId },
      select: { id: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const precios = await prisma.precioProducto.findMany({
      where: { productoId: input.productoId, listaPrecio: { tenantId } },
      select: {
        precio: true,
        listaPrecio: { select: { id: true, nombre: true } },
      },
      orderBy: { listaPrecio: { nombre: 'asc' } },
    })

    return precios.map((p) => ({
      lista: p.listaPrecio,
      precio: p.precio,
    }))
  },
)

// ─── Helpers internos ────────────────────────────────────

/**
 * @description Calcula CPP de un producto en los últimos 12 meses sin
 *   devolver advertencias. Usado para composición y como sub-cálculo
 *   dentro del cálculo de costo simple. Mantiene una firma simple para
 *   que las Server Actions no se acoplen al manejo de advertencias.
 */
async function calcularCostoSimpleInterno(
  productoId: string,
  tenantId: string,
): Promise<{ cpp: number; advertencias: string[] }> {
  const advertencias: string[] = []
  const hace12Meses = new Date()
  hace12Meses.setMonth(hace12Meses.getMonth() - VENTANA_MESES)

  const compras = await prisma.compraDocumentoItem.findMany({
    where: {
      productoId,
      tenantId,
      compraDocumento: {
        fechaCompra: { gte: hace12Meses },
        deletedAt: null,
      },
    },
    select: {
      compraDocumentoId: true,
      cantidad: true,
      precioUnitario: true,
      compraDocumento: { select: { gastoCompraId: true, fechaCompra: true } },
    },
  })

  if (compras.length === 0) {
    return { cpp: 0, advertencias }
  }

  // Determinar la moneda base del tenant (CUP por defecto).
  const monedaBase = await obtenerMonedaBaseTenant(tenantId)

  // Precargar tasas para todas las monedas distintas a la base que
  // aparezcan en las compras. Como el schema actual no expone `moneda`
  // en CompraDocumento, asumimos CUP por línea y este precargado queda
  // listo para cuando se agregue el campo.
  const monedas = ['USD'] // placeholder: cuando exista el campo, leer de cada línea
  const cache = await precargarTasas(monedas, monedaBase)
  const lookup = lookupFromCache(cache)

  const gastoIds = Array.from(
    new Set(
      compras
        .map((c) => c.compraDocumento?.gastoCompraId)
        .filter((id): id is string => Boolean(id)),
    ),
  )

  const gastos = gastoIds.length
    ? await prisma.gastoCompra.findMany({
        where: { tenantId, gastoCompraId: { in: gastoIds } },
        select: { gastoCompraId: true, total: true, cantidad: true },
      })
    : []

  const gastoTotalPorDoc = new Map<string, number>()
  for (const c of compras) {
    const docId = c.compraDocumentoId
    const gastoId = c.compraDocumento?.gastoCompraId
    if (!docId || !gastoId) continue
    if (gastoTotalPorDoc.has(docId)) continue
    const g = gastos.find((x) => x.gastoCompraId === gastoId)
    if (!g || !g.cantidad) continue
    gastoTotalPorDoc.set(docId, g.total)
  }

  const totalCantidad = compras.reduce((s, c) => s + c.cantidad, 0)
  const comprasInput: CompraInput[] = compras.map((c) => {
    // Asumimos CUP por línea hasta que el schema agregue `moneda`.
    const monedaLinea = 'CUP'
    const normalizado = normalizarMoneda(
      c.precioUnitario,
      monedaLinea,
      monedaBase,
      lookup,
      c.compraDocumento?.fechaCompra ?? new Date(),
    )
    if (normalizado.nota === 'TASA_APROXIMADA') {
      advertencias.push(
        `Tasa de cambio aproximada aplicada a compra ${c.compraDocumentoId ?? ''}`.trim(),
      )
    }
    if (normalizado.nota === 'SIN_TASA') {
      advertencias.push(
        `Sin tasa de cambio para la compra ${c.compraDocumentoId ?? ''}; se usa el precio original`.trim(),
      )
    }
    const gastoDoc = c.compraDocumentoId ? (gastoTotalPorDoc.get(c.compraDocumentoId) ?? 0) : 0
    const gastoProp = totalCantidad > 0 ? (gastoDoc * c.cantidad) / totalCantidad : 0
    return {
      cantidad: c.cantidad,
      precioUnitario: normalizado.valor ?? c.precioUnitario,
      gastoProporcional: gastoProp,
    }
  })

  return { cpp: calcularCPP(comprasInput), advertencias }
}

async function obtenerMonedaBaseTenant(tenantId: string): Promise<string> {
  // Por ahora: CUP es la moneda principal histórica del sistema.
  // Cuando el modelo MiEmpresa o Tenant expongan la moneda base, leerla
  // desde ahí. Mantenemos el helper para no acoplar las actions.
  void tenantId
  return 'CUP'
}

async function calcularCostoSimple(
  productoId: string,
  tenantId: string,
  advertencias: string[],
): Promise<FichaCostoCalculado> {
  const { cpp, advertencias: adv } = await calcularCostoSimpleInterno(productoId, tenantId)
  for (const a of adv) advertencias.push(a)
  if (cpp === 0) {
    advertencias.push('No hay compras registradas en los últimos 12 meses')
  }
  return { valor: cpp, metodo: 'CPP', moneda: 'CUP' }
}

async function calcularCostoCompuesto(
  productoId: string,
  tenantId: string,
  advertencias: string[],
): Promise<FichaCostoCalculado> {
  const receta = await prisma.receta.findFirst({
    where: { productoId, tenantId },
    include: {
      RecetaIngrediente: {
        include: { Producto: { select: { id: true, nombre: true } } },
      },
    },
  })

  if (!receta) {
    advertencias.push('Producto compuesto sin receta definida')
    return { valor: 0, metodo: 'COMPOSICION', moneda: 'CUP' }
  }

  const ingredientesInfo = await Promise.all(
    receta.RecetaIngrediente.map(async (ing) => {
      const cpp = await calcularCostoSimple(ing.productoId, tenantId, advertencias)
      return {
        productoId: ing.productoId,
        cantidad: ing.cantidad,
        desperdicio: ing.desperdicio,
        cppIngrediente: cpp.valor > 0 ? cpp.valor : null,
      } satisfies IngredienteInput
    }),
  )

  const resultado = calcularCostoMateriales(ingredientesInfo)
  if (resultado.ingredientesSinCosto > 0) {
    advertencias.push(`${resultado.ingredientesSinCosto} ingrediente(s) sin costo calculado`)
  }

  return {
    valor: resultado.total,
    metodo: 'COMPOSICION',
    moneda: 'CUP',
  }
}
