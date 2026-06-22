/**
 * @description Pure server queries for Dashboard — shared between Server Actions and Server Components.
 * This file has NO 'use server' directive so it can be called directly from RSC.
 * The business logic is extracted here to avoid context/cookie issues when calling
 * Server Actions directly from Server Components.
 */
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, format, subMonths, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

const ULTIMOS_DIAS = 60
const STOCK_BAJO_UMBRAL_POR_DEFECTO = 10

interface VentaItemData {
  productoId: string | null
  cantidad: number
  total: number
  producto: { precioCosto: number; precioVenta: number; nombre: string } | null
}

interface VentaDiariaData {
  id: string
  cantidad: number
  total: number | null
  createdAt: Date
  productoId: string | null
}

interface DiaVentas {
  ingresos: number
  cantidad: number
}

interface VentaLegacyData {
  productoId: string | null
  cantidad: number
}

interface TransferenciaData {
  productoId: string
  cantidad: number
  origenId: string | null
  destinoId: string | null
  puntoDeVentaOrigenId: string | null
  puntoDeVentaDestinoId: string | null
}

interface ProductoData {
  id: string
  nombre: string
  stock: number
  stockMinimo: number
  precioCosto: number | null
  precioVenta?: number | null
  almacenId?: string | null
  puntoDeVentaId?: string | null
  categoria?: { nombre: string } | null
  unidad?: { simbolo: string } | null
}

export interface DashboardStatsQueryFilters {
  ubicacionId?: string | null
  tipoUbicacion?: string | null
}

interface MermaData {
  cantidad: number
  createdAt: Date
  producto: { precioCosto: number | null } | null
}

interface GastoDEData {
  monto: number
  createdAt: Date
}

interface SalarioData {
  salario: number
  bonificaciones: number | null
  horasExtras: number | null
  createdAt: Date
}

interface VentaServicioData {
  total: number
  cantidad: number
  createdAt: Date
}

interface GastoCompraData {
  total: number
  createdAt: Date
}

interface StockUbicacionData {
  productoId: string
  cantidad: number
  producto: {
    id: string
    nombre: string
    precioCosto: number | null
    categoria: { nombre: string } | null
  } | null
}

interface TopProductoData {
  id: string
  nombre: string
  stock: number
  categoria: { nombre: string } | null
}

export interface DashboardStats {
  totalProductos: number
  totalAlmacenes: number
  totalPuntosVenta: number
  totalVentas: number
  totalMermas: number
  totalTransferencias: number
  totalIngresos: number
  totalGastosMermas: number
  totalBeneficio: number
  valorTotalInventario: number
  datosPorMes: Array<Record<string, any>>
  datosPorSemana: Array<Record<string, any>>
  ventasDiarias: Record<string, any>
  productosMasVendidos: Array<Record<string, any>>
  productosStockBajo: Array<Record<string, any>>
  distribucionStock: Array<Record<string, any>>
  transferenciasStats: {
    almacenAAlmacen: number
    almacenAPuntoVenta: number
    puntoVentaAAlmacen: number
    puntoVentaAPuntoVenta: number
  }
}

/**
 * @description Pure query function that fetches all dashboard statistics for a given tenant.
 * Idempotent and side-effect-free. Can be called from Server Components directly.
 * @param {string} tenantId - Tenant ID from authenticated user
 * @returns {Promise<DashboardStats>} Aggregated dashboard statistics
 */
