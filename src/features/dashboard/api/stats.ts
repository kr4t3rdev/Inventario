import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, format, subMonths, subDays } from "date-fns"
import { es } from "date-fns/locale"
import type { AuthenticatedUser } from "@/lib/auth-middleware"
import type {
  CacheEntry,
  TransferenciaData,
  MermaData,
  GastoDEData,
  SalarioData,
  GastoCompraData,
  ProductoData,
  VentaDiariaData,
  VentaServicioDiariaData,
  DiaVentas,
  VentaPorMesData,
  VentaServicioPorMesData,
  MermaPorMesData,
  GastoDePorMesData,
  GastoSalarioPorMesData,
  GastoCompraPorMesData,
  MonthlyAggregation,
} from "./types"

// ===================== DASHBOARD STATS =====================

const cache = new Map<string, CacheEntry>()
const CACHE_DURATION = 30 * 1000
const DAILY_CACHE_DURATION = 10 * 1000

function invalidateDashboardCache() {
  const keysToDelete = Array.from(cache.keys()).filter((key: string) => key.startsWith("dashboard-stats-"))
  keysToDelete.forEach((key: string) => cache.delete(key))
  console.log("Dashboard cache invalidated")
}

function getDailyDataCacheKey(ubicacionId?: string, tipoUbicacion?: string) {
  return `dashboard-daily-data-${ubicacionId || "all"}-${tipoUbicacion || "all"}`
}