export async function getDashboardStatsQuery(
  tenantId: string,
  filters: DashboardStatsQueryFilters = {},
): Promise<DashboardStats> {
  const { ubicacionId, tipoUbicacion } = filters

  const [
    totalProductos, totalAlmacenes, totalPuntosVenta,
    ventasData, ventaItemsData, ventasLegacyData, ventaServiciosData,
    mermasData, gastosDEData, salariosData,
    transferenciasData, productosDataRaw, gastosCompraData, stockUbicacionesData,
  ]: [
    number, number, number,
    VentaDiariaData[], VentaItemData[], VentaLegacyData[], VentaServicioData[],
    MermaData[], GastoDEData[], SalarioData[],
    TransferenciaData[], ProductoData[], GastoCompraData[], StockUbicacionData[],
  ] = await Promise.all([
    prisma.producto.count({ where: { tenantId } }),
    prisma.almacen.count({ where: { tenantId } }),
    prisma.puntoDeVenta.count({ where: { tenantId } }),
    prisma.venta.findMany({
      where: { ventaPadreId: null, producto: { tenantId } },
      select: { productoId: true, cantidad: true, descuento: true, total: true, createdAt: true },
    }),
    prisma.ventaItem.findMany({
      where: { producto: { tenantId } },
      select: { productoId: true, cantidad: true, total: true, producto: { select: { precioCosto: true, precioVenta: true, nombre: true } } },
    }),
    prisma.venta.findMany({
      where: {
        producto: { tenantId },
        productoId: { not: null },
        ventaPadreId: null,
        items: { none: {} },
      },
      select: { productoId: true, cantidad: true },
    }),
    prisma.ventaServicios.findMany({
      where: { tenantId },
      select: { total: true, cantidad: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.merma.findMany({
      where: { tenantId },
      select: { cantidad: true, producto: { select: { precioCosto: true } } },
    }),
    prisma.gastosDE.findMany({
      where: { tenantId },
      select: { monto: true, createdAt: true },
    }),
    prisma.pagosalario.findMany({
      where: { tenantId },
      select: { salario: true, bonificaciones: true, horasExtras: true, createdAt: true },
    }),
    prisma.transferencia.findMany({
      where: { tenantId },
      select: {
        productoId: true,
        cantidad: true,
        origenId: true,
        destinoId: true,
        puntoDeVentaOrigenId: true,
        puntoDeVentaDestinoId: true,
      },
    }),
    prisma.producto.findMany({
      where: { tenantId },
      select: {
        id: true, nombre: true, stock: true, stockMinimo: true, precioCosto: true,
        almacenId: true,
        puntoDeVentaId: true,
        categoria: { select: { nombre: true } },
        unidad: { select: { simbolo: true } },
      },
    }),
    prisma.gastoCompra.findMany({
      where: { tenantId },
      select: { total: true, createdAt: true },
    }),
    prisma.stockUbicacion.findMany({
      where: { tenantId },
      select: {
        productoId: true,
        cantidad: true,
        producto: {
          select: {
            id: true,
            nombre: true,
            precioCosto: true,
            categoria: { select: { nombre: true } },
          },
        },
      },
    }),
  ])

  const precioCostoPorProducto = productosDataRaw.reduce<Record<string, number>>((acc, producto) => {
    acc[producto.id] = Number(producto.precioCosto || 0)
    return acc
  }, {})

  const precioVentaPorProducto = productosDataRaw.reduce<Record<string, number>>((acc, producto) => {
    acc[producto.id] = Number(producto.precioVenta || 0)
    return acc
  }, {})

  // Calcular totalIngresos incluyendo ventas legacy correctamente
  const totalIngresos =
    // Ingresos de ventas con items (suma de item.total)
    ventaItemsData.reduce((sum, item) => sum + Number(item.total || 0), 0) +
    // Ingresos de ventas legacy (cantidad * precioVenta)
    ventasLegacyData.reduce((sum, venta) => {
      if (!venta.productoId) return sum
      return sum + Number(venta.cantidad || 0) * (precioVentaPorProducto[venta.productoId] || 0)
    }, 0) +
    // Ingresos de servicios
    ventaServiciosData.reduce((sum, servicio) => sum + Number(servicio.total || 0), 0)
  const totalGastosMermas = mermasData.reduce((s: number, m: MermaData) => s + (m.cantidad * (m.producto?.precioCosto ?? 0)), 0)
  const totalGastos = gastosDEData.reduce((s: number, g: GastoDEData) => s + g.monto, 0)
    + salariosData.reduce((s: number, p: SalarioData) => s + p.salario + (p.bonificaciones ?? 0) + (p.horasExtras ?? 0), 0)

  // Agrupar ventas por producto (items + legacy)
  const ventasItemsPorProducto = ventaItemsData.reduce<Record<string, number>>((acc, item) => {
    if (!item.productoId) return acc
    acc[item.productoId] = (acc[item.productoId] || 0) + Number(item.cantidad || 0)
    return acc
  }, {})

  const ventasLegacyPorProducto = ventasLegacyData.reduce<Record<string, number>>((acc, venta) => {
    if (!venta.productoId) return acc
    acc[venta.productoId] = (acc[venta.productoId] || 0) + Number(venta.cantidad || 0)
    return acc
  }, {})

  // Calcular totalCostoVentas incluyendo ventas legacy
  const totalCostoVentas = ventaItemsData.reduce((s: number, i: VentaItemData) => s + i.cantidad * (i.producto?.precioCosto ?? 0), 0)
    + ventasLegacyData.reduce((sum, venta) => {
      if (!venta.productoId) return sum
      return sum + Number(venta.cantidad || 0) * (precioCostoPorProducto[venta.productoId] || 0)
    }, 0)

  const stockPorProducto = stockUbicacionesData.reduce<Record<string, { cantidad: number; producto: NonNullable<StockUbicacionData['producto']> }>>(
    (acc, registro) => {
      if (!registro.producto) return acc

      const producto = registro.producto
      const existing = acc[producto.id] ?? { cantidad: 0, producto }
      existing.cantidad += Number(registro.cantidad || 0)
      acc[producto.id] = existing
      return acc
    },
    {},
  )

  // Calcular valorTotalInventario desde StockUbicacion (fuente de verdad)
  const valorTotalInventario = Object.values(stockPorProducto).reduce((sum, item) => {
    return sum + item.cantidad * Number(item.producto.precioCosto || 0)
  }, 0)

  const totalBeneficio = totalIngresos - totalCostoVentas - totalGastosMermas - totalGastos

  // Productos más vendidos (combinando items + legacy)
  const ventasPorProducto: Record<string, number> = { ...ventasItemsPorProducto }
  Object.entries(ventasLegacyPorProducto).forEach(([productoId, cantidad]) => {
    ventasPorProducto[productoId] = (ventasPorProducto[productoId] || 0) + cantidad
  })

  const ingresosItemsPorProducto = ventaItemsData.reduce<Record<string, number>>((acc, item) => {
    if (!item.productoId) return acc
    acc[item.productoId] = (acc[item.productoId] || 0) + Number(item.total || 0)
    return acc
  }, {})

  const ingresosLegacyPorProducto = ventasLegacyData.reduce<Record<string, number>>((acc, venta) => {
    if (!venta.productoId) return acc
    acc[venta.productoId] = (acc[venta.productoId] || 0) + Number(venta.cantidad || 0) * (precioVentaPorProducto[venta.productoId] || 0)
    return acc
  }, {})

  const productosVentas = Object.entries(ventasPorProducto)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const topProductoIds = productosVentas.map(([productoId]) => productoId)
  const topProductosData = await prisma.producto.findMany({
    where: { tenantId, id: { in: topProductoIds } },
    select: {
      id: true,
      nombre: true,
      stock: true,
      categoria: { select: { nombre: true } },
    },
  }) as TopProductoData[]
  const topProductosMap = new Map(topProductosData.map((producto) => [producto.id, producto]))

  const productosMasVendidos = productosVentas
    .map(([productoId, cantidad]) => {
      const producto = topProductosMap.get(productoId)
      const ingresos = (ingresosItemsPorProducto[productoId] || 0) + (ingresosLegacyPorProducto[productoId] || 0)

      return {
        id: producto?.id || productoId,
        nombre: producto?.nombre || '',
        categoria: producto?.categoria?.nombre || '',
        ventas: cantidad,
        ingresos,
        stock: producto?.stock || 0,
      }
    })
    .filter(Boolean)

  // Productos con stock bajo (agrupados por nombre)
  type GrupoProducto = {
    productos: typeof productosDataRaw
    stockTotal: number
    stockMinimoMin: number
    representante: typeof productosDataRaw[0]
  }

  const productosParaStockBajoWhere = ubicacionId && tipoUbicacion
    ? {
        tenantId,
        ...(tipoUbicacion === 'almacen'
          ? { almacenId: ubicacionId }
          : tipoUbicacion === 'puntoDeVenta' || tipoUbicacion === 'punto_venta'
            ? { puntoDeVentaId: ubicacionId }
            : {}),
      }
    : { tenantId }

  const productosParaStockBajo = await prisma.producto.findMany({
    where: productosParaStockBajoWhere,
    select: {
      id: true,
      nombre: true,
      stock: true,
      stockMinimo: true,
      precioCosto: true,
      precioVenta: true,
      almacenId: true,
      puntoDeVentaId: true,
      categoria: { select: { nombre: true } },
      unidad: { select: { simbolo: true } },
    },
  }) as ProductoData[]

  const productosAgrupados = productosParaStockBajo.reduce<Record<string, GrupoProducto>>((acc, producto) => {
    const key = producto.nombre
    if (!acc[key]) {
      acc[key] = {
        productos: [],
        stockTotal: 0,
        stockMinimoMin: Number.MAX_SAFE_INTEGER,
        representante: producto,
      }
    }
    acc[key].productos.push(producto)
    acc[key].stockTotal += producto.stock
    if (producto.stockMinimo > 0) {
      acc[key].stockMinimoMin = Math.min(acc[key].stockMinimoMin, producto.stockMinimo)
    }
    return acc
  }, {})

  const productosStockBajoArray: Array<typeof productosDataRaw[0] & {
    stockTotal: number
    stockMinimo: number
    diferencia: number
    umbralUsado: number
  }> = []

  Object.values(productosAgrupados).forEach((grupo) => {
    const stockTotal = grupo.stockTotal
    const stockMinimo = grupo.stockMinimoMin === Number.MAX_SAFE_INTEGER ? 0 : grupo.stockMinimoMin
    const umbral = stockMinimo > 0 ? stockMinimo : STOCK_BAJO_UMBRAL_POR_DEFECTO

    if (stockTotal < umbral) {
      productosStockBajoArray.push({
        ...grupo.representante,
        stockTotal,
        stockMinimo,
        diferencia: umbral - stockTotal,
        umbralUsado: umbral,
      })
    }
  })

  productosStockBajoArray.sort((a, b) => a.stockTotal - b.stockTotal)
  productosStockBajoArray.splice(5)

  const productosStockBajo = productosStockBajoArray

  // Datos mensuales
  const datosPorMes = Array.from({ length: 6 }, (_, i) => {
    const mes = subMonths(new Date(), 5 - i)
    const fInicio = startOfDay(new Date(mes.getFullYear(), mes.getMonth(), 1))
    const fFin = endOfDay(new Date(mes.getFullYear(), mes.getMonth() + 1, 0))
    return {
      mes: format(mes, 'MMM', { locale: es }),
      ingresosVentas: ventasData.filter((v: VentaDiariaData) => v.createdAt >= fInicio && v.createdAt <= fFin).reduce((s: number, v: VentaDiariaData) => s + (v.total ?? 0), 0),
      ingresosServicios: ventaServiciosData.filter((v: VentaServicioData) => v.createdAt >= fInicio && v.createdAt <= fFin).reduce((s: number, v: VentaServicioData) => s + (v.total ?? 0), 0),
      gastosMermas: mermasData.filter((m: MermaData) => m.createdAt >= fInicio && m.createdAt <= fFin).reduce((s: number, m: MermaData) => s + (m.cantidad * (m.producto?.precioCosto ?? 0)), 0),
      gastosDeExplotacion: gastosDEData.filter((g: GastoDEData) => g.createdAt >= fInicio && g.createdAt <= fFin).reduce((s: number, g: GastoDEData) => s + g.monto, 0),
      gastosDeExplotacionCantidad: gastosDEData.filter((g: GastoDEData) => g.createdAt >= fInicio && g.createdAt <= fFin).length,
      gastosCompras: gastosCompraData.filter((c: GastoCompraData) => c.createdAt >= fInicio && c.createdAt <= fFin).reduce((s: number, c: GastoCompraData) => s + c.total, 0),
      gastosComprasCantidad: gastosCompraData.filter((c: GastoCompraData) => c.createdAt >= fInicio && c.createdAt <= fFin).length,
      gastosSalarios: salariosData.filter((p: SalarioData) => p.createdAt >= fInicio && p.createdAt <= fFin).reduce((s: number, p: SalarioData) => s + p.salario + (p.bonificaciones ?? 0) + (p.horasExtras ?? 0), 0),
      gastosSalariosCantidad: salariosData.filter((p: SalarioData) => p.createdAt >= fInicio && p.createdAt <= fFin).length,
      ventasCantidad: ventasData.filter((v: VentaDiariaData) => v.createdAt >= fInicio && v.createdAt <= fFin).length,
      ventasServiciosCantidad: ventaServiciosData.filter((v: VentaServicioData) => v.createdAt >= fInicio && v.createdAt <= fFin).length,
      mermasCantidad: mermasData.filter((m: MermaData) => m.createdAt >= fInicio && m.createdAt <= fFin).length,
    }
  })

  const getWeekKey = (date: Date): string => {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = utcDate.getUTCDay() || 7
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
    const weekNum = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)

    return `${utcDate.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`
  }

  const createWeeklyAggregation = <T extends { createdAt: Date }>(
    data: T[],
    valueFields: Record<string, (item: T) => number>,
  ): Record<string, Record<string, number>> => {
    return data.reduce<Record<string, Record<string, number>>>((acc, item) => {
      const semana = getWeekKey(item.createdAt)
      if (!acc[semana]) {
        acc[semana] = {}
      }

      Object.entries(valueFields).forEach(([key, getter]) => {
        acc[semana][key] = (acc[semana][key] || 0) + getter(item)
      })

      return acc
    }, {})
  }

  const ventasAgrupadasPorSemana = createWeeklyAggregation(ventasData, {
    ingresos: (venta) => Number(venta.total || 0),
    cantidad: (venta) => venta.cantidad,
  })

  const serviciosAgrupadosPorSemana = createWeeklyAggregation(ventaServiciosData, {
    ingresos: (servicio) => Number(servicio.total || 0),
    cantidad: (servicio) => servicio.cantidad,
  })

  const mermasAgrupadasPorSemana = createWeeklyAggregation(mermasData, {
    gastos: (merma) => merma.cantidad * Number(merma.producto?.precioCosto || 0),
    cantidad: (merma) => merma.cantidad,
  })

  const gastosDEAgrupadosPorSemana = createWeeklyAggregation(gastosDEData, {
    gastosE: (gasto) => gasto.monto || 0,
    cantidad: () => 0,
  })

  const gastosSalariosAgrupadosPorSemana = createWeeklyAggregation(salariosData, {
    gastos: (salario) => salario.salario + (salario.bonificaciones ?? 0) + (salario.horasExtras ?? 0),
    cantidad: () => 0,
  })

  const gastosComprasAgrupadosPorSemana = createWeeklyAggregation(gastosCompraData, {
    gastos: (compra) => compra.total || 0,
    cantidad: (compra) => compra.cantidad || 0,
  })

  const semanasCompletas = Array.from(new Set([
    ...Object.keys(ventasAgrupadasPorSemana),
    ...Object.keys(serviciosAgrupadosPorSemana),
    ...Object.keys(mermasAgrupadasPorSemana),
    ...Object.keys(gastosDEAgrupadosPorSemana),
    ...Object.keys(gastosSalariosAgrupadosPorSemana),
    ...Object.keys(gastosComprasAgrupadosPorSemana),
  ]))
    .sort()
    .slice(-12)
    .map((semana) => ({
      semana,
      ingresosVentas: ventasAgrupadasPorSemana[semana]?.ingresos || 0,
      ingresosServicios: serviciosAgrupadosPorSemana[semana]?.ingresos || 0,
      gastosMermas: mermasAgrupadasPorSemana[semana]?.gastos || 0,
      gastosDeExplotacion: gastosDEAgrupadosPorSemana[semana]?.gastosE || 0,
      gastosDeExplotacionCantidad: gastosDEAgrupadosPorSemana[semana]?.cantidad || 0,
      gastosCompras: gastosComprasAgrupadosPorSemana[semana]?.gastos || 0,
      gastosComprasCantidad: gastosComprasAgrupadosPorSemana[semana]?.cantidad || 0,
      gastosSalarios: gastosSalariosAgrupadosPorSemana[semana]?.gastos || 0,
      gastosSalariosCantidad: gastosSalariosAgrupadosPorSemana[semana]?.cantidad || 0,
      ventasCantidad: ventasAgrupadasPorSemana[semana]?.cantidad || 0,
      ventasServiciosCantidad: serviciosAgrupadosPorSemana[semana]?.cantidad || 0,
      mermasCantidad: mermasAgrupadasPorSemana[semana]?.cantidad || 0,
    }))

  const ventasDiariasData = [
    ...ventasData.map((venta) => ({
      createdAt: venta.createdAt,
      cantidad: venta.cantidad,
      total: venta.total ?? 0,
    })),
    ...ventaServiciosData.map((servicio) => ({
      createdAt: servicio.createdAt,
      cantidad: servicio.cantidad,
      total: servicio.total,
    })),
  ]

  // Ventas diarias (últimos 30 días)
  const ahora = new Date()
  const hoy = startOfDay(ahora)
  const ayer = startOfDay(subDays(ahora, 1))

  const datosHoy: DiaVentas = { ingresos: 0, cantidad: 0 }
  const datosAyer: DiaVentas = { ingresos: 0, cantidad: 0 }
  const ventasPorDia = new Map<string, DiaVentas>()

  for (const v of ventasDiariasData) {
    const f = startOfDay(v.createdAt).getTime()
    const monto = v.total ?? 0
    if (f === hoy.getTime()) { datosHoy.ingresos += monto; datosHoy.cantidad += v.cantidad }
    if (f === ayer.getTime()) { datosAyer.ingresos += monto; datosAyer.cantidad += v.cantidad }
    for (const dia of Array.from({ length: ULTIMOS_DIAS }, (_, i) => subDays(ahora, i))) {
      if (f === startOfDay(dia).getTime()) {
        const k = format(dia, 'yyyy-MM-dd')
        const d = ventasPorDia.get(k) || { ingresos: 0, cantidad: 0 }
        d.ingresos += monto; d.cantidad += v.cantidad
        ventasPorDia.set(k, d)
      }
    }
  }

  const diasAnalizados = Array.from(ventasPorDia.values())
  const ti = diasAnalizados.reduce((s: number, d: DiaVentas) => s + d.ingresos, 0)
  const tc = diasAnalizados.reduce((s: number, d: DiaVentas) => s + d.cantidad, 0)
  const dc = diasAnalizados.filter((d: DiaVentas) => d.ingresos > 0).length

  const ventasDiarias = {
    ventasHoy: datosHoy.cantidad, ingresosHoy: datosHoy.ingresos,
    ventasAyer: datosAyer.cantidad, ingresosAyer: datosAyer.ingresos,
    promedioVentasDiarias: dc > 0 ? tc / dc : 0,
    promedioIngresosDiarios: dc > 0 ? ti / dc : 0,
    diasConVentas: dc, totalDias: diasAnalizados.length,
    totalIngresosPeriodo: ti, totalCantidadPeriodo: tc,
  }

  const transferenciasStats = {
    almacenAAlmacen: transferenciasData.filter(
      (t: TransferenciaData) => t.origenId && t.destinoId,
    ).length,
    almacenAPuntoVenta: transferenciasData.filter(
      (t: TransferenciaData) => t.origenId && t.puntoDeVentaDestinoId,
    ).length,
    puntoVentaAAlmacen: transferenciasData.filter(
      (t: TransferenciaData) => t.puntoDeVentaOrigenId && t.destinoId,
    ).length,
    puntoVentaAPuntoVenta: transferenciasData.filter(
      (t: TransferenciaData) => t.puntoDeVentaOrigenId && t.puntoDeVentaDestinoId,
    ).length,
  }

  const distribucionStock: { categoria: string; productos: number; stockTotal: number; valorTotal: number }[] = []
  const catMap = new Map<string, { productos: number; stockTotal: number; valorTotal: number }>()
  for (const item of Object.values(stockPorProducto)) {
    const cat = item.producto.categoria?.nombre ?? 'Sin categoría'
    const e = catMap.get(cat) || { productos: 0, stockTotal: 0, valorTotal: 0 }
    e.productos++
    e.stockTotal += item.cantidad
    e.valorTotal += item.cantidad * Number(item.producto.precioCosto || 0)
    catMap.set(cat, e)
  }
  Array.from(catMap.entries()).forEach(([categoria, d]) => distribucionStock.push({ categoria, ...d }))

  return {
    totalProductos, totalAlmacenes, totalPuntosVenta,
    totalVentas: ventasData.length,
    totalMermas: mermasData.length,
    totalTransferencias: transferenciasData.length,
    totalIngresos, totalGastosMermas, totalBeneficio, valorTotalInventario,
    datosPorMes, datosPorSemana: semanasCompletas,
    ventasDiarias, productosMasVendidos, productosStockBajo,
    distribucionStock, transferenciasStats,
  }
}