export async function getDashboardStatsHandler(request: NextRequest, _context: any, user: AuthenticatedUser) {
  try {
    // ⚠️ MULTI-TENANT: el dashboard es 100% per-tenant.
    // Toda query DEBE filtrar por tenantId. Sin esto, un usuario ve
    // datos de otros tenants (métricas, ventas, productos, etc.).
    const tenantId = user.tenantId
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant no identificado", code: "TENANT_REQUIRED" },
        { status: 403 },
      )
    }

    const { searchParams } = new URL(request.url)
    const ubicacionId = searchParams.get("ubicacionId")
    const tipoUbicacion = searchParams.get("tipoUbicacion")

    // ⚠️ MULTI-TENANT: el cache key debe incluir tenantId para que
    // dos tenants distintos no compartan resultados cacheados.
    const cacheKey = `dashboard-stats-${tenantId}-${ubicacionId || "all"}-${tipoUbicacion || "all"}`

    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data)
    }

    const [
      totalProductos,
      totalAlmacenes,
      totalPuntosVenta,
      ventasData,
      ventaItemsData,
      ventasLegacyData,
      ventaServiciosData,
      mermasData,
      gastosDEData,
      salariosData,
      transferenciasData,
      productosDataRaw,
    ] = await Promise.all([
      prisma.producto.count({ where: { tenantId } }),
      prisma.almacen.count({ where: { tenantId } }),
      prisma.puntoDeVenta.count({ where: { tenantId } }),
      prisma.venta.findMany({
        where: { tenantId, ventaPadreId: null },
        select: {
          productoId: true,
          cantidad: true,
          descuento: true,
          total: true,
          createdAt: true,
        },
      }),
      prisma.ventaItem.findMany({
        where: { venta: { tenantId } },
        select: {
          productoId: true,
          cantidad: true,
          total: true,
          producto: {
            select: { precioCosto: true, precioVenta: true, nombre: true },
          },
        },
      }),
      prisma.venta.findMany({
        where: {
          tenantId,
          productoId: { not: null },
          ventaPadreId: null,
          items: { none: {} },
        },
        select: { productoId: true, cantidad: true },
      }),
      prisma.ventaServicios.findMany({
        where: { tenantId },
        select: { total: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.merma.findMany({
        where: { tenantId },
        select: {
          cantidad: true,
          producto: {
            select: { precioCosto: true },
          },
        },
      }),
      prisma.gastosDE.findMany({
        where: { tenantId },
        select: { monto: true },
        orderBy: { periodo: "desc" },
      }),
      prisma.pagosalario.findMany({
        where: { tenantId },
        select: { salario: true },
        orderBy: { periodo: "desc" },
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
        select: { id: true, nombre: true, stock: true, precioCosto: true, precioVenta: true },
      }),
    ])

    const ventasItemsPorProducto = ventaItemsData.reduce(
      (acc: Record<string, number>, item: { productoId: string; cantidad: number }) => {
        acc[item.productoId] = (acc[item.productoId] || 0) + Number(item.cantidad || 0)
        return acc
      },
      {},
    )

    const ventasLegacyPorProducto = ventasLegacyData.reduce(
      (acc: Record<string, number>, venta: { productoId: string | null; cantidad: number }) => {
        if (!venta.productoId) return acc
        acc[venta.productoId] = (acc[venta.productoId] || 0) + Number(venta.cantidad || 0)
        return acc
      },
      {},
    )

    const getVentasProductoTotal = (productoId: string) =>
      (ventasItemsPorProducto[productoId] || 0) + (ventasLegacyPorProducto[productoId] || 0)

    const precioCostoPorProducto = productosDataRaw.reduce(
      (acc: Record<string, number>, producto: { id: string; precioCosto: number | null }) => {
        acc[producto.id] = Number(producto.precioCosto || 0)
        return acc
      },
      {},
    )

    const precioVentaPorProducto = productosDataRaw.reduce(
      (acc: Record<string, number>, producto: { id: string; precioVenta: number | null }) => {
        acc[producto.id] = Number(producto.precioVenta || 0)
        return acc
      },
      {},
    )

    const productosData = productosDataRaw.map((producto: ProductoData) => {
      const tEntrada = transferenciasData
        .filter(
          (t: TransferenciaData) => t.productoId === producto.id && t.puntoDeVentaDestinoId !== null,
        )
        .reduce((sum: number, t: TransferenciaData) => sum + t.cantidad, 0)

      const tSalida = transferenciasData
        .filter(
          (t: TransferenciaData) => t.productoId === producto.id && t.puntoDeVentaOrigenId !== null,
        )
        .reduce((sum: number, t: TransferenciaData) => sum + t.cantidad, 0)

      getVentasProductoTotal(producto.id)

      return {
        ...producto,
      }
    })

    const valorTotalInventario = productosDataRaw.reduce(
      (
        sum: number,
        producto: { id: string; stock: number; precioCosto: number | null },
      ) => {
        const tEntrada = transferenciasData
          .filter(
            (t: { productoId: string; puntoDeVentaDestinoId: string | null; cantidad: number }) =>
              t.productoId === producto.id && t.puntoDeVentaDestinoId !== null,
          )
          .reduce((sum: number, t: { cantidad: number }) => sum + t.cantidad, 0)

        const tSalida = transferenciasData
          .filter(
            (t: { productoId: string; puntoDeVentaOrigenId: string | null; cantidad: number }) =>
              t.productoId === producto.id && t.puntoDeVentaOrigenId !== null,
          )
          .reduce((sum: number, t: { cantidad: number }) => sum + t.cantidad, 0)

        const vTotal = getVentasProductoTotal(producto.id)

        const stockTotal = producto.stock + (tEntrada - tSalida - vTotal)
        return sum + Math.max(0, stockTotal) * Number(producto.precioCosto || 0)
      },
      0,
    )

    const totalPrecioC =
      ventaItemsData.reduce(
        (
          sum: number,
          item: {
            cantidad: number
            producto: { precioCosto: number | string | null } | null
          },
        ) => {
          return sum + Number(item.cantidad || 0) * Number(item.producto?.precioCosto || 0)
        },
        0,
      ) +
      ventasLegacyData.reduce(
        (sum: number, venta: { productoId: string | null; cantidad: number }) => {
          if (!venta.productoId) return sum
          return (
            sum + Number(venta.cantidad || 0) * (precioCostoPorProducto[venta.productoId] || 0)
          )
        },
        0,
      )

    const totalIngresos =
      ventasData.reduce(
        (sum: number, venta: { total: number | null }) => sum + Number(venta.total || 0),
        0,
      ) +
      ventaServiciosData.reduce(
        (sum: number, servicio: { total: number }) => sum + servicio.total,
        0,
      )

    const totalGastosMermas = mermasData.reduce(
      (
        sum: number,
        merma: { cantidad: number; producto: { precioCosto: number | string | null } },
      ) => {
        return sum + merma.cantidad * Number(merma.producto.precioCosto || 0)
      },
      0,
    )

    const totalGastosDE = gastosDEData.reduce(
      (sum: number, gasto: { monto: number }) => sum + gasto.monto,
      0,
    )
    const totalGastosSalarios = salariosData.reduce(
      (sum: number, salario: { salario: number }) => sum + salario.salario,
      0,
    )

    const totalBeneficio =
      totalIngresos - totalPrecioC - totalGastosMermas - totalGastosDE - totalGastosSalarios

    const fechaInicio = new Date()
    fechaInicio.setMonth(fechaInicio.getMonth() - 6)

    const fechaInicioDiaria = new Date()
    fechaInicioDiaria.setDate(fechaInicioDiaria.getDate() - 60)

    const [
      ventasPorMesData,
      ventaServicioPorMesData,
      mermasPorMesData,
      gastosDeExplotacionPorMesData,
      gastosSalariosPorMesData,
      gastosComprasPorMesData,
      ventasDiariasData,
      ventaServiciosDiariosData,
    ] = await Promise.all([
      prisma.venta.findMany({
        where: { tenantId, createdAt: { gte: fechaInicio }, ventaPadreId: null },
        select: {
          createdAt: true,
          cantidad: true,
          total: true,
        },
      }),
      prisma.ventaServicios.findMany({
        where: { tenantId, createdAt: { gte: fechaInicio } },
        select: { createdAt: true, total: true, cantidad: true },
      }),
      prisma.merma.findMany({
        where: { tenantId, createdAt: { gte: fechaInicio } },
        select: {
          createdAt: true,
          cantidad: true,
          producto: { select: { precioCosto: true } },
        },
      }),
      prisma.gastosDE.findMany({
        where: { tenantId, createdAt: { gte: fechaInicio } },
        select: { createdAt: true, monto: true },
      }),
      prisma.pagosalario.findMany({
        where: { tenantId, createdAt: { gte: fechaInicio } },
        select: { createdAt: true, salario: true },
      }),
      prisma.gastoCompra.findMany({
        where: { tenantId, createdAt: { gte: fechaInicio } },
        select: { createdAt: true, total: true, cantidad: true },
      }),
      prisma.venta.findMany({
        where: { tenantId, createdAt: { gte: fechaInicioDiaria }, ventaPadreId: null },
        select: {
          createdAt: true,
          cantidad: true,
          total: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.ventaServicios.findMany({
        where: { tenantId, createdAt: { gte: fechaInicioDiaria } },
        select: { createdAt: true, total: true, cantidad: true },
        orderBy: { createdAt: "desc" },
      }),
    ])

    const createMonthlyAggregation = <T extends { createdAt: Date }>(
      data: T[],
      valueFields: Record<string, (item: T) => number>,
    ): MonthlyAggregation => {
      return data.reduce((acc: MonthlyAggregation, item: T) => {
        const mes = item.createdAt.toISOString().slice(0, 7)
        if (!acc[mes]) acc[mes] = {}
        Object.entries(valueFields).forEach(([key, getter]) => {
          acc[mes][key] = (acc[mes][key] || 0) + getter(item)
        })
        return acc
      }, {} as MonthlyAggregation)
    }

    const ventasAgrupadas = createMonthlyAggregation<VentaPorMesData>(
      ventasPorMesData as VentaPorMesData[],
      {
        ingresos: (venta: VentaPorMesData) => Number(venta.total || 0),
        cantidad: (venta: VentaPorMesData) => venta.cantidad,
      },
    )

    const serviciosAgrupados = createMonthlyAggregation<VentaServicioPorMesData>(
      ventaServicioPorMesData as VentaServicioPorMesData[],
      {
        ingresos: (servicio: VentaServicioPorMesData) => servicio.total,
        cantidad: (servicio: VentaServicioPorMesData) => servicio.cantidad,
      },
    )

    const mermasAgrupadas = createMonthlyAggregation<MermaPorMesData>(
      mermasPorMesData as MermaPorMesData[],
      {
        gastos: (merma: MermaPorMesData) =>
          merma.cantidad * Number(merma.producto.precioCosto || 0),
        cantidad: (merma: MermaPorMesData) => merma.cantidad,
      },
    )

    const gastosDEAgrupados = createMonthlyAggregation<GastoDePorMesData>(
      gastosDeExplotacionPorMesData as GastoDePorMesData[],
      {
        gastosE: (gasto: GastoDePorMesData) => gasto.monto || 0,
        cantidad: () => 0,
      },
    )

    const gastosSalariosAgrupados = createMonthlyAggregation<GastoSalarioPorMesData>(
      gastosSalariosPorMesData as GastoSalarioPorMesData[],
      {
        gastos: (salario: GastoSalarioPorMesData) => salario.salario || 0,
        cantidad: () => 0,
      },
    )

    const gastosComprasAgrupados = createMonthlyAggregation<GastoCompraPorMesData>(
      gastosComprasPorMesData as GastoCompraPorMesData[],
      {
        gastos: (compra: GastoCompraPorMesData) => compra.total || 0,
        cantidad: (compra: GastoCompraPorMesData) => compra.cantidad || 0,
      },
    )

    const mesesCompletos = new Set([
      ...Object.keys(ventasAgrupadas),
      ...Object.keys(gastosDEAgrupados),
      ...Object.keys(mermasAgrupadas),
      ...Object.keys(serviciosAgrupados),
      ...Object.keys(gastosComprasAgrupados),
      ...Object.keys(gastosSalariosAgrupados),
    ])

    const datosPorMes = Array.from(mesesCompletos)
      .sort()
      .map((mes: string) => ({
        mes,
        ingresosVentas: ventasAgrupadas[mes]?.ingresos || 0,
        ingresosServicios: serviciosAgrupados[mes]?.ingresos || 0,
        gastosMermas: mermasAgrupadas[mes]?.gastos || 0,
        gastosDeExplotacion: gastosDEAgrupados[mes]?.gastosE || 0,
        gastosDeExplotacionCantidad: gastosDeExplotacionPorMesData.length || 0,
        gastosCompras: gastosComprasAgrupados[mes]?.gastos || 0,
        gastosComprasCantidad: gastosComprasAgrupados[mes]?.cantidad || 0,
        gastosSalarios: gastosSalariosAgrupados[mes]?.gastos || 0,
        gastosSalariosCantidad: gastosSalariosPorMesData.length || 0,
        ventasCantidad: ventasAgrupadas[mes]?.cantidad || 0,
        ventasServiciosCantidad: serviciosAgrupados[mes]?.cantidad || 0,
        mermasCantidad: mermasAgrupadas[mes]?.cantidad || 0,
      }))

    function getWeekNumber(date: Date): string {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      return `${d.getUTCFullYear()}-W${weekNum.toString().padStart(2, "0")}`
    }

    const semanasCompletos = new Set([
      ...Object.keys(ventasAgrupadas),
      ...Object.keys(gastosDEAgrupados),
      ...Object.keys(mermasAgrupadas),
      ...Object.keys(serviciosAgrupados),
      ...Object.keys(gastosComprasAgrupados),
      ...Object.keys(gastosSalariosAgrupados),
    ])

    const datosPorSemana = Array.from(semanasCompletos)
      .sort()
      .map((mes: string) => {
        const [year, month] = mes.split("-").map(Number)
        const date = new Date(year, month - 1, 1)
        const semana = getWeekNumber(date)
        return {
          semana,
          ingresosVentas: ventasAgrupadas[mes]?.ingresos || 0,
          ingresosServicios: serviciosAgrupados[mes]?.ingresos || 0,
          gastosMermas: mermasAgrupadas[mes]?.gastos || 0,
          gastosDeExplotacion: gastosDEAgrupados[mes]?.gastosE || 0,
          gastosDeExplotacionCantidad: gastosDeExplotacionPorMesData.length || 0,
          gastosCompras: gastosComprasAgrupados[mes]?.gastos || 0,
          gastosComprasCantidad: gastosComprasAgrupados[mes]?.cantidad || 0,
          gastosSalarios: gastosSalariosAgrupados[mes]?.gastos || 0,
          gastosSalariosCantidad: gastosSalariosPorMesData.length || 0,
          ventasCantidad: ventasAgrupadas[mes]?.cantidad || 0,
          ventasServiciosCantidad: serviciosAgrupados[mes]?.cantidad || 0,
          mermasCantidad: mermasAgrupadas[mes]?.cantidad || 0,
        }
      })
      .sort((a, b) => a.semana.localeCompare(b.semana))
      .slice(-12)

    const ventasPorProducto: Record<string, number> = {
      ...ventasItemsPorProducto,
    }
    Object.entries(ventasLegacyPorProducto).forEach(([productoId, cantidad]) => {
      ventasPorProducto[productoId] = (ventasPorProducto[productoId] || 0) + cantidad
    })

    const ingresosItemsPorProducto = ventaItemsData.reduce(
      (acc: Record<string, number>, item: { productoId: string; total: number }) => {
        acc[item.productoId] = (acc[item.productoId] || 0) + Number(item.total || 0)
        return acc
      },
      {},
    )

    const ingresosLegacyPorProducto = ventasLegacyData.reduce(
      (acc: Record<string, number>, venta: { productoId: string | null; cantidad: number }) => {
        if (!venta.productoId) return acc
        acc[venta.productoId] =
          (acc[venta.productoId] || 0) +
          Number(venta.cantidad || 0) * (precioVentaPorProducto[venta.productoId] || 0)
        return acc
      },
      {},
    )

    const productosVentas = Object.entries(ventasPorProducto)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const topProductoIds = productosVentas.map(([productoId]) => productoId)
    const topProductosData = await prisma.producto.findMany({
      where: { tenantId, id: { in: topProductoIds } },
      select: {
        id: true,
        nombre: true,
        stock: true,
        categoria: { select: { nombre: true } },
      },
    })
    const topProductosMap = new Map(topProductosData.map((p) => [p.id, p]))

    const productosMasVendidos = productosVentas.map(([productoId, cantidad]) => {
      const producto = topProductosMap.get(productoId)
      const ingresos =
        (ingresosItemsPorProducto[productoId] || 0) + (ingresosLegacyPorProducto[productoId] || 0)
      return {
        id: producto?.id || productoId,
        nombre: producto?.nombre || "",
        categoria: producto?.categoria?.nombre || "",
        ventas: cantidad,
        ingresos,
        stock: producto?.stock || 0,
      }
    })

    const productosMasVendidosFiltrados = productosMasVendidos.filter(Boolean)

    const baseWhereCondition =
      tipoUbicacion === "almacen" && ubicacionId
        ? { tenantId, almacenId: ubicacionId }
        : tipoUbicacion === "puntoDeVenta" && ubicacionId
          ? { tenantId, puntoDeVentaId: ubicacionId }
          : { tenantId }

    const todosLosProductos = await prisma.producto.findMany({
      where: baseWhereCondition,
      select: {
        id: true,
        nombre: true,
        stock: true,
        stockMinimo: true,
        categoria: { select: { nombre: true } },
        unidad: { select: { simbolo: true } },
      },
    })

    type ProductoConRelaciones = (typeof todosLosProductos)[0]
    type GrupoProducto = {
      productos: ProductoConRelaciones[]
      stockTotal: number
      stockMinimoMin: number
      representante: ProductoConRelaciones
    }

    const productosAgrupados = todosLosProductos.reduce(
      (acc: Record<string, GrupoProducto>, producto: ProductoConRelaciones) => {
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
      },
      {} as Record<string, GrupoProducto>,
    )

    const productosStockBajo: (ProductoConRelaciones & {
      stockTotal: number
      stockMinimo: number
      diferencia: number
      umbralUsado: number
    })[] = []

    for (const nombreProducto in productosAgrupados) {
      const grupo = productosAgrupados[nombreProducto]
      const stockTotal = grupo.stockTotal
      const stockMinimo =
        grupo.stockMinimoMin === Number.MAX_SAFE_INTEGER ? 0 : grupo.stockMinimoMin

      const umbral = stockMinimo > 0 ? stockMinimo : 10

      if (stockTotal < umbral) {
        const diferencia = umbral - stockTotal

        productosStockBajo.push({
          ...grupo.representante,
          stockTotal,
          stockMinimo,
          diferencia,
          umbralUsado: umbral,
        })
      }
    }

    productosStockBajo.sort(
      (
        a: (typeof productosStockBajo)[0],
        b: (typeof productosStockBajo)[0],
      ) => a.stockTotal - b.stockTotal,
    )
    productosStockBajo.splice(5)

    const transferenciasStats = {
      almacenAAlmacen: transferenciasData.filter(
        (t: { origenId: string | null; destinoId: string | null }) => t.origenId && t.destinoId,
      ).length,
      almacenAPuntoVenta: transferenciasData.filter(
        (t: { origenId: string | null; puntoDeVentaDestinoId: string | null }) =>
          t.origenId && t.puntoDeVentaDestinoId,
      ).length,
      puntoVentaAAlmacen: transferenciasData.filter(
        (t: { puntoDeVentaOrigenId: string | null; destinoId: string | null }) =>
          t.puntoDeVentaOrigenId && t.destinoId,
      ).length,
      puntoVentaAPuntoVenta: transferenciasData.filter(
        (t: { puntoDeVentaOrigenId: string | null; puntoDeVentaDestinoId: string | null }) =>
          t.puntoDeVentaOrigenId && t.puntoDeVentaDestinoId,
      ).length,
    }

    const stockPorCategoria = await prisma.categoria.findMany({
      where: { tenantId },
      select: {
        nombre: true,
        productos: {
          select: {
            stock: true,
            precioCosto: true,
          },
        },
      },
    })

    const distribucionStock = stockPorCategoria.map(
      (categoria: {
        nombre: string
        productos: { stock: number; precioCosto: number | string | null }[]
      }) => ({
        categoria: categoria.nombre,
        productos: categoria.productos.length,
        stockTotal: categoria.productos.reduce(
          (sum: number, p: { stock: number }) => sum + p.stock,
          0,
        ),
        valorTotal: categoria.productos.reduce(
          (sum: number, p: { stock: number; precioCosto: number | string | null }) =>
            sum + p.stock * Number(p.precioCosto),
          0,
        ),
      }),
    )

    const calcularVentasDiarias = () => {
      const hoy = new Date()
      const ayer = new Date()
      ayer.setDate(ayer.getDate() - 1)

      const formatoFecha = (fecha: Date) => fecha.toISOString().split("T")[0]

      const fechaHoy = formatoFecha(hoy)
      const fechaAyer = formatoFecha(ayer)

      const ventasHoy = ventasDiariasData.filter(
        (venta: VentaDiariaData) => formatoFecha(venta.createdAt) === fechaHoy,
      )
      const ventasServiciosHoy = ventaServiciosDiariosData.filter(
        (servicio: VentaServicioDiariaData) => formatoFecha(servicio.createdAt) === fechaHoy,
      )

      const ventasAyer = ventasDiariasData.filter(
        (venta: VentaDiariaData) => formatoFecha(venta.createdAt) === fechaAyer,
      )
      const ventasServiciosAyer = ventaServiciosDiariosData.filter(
        (servicio: VentaServicioDiariaData) => formatoFecha(servicio.createdAt) === fechaAyer,
      )

      const calcularDia = (
        ventas: VentaDiariaData[],
        servicios: VentaServicioDiariaData[],
      ) => {
        const ingresosVentas = ventas.reduce(
          (sum: number, venta: VentaDiariaData) => sum + Number(venta.total || 0),
          0,
        )
        const ingresosServicios = servicios.reduce(
          (sum: number, servicio: VentaServicioDiariaData) => sum + servicio.total,
          0,
        )
        const cantidadVentas = ventas.reduce(
          (sum: number, venta: VentaDiariaData) => sum + venta.cantidad,
          0,
        )
        const cantidadServicios = servicios.reduce(
          (sum: number, servicio: VentaServicioDiariaData) => sum + (servicio.cantidad || 0),
          0,
        )

        return {
          ingresos: ingresosVentas + ingresosServicios,
          cantidad: cantidadVentas + cantidadServicios,
        }
      }

      const datosHoy = calcularDia(ventasHoy, ventasServiciosHoy)
      const datosAyer = calcularDia(ventasAyer, ventasServiciosAyer)

      const ventasPorDia = new Map<string, DiaVentas>()

      const todosLosItems: (VentaDiariaData | VentaServicioDiariaData)[] = [
        ...ventasDiariasData,
        ...ventaServiciosDiariosData,
      ]
      todosLosItems.forEach((item: VentaDiariaData | VentaServicioDiariaData) => {
        const fecha = formatoFecha(item.createdAt)
        const datosDia = ventasPorDia.get(fecha) || { ingresos: 0, cantidad: 0 }
        ventasPorDia.set(fecha, datosDia)

        if ("total" in item) {
          const venta = item as VentaDiariaData
          datosDia.ingresos += Number(venta.total || 0)
          datosDia.cantidad += venta.cantidad
        } else {
          const servicio = item as VentaServicioDiariaData
          datosDia.ingresos += servicio.total
          datosDia.cantidad += servicio.cantidad || 0
        }
      })

      const diasAnalizados = Array.from(ventasPorDia.values())
      const totalIngresos = diasAnalizados.reduce(
        (sum: number, dia: DiaVentas) => sum + dia.ingresos,
        0,
      )
      const totalCantidad = diasAnalizados.reduce(
        (sum: number, dia: DiaVentas) => sum + dia.cantidad,
        0,
      )
      const diasConVentas = diasAnalizados.filter((dia: DiaVentas) => dia.ingresos > 0).length
      const totalDias = diasAnalizados.length

      return {
        ventasHoy: datosHoy.cantidad,
        ingresosHoy: datosHoy.ingresos,
        ventasAyer: datosAyer.cantidad,
        ingresosAyer: datosAyer.ingresos,
        promedioVentasDiarias: diasConVentas > 0 ? totalCantidad / diasConVentas : 0,
        promedioIngresosDiarios: diasConVentas > 0 ? totalIngresos / diasConVentas : 0,
        diasConVentas,
        totalDias,
        totalIngresosPeriodo: totalIngresos,
        totalCantidadPeriodo: totalCantidad,
      }
    }

    const ventasDiarias = calcularVentasDiarias()

    const result = {
      totalProductos,
      totalAlmacenes,
      totalPuntosVenta,
      totalVentas: ventasData.length,
      totalMermas: mermasData.length,
      totalTransferencias: transferenciasData.length,
      totalIngresos,
      totalGastosMermas,
      totalBeneficio,
      valorTotalInventario,
      datosPorMes,
      datosPorSemana,
      ventasDiarias,
      productosMasVendidos,
      productosStockBajo,
      distribucionStock,
      transferenciasStats,
    }

    cache.set(cacheKey, { data: result, timestamp: Date.now() })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error al obtener estadísticas del dashboard:", error)
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 })
  }
}

export async function invalidateDashboardCacheHandler() {
  try {
    invalidateDashboardCache()
    return NextResponse.json({ message: "Dashboard cache invalidated successfully" })
  } catch (error) {
    console.error("Error invalidating dashboard cache:", error)
    return NextResponse.json({ error: "Failed to invalidate cache" }, { status: 500 })
  }
}

