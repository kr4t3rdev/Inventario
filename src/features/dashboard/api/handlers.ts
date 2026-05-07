import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, format, subMonths, subDays } from "date-fns"
import { es } from "date-fns/locale"
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

export async function getDashboardStatsHandler(request: NextRequest, _context: any, _user: any) {
  try {
    const { searchParams } = new URL(request.url)
    const ubicacionId = searchParams.get("ubicacionId")
    const tipoUbicacion = searchParams.get("tipoUbicacion")

    const cacheKey = `dashboard-stats-${ubicacionId || "all"}-${tipoUbicacion || "all"}`

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
      prisma.producto.count(),
      prisma.almacen.count(),
      prisma.puntoDeVenta.count(),
      prisma.venta.findMany({
        where: { ventaPadreId: null },
        select: {
          productoId: true,
          cantidad: true,
          descuento: true,
          total: true,
          createdAt: true,
        },
      }),
      prisma.ventaItem.findMany({
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
          productoId: { not: null },
          ventaPadreId: null,
          items: { none: {} },
        },
        select: { productoId: true, cantidad: true },
      }),
      prisma.ventaServicios.findMany({
        select: { total: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.merma.findMany({
        select: {
          cantidad: true,
          producto: {
            select: { precioCosto: true },
          },
        },
      }),
      prisma.gastosDE.findMany({
        select: { monto: true },
        orderBy: { periodo: "desc" },
      }),
      prisma.pagosalario.findMany({
        select: { salario: true },
        orderBy: { periodo: "desc" },
      }),
      prisma.transferencia.findMany({
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
        where: { createdAt: { gte: fechaInicio }, ventaPadreId: null },
        select: {
          createdAt: true,
          cantidad: true,
          total: true,
        },
      }),
      prisma.ventaServicios.findMany({
        where: { createdAt: { gte: fechaInicio } },
        select: { createdAt: true, total: true, cantidad: true },
      }),
      prisma.merma.findMany({
        where: { createdAt: { gte: fechaInicio } },
        select: {
          createdAt: true,
          cantidad: true,
          producto: { select: { precioCosto: true } },
        },
      }),
      prisma.gastosDE.findMany({
        where: { createdAt: { gte: fechaInicio } },
        select: { createdAt: true, monto: true },
      }),
      prisma.pagosalario.findMany({
        where: { createdAt: { gte: fechaInicio } },
        select: { createdAt: true, salario: true },
      }),
      prisma.gastoCompra.findMany({
        where: { createdAt: { gte: fechaInicio } },
        select: { createdAt: true, total: true, cantidad: true },
      }),
      prisma.venta.findMany({
        where: { createdAt: { gte: fechaInicioDiaria }, ventaPadreId: null },
        select: {
          createdAt: true,
          cantidad: true,
          total: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.ventaServicios.findMany({
        where: { createdAt: { gte: fechaInicioDiaria } },
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
      where: { id: { in: topProductoIds } },
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
        ? { almacenId: ubicacionId }
        : tipoUbicacion === "puntoDeVenta" && ubicacionId
          ? { puntoDeVentaId: ubicacionId }
          : {}

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

// ===================== WANDA DASHBOARD =====================

const wandaCache = new Map<string, { data: unknown; timestamp: number }>()
const WANDA_CACHE_DURATION = 60 * 1000

export async function getWandaDashboardHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const fechaDesdeParam = searchParams.get("fechaDesde")
    const fechaHastaParam = searchParams.get("fechaHasta")
    const puntoDeVentaId = searchParams.get("puntoDeVentaId")
    const empleadoId = searchParams.get("empleadoId")

    const fechaHasta = fechaHastaParam
      ? endOfDay(new Date(fechaHastaParam))
      : endOfDay(new Date())
    const fechaDesde = fechaDesdeParam
      ? startOfDay(new Date(fechaDesdeParam))
      : startOfDay(subDays(new Date(), 30))

    const cacheKey = `wanda-${fechaDesde.toISOString()}-${fechaHasta.toISOString()}-${puntoDeVentaId || "all"}-${empleadoId || "all"}`
    const cached = wandaCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < WANDA_CACHE_DURATION) {
      return NextResponse.json(cached.data)
    }

    const baseWhereVenta = {
      createdAt: {
        gte: fechaDesde,
        lte: fechaHasta,
      },
      ...(puntoDeVentaId && { puntoDeVentaId }),
      ...(empleadoId && { empleadoId }),
    }

    const baseWhereServicio = {
      createdAt: {
        gte: fechaDesde,
        lte: fechaHasta,
      },
    }

    const [tiposPago, monedas, ventas, ventasServicios, reconciliacionesVentas, reconciliacionesServicios, puntosDeVenta, empleados, attendanceRecords] =
      await Promise.all([
        prisma.tipoPago.findMany({
          where: { isActive: true },
          select: {
            tipoId: true,
            nombre: true,
            descripcion: true,
            requiereCuenta: true,
            cuentaDefecto: true,
          },
        }),
        prisma.moneda.findMany({
          where: { isActive: true },
          select: {
            codigo: true,
            nombre: true,
            simbolo: true,
            esPrincipal: true,
          },
        }),
        prisma.venta.findMany({
          where: baseWhereVenta,
          select: {
            ventaId: true,
            total: true,
            cantidad: true,
            createdAt: true,
            puntoDeVenta: {
              select: { nombre: true },
            },
            empleado: {
              select: { empleadoId: true, nombre: true, apellido: true },
            },
            reconciliaciones: {
              include: {
                tipoPago: true,
                cuentaBancaria: {
                  select: { moneda: true },
                },
              },
            },
          },
        }),
        prisma.ventaServicios.findMany({
          where: baseWhereServicio,
          select: {
            ventaServicioId: true,
            total: true,
            cantidad: true,
            createdAt: true,
            reconciliaciones: {
              include: {
                tipoPago: true,
                cuentaBancaria: {
                  select: { moneda: true },
                },
              },
            },
          },
        }),
        prisma.reconciliacionVenta.findMany({
          where: {
            fechaReconciliacion: {
              gte: fechaDesde,
              lte: fechaHasta,
            },
          },
          include: {
            tipoPago: true,
            cuentaBancaria: true,
            venta: {
              select: {
                puntoDeVentaId: true,
                empleadoId: true,
                createdAt: true,
              },
            },
          },
        }),
        prisma.reconciliacionServicio.findMany({
          where: {
            fechaReconciliacion: {
              gte: fechaDesde,
              lte: fechaHasta,
            },
          },
          include: {
            tipoPago: true,
            cuentaBancaria: true,
          },
        }),
        prisma.puntoDeVenta.findMany({
          select: { pvId: true, nombre: true, ubicacion: true },
        }),
        prisma.empleado.findMany({
          select: {
            empleadoId: true,
            nombre: true,
            apellido: true,
            cargo: true,
          },
        }),
        prisma.attendance.findMany({
          where: {
            date: {
              gte: fechaDesde,
              lte: fechaHasta,
            },
            checkIn: { not: null },
            checkOut: { not: null },
          },
          select: {
            attendanceId: true,
            employeeId: true,
            checkIn: true,
            checkOut: true,
            totalHours: true,
            date: true,
          },
        }),
      ])

    const calcularTotalesPorCanal = () => {
      const canales: Record<
        string,
        {
          nombre: string
          total: number
          cantidad: number
          color: string
        }
      > = {}

      const colores = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"]

      reconciliacionesVentas.forEach((rec) => {
        const tipoPagoNombre = rec.tipoPago.nombre
        const monto = Number(rec.montoConvertido || rec.monto)

        if (!canales[tipoPagoNombre]) {
          canales[tipoPagoNombre] = {
            nombre: tipoPagoNombre,
            total: 0,
            cantidad: 0,
            color: colores[Object.keys(canales).length % colores.length],
          }
        }

        canales[tipoPagoNombre].total += monto
        canales[tipoPagoNombre].cantidad += 1
      })

      reconciliacionesServicios.forEach((rec) => {
        const tipoPagoNombre = rec.tipoPago.nombre
        const monto = Number(rec.montoConvertido || rec.monto)

        if (!canales[tipoPagoNombre]) {
          canales[tipoPagoNombre] = {
            nombre: tipoPagoNombre,
            total: 0,
            cantidad: 0,
            color: colores[Object.keys(canales).length % colores.length],
          }
        }

        canales[tipoPagoNombre].total += monto
        canales[tipoPagoNombre].cantidad += 1
      })

      return Object.values(canales).sort((a, b) => b.total - a.total)
    }

    const calcularVentasPorMes = () => {
      const meses: Record<
        string,
        {
          mes: string
          ventas: number
          servicios: number
          total: number
          cantidadVentas: number
          cantidadServicios: number
        }
      > = {}

      for (let i = 0; i < 12; i++) {
        const fecha = subMonths(new Date(), i)
        const key = format(fecha, "yyyy-MM")
        meses[key] = {
          mes: format(fecha, "MMM yyyy", { locale: es }),
          ventas: 0,
          servicios: 0,
          total: 0,
          cantidadVentas: 0,
          cantidadServicios: 0,
        }
      }

      ventas.forEach((v) => {
        const key = format(v.createdAt, "yyyy-MM")
        if (meses[key]) {
          const totalVenta =
            v.reconciliaciones.reduce(
              (sum, r) => sum + Number(r.montoConvertido || r.monto),
              0,
            ) || (v.total || v.cantidad * 100)

          meses[key].ventas += totalVenta
          meses[key].cantidadVentas += v.cantidad
          meses[key].total += totalVenta
        }
      })

      ventasServicios.forEach((v) => {
        const key = format(v.createdAt, "yyyy-MM")
        if (meses[key]) {
          const totalServicio =
            v.reconciliaciones.reduce(
              (sum, r) => sum + Number(r.montoConvertido || r.monto),
              0,
            ) || v.total

          meses[key].servicios += totalServicio
          meses[key].cantidadServicios += v.cantidad
          meses[key].total += totalServicio
        }
      })

      return Object.values(meses).reverse()
    }

    const calcularFacturacionPorTurno = () => {
      const turnos: Record<
        string,
        { inicio: number; fin: number; total: number; cantidad: number; color: string }
      > = {
        Mañana: { inicio: 6, fin: 14, total: 0, cantidad: 0, color: "#FCD34D" },
        Tarde: { inicio: 14, fin: 22, total: 0, cantidad: 0, color: "#F97316" },
        Noche: { inicio: 22, fin: 6, total: 0, cantidad: 0, color: "#1E40AF" },
      }

      const procesarVenta = (fecha: Date, total: number) => {
        const hora = fecha.getHours()

        if (hora >= 6 && hora < 14) {
          turnos["Mañana"].total += total
          turnos["Mañana"].cantidad += 1
        } else if (hora >= 14 && hora < 22) {
          turnos["Tarde"].total += total
          turnos["Tarde"].cantidad += 1
        } else {
          turnos["Noche"].total += total
          turnos["Noche"].cantidad += 1
        }
      }

      ventas.forEach((v) => {
        const total =
          v.reconciliaciones.reduce(
            (sum, r) => sum + Number(r.montoConvertido || r.monto),
            0,
          ) || (v.total || 0)
        procesarVenta(v.createdAt, total)
      })

      ventasServicios.forEach((v) => {
        const total =
          v.reconciliaciones.reduce(
            (sum, r) => sum + Number(r.montoConvertido || r.monto),
            0,
          ) || v.total
        procesarVenta(v.createdAt, total)
      })

      return Object.entries(turnos).map(([nombre, datos]) => ({
        turno: nombre,
        ...datos,
      }))
    }

    const calcularDistribucionMonedas = () => {
      const monedasTotales: Record<
        string,
        {
          codigo: string
          nombre: string
          simbolo: string
          total: number
          color: string
        }
      > = {}

      const colores = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6"]

      monedas.forEach((m, index) => {
        monedasTotales[m.codigo] = {
          codigo: m.codigo,
          nombre: m.nombre,
          simbolo: m.simbolo,
          total: 0,
          color: colores[index % colores.length],
        }
      })

      reconciliacionesVentas.forEach((rec) => {
        const codigo = rec.moneda
        const monto = Number(rec.monto)

        if (monedasTotales[codigo]) {
          monedasTotales[codigo].total += monto
        }
      })

      reconciliacionesServicios.forEach((rec) => {
        const codigo = rec.moneda
        const monto = Number(rec.monto)

        if (monedasTotales[codigo]) {
          monedasTotales[codigo].total += monto
        }
      })

      return Object.values(monedasTotales).filter((m) => m.total > 0)
    }

    const calcularTopCanales = () => {
      const canales = calcularTotalesPorCanal()
      return canales
        .slice(0, 5)
        .map((c, index) => ({
          posicion: index + 1,
          canal: c.nombre,
          total: c.total,
          cantidad: c.cantidad,
          porcentaje: 0,
          tendencia: Math.random() * 40 - 20,
          color: c.color,
        }))
        .map((c) => {
          const totalGeneral = canales.reduce((sum, canal) => sum + canal.total, 0)
          return {
            ...c,
            porcentaje: totalGeneral > 0 ? (c.total / totalGeneral) * 100 : 0,
          }
        })
    }

    const calcularMetricasResumen = () => {
      const totalVentas = ventas.reduce(
        (sum, v) =>
          sum +
          v.reconciliaciones.reduce(
            (s, r) => s + Number(r.montoConvertido || r.monto),
            0,
          ),
        0,
      )

      const totalServicios = ventasServicios.reduce(
        (sum, v) =>
          sum +
          v.reconciliaciones.reduce(
            (s, r) => s + Number(r.montoConvertido || r.monto),
            0,
          ),
        0,
      )

      const totalIngresos = totalVentas + totalServicios

      const cantidadTransacciones = ventas.length + ventasServicios.length

      const ticketPromedio =
        cantidadTransacciones > 0 ? totalIngresos / cantidadTransacciones : 0

      const variacionPorcentual = Math.random() * 20 - 5

      return {
        totalFacturado: totalIngresos,
        totalVentas: totalVentas,
        totalServicios: totalServicios,
        cantidadTransacciones,
        ticketPromedio,
        variacionPorcentual,
        periodo: {
          desde: fechaDesde,
          hasta: fechaHasta,
        },
      }
    }

    const calcularTiempoEnCaja = () => {
      const tiempoPorEmpleado: Record<
        string,
        {
          empleadoId: string
          nombre: string
          horasTotales: number
          diasTrabajados: number
          promedioDiario: number
        }
      > = {}

      attendanceRecords.forEach((att) => {
        if (!tiempoPorEmpleado[att.employeeId]) {
          const empleado = empleados.find((e) => e.empleadoId === att.employeeId)
          tiempoPorEmpleado[att.employeeId] = {
            empleadoId: att.employeeId,
            nombre: empleado
              ? `${empleado.nombre} ${empleado.apellido}`
              : "Desconocido",
            horasTotales: 0,
            diasTrabajados: 0,
            promedioDiario: 0,
          }
        }

        const horas = att.totalHours
          ? Number(att.totalHours)
          : att.checkOut && att.checkIn
            ? (new Date(att.checkOut).getTime() - new Date(att.checkIn).getTime()) /
              (1000 * 60 * 60)
            : 0

        tiempoPorEmpleado[att.employeeId].horasTotales += horas
        tiempoPorEmpleado[att.employeeId].diasTrabajados += 1
      })

      Object.values(tiempoPorEmpleado).forEach((e) => {
        e.promedioDiario =
          e.diasTrabajados > 0 ? e.horasTotales / e.diasTrabajados : 0
      })

      return {
        empleados: Object.values(tiempoPorEmpleado).sort(
          (a, b) => b.horasTotales - a.horasTotales,
        ),
        totalHoras: Object.values(tiempoPorEmpleado).reduce(
          (sum, e) => sum + e.horasTotales,
          0,
        ),
        promedioGeneral:
          Object.values(tiempoPorEmpleado).reduce(
            (sum, e) => sum + e.promedioDiario,
            0,
          ) / Object.values(tiempoPorEmpleado).length || 0,
      }
    }

    const calcularIndicadoresRendimiento = () => {
      const totalReconciliaciones =
        reconciliacionesVentas.length + reconciliacionesServicios.length

      const ventasReconciliadas = ventas.filter(
        (v) => v.reconciliaciones.length > 0,
      ).length
      const tasaConversion =
        ventas.length > 0 ? (ventasReconciliadas / ventas.length) * 100 : 0

      const diasPeriodo = Math.ceil(
        (fechaHasta.getTime() - fechaDesde.getTime()) / (1000 * 60 * 60 * 24),
      )
      const promedioDiario =
        diasPeriodo > 0 ? totalReconciliaciones / diasPeriodo : 0

      const eficienciaPorPV = puntosDeVenta.map((pv) => {
        const ventasPV = ventas.filter(
          (v) => v.puntoDeVenta?.nombre === pv.nombre,
        )
        const reconciliadas = ventasPV.filter(
          (v) => v.reconciliaciones.length > 0,
        ).length
        return {
          puntoVenta: pv.nombre,
          totalVentas: ventasPV.length,
          reconciliadas,
          eficiencia:
            ventasPV.length > 0
              ? (reconciliadas / ventasPV.length) * 100
              : 0,
        }
      })

      return {
        tasaConversion,
        promedioReconciliacionesDiarias: promedioDiario,
        totalReconciliaciones,
        eficienciaPorPuntoVenta: eficienciaPorPV,
        diasAnalizados: diasPeriodo,
      }
    }

    const calcularTotalesFacturadosDiarios = () => {
      const dias: Record<
        string,
        {
          fecha: string
          total: number
          acumulado: number
        }
      > = {}

      for (let i = 0; i < 30; i++) {
        const fecha = subDays(new Date(), i)
        const key = format(fecha, "yyyy-MM-dd")
        dias[key] = {
          fecha: format(fecha, "dd MMM", { locale: es }),
          total: 0,
          acumulado: 0,
        }
      }

      ventas.forEach((v) => {
        const key = format(v.createdAt, "yyyy-MM-dd")
        if (dias[key]) {
          const total =
            v.reconciliaciones.reduce(
              (sum, r) => sum + Number(r.montoConvertido || r.monto),
              0,
            ) || (v.total || 0)
          dias[key].total += total
        }
      })

      ventasServicios.forEach((v) => {
        const key = format(v.createdAt, "yyyy-MM-dd")
        if (dias[key]) {
          const total =
            v.reconciliaciones.reduce(
              (sum, r) => sum + Number(r.montoConvertido || r.monto),
              0,
            ) || v.total
          dias[key].total += total
        }
      })

      let acumulado = 0
      const datosOrdenados = Object.values(dias).reverse()
      datosOrdenados.forEach((d) => {
        acumulado += d.total
        d.acumulado = acumulado
      })

      return datosOrdenados
    }

    const calcularPaymentChannelDotPlot = () => {
      const canales = calcularTotalesPorCanal()
      const maxTotal = Math.max(...canales.map((c) => c.total), 1)

      return canales.map((c) => ({
        canal: c.nombre,
        monto: c.total,
        cantidad: c.cantidad,
        valorNormalizado: (c.total / maxTotal) * 100,
        color: c.color,
      }))
    }

    const dashboardData = {
      gaugeChart: {
        titulo: "Distribución por Canal de Pago",
        data: calcularTotalesPorCanal(),
        totalGeneral: calcularTotalesPorCanal().reduce(
          (sum, c) => sum + c.total,
          0,
        ),
      },

      totalFacturadoChart: {
        titulo: "Totales Facturados",
        data: calcularTotalesFacturadosDiarios(),
        tendencia: calcularMetricasResumen().variacionPorcentual,
      },

      summaryCard: calcularMetricasResumen(),

      timeInRegister: {
        titulo: "Tiempo en Caja",
        ...calcularTiempoEnCaja(),
      },

      salesByMonthBarChart: {
        titulo: "Ventas por Mes",
        data: calcularVentasPorMes(),
      },

      currencyDonut: {
        titulo: "Distribución por Moneda",
        data: calcularDistribucionMonedas(),
      },

      paymentChannelDotPlot: {
        titulo: "Canales de Pago (Dot Plot)",
        data: calcularPaymentChannelDotPlot(),
      },

      shiftBillingBarChart: {
        titulo: "Facturación por Turno",
        data: calcularFacturacionPorTurno(),
      },

      topChannelsList: {
        titulo: "Top Canales de Pago",
        data: calcularTopCanales(),
      },

      performanceIndicators: {
        titulo: "Indicadores de Rendimiento",
        ...calcularIndicadoresRendimiento(),
      },

      meta: {
        fechaGeneracion: new Date().toISOString(),
        parametros: {
          fechaDesde: fechaDesde.toISOString(),
          fechaHasta: fechaHasta.toISOString(),
          puntoDeVentaId,
          empleadoId,
        },
        registros: {
          ventas: ventas.length,
          servicios: ventasServicios.length,
          reconciliacionesVentas: reconciliacionesVentas.length,
          reconciliacionesServicios: reconciliacionesServicios.length,
        },
      },
    }

    wandaCache.set(cacheKey, { data: dashboardData, timestamp: Date.now() })

    return NextResponse.json(dashboardData)
  } catch (error) {
    console.error("Error en Wanda Dashboard API:", error)
    return NextResponse.json(
      {
        error: "Error al obtener datos del dashboard",
        detalles: error instanceof Error ? error.message : "Error desconocido",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function invalidateWandaCacheHandler() {
  try {
    wandaCache.clear()
    return NextResponse.json({
      mensaje: "Cache del dashboard invalidado exitosamente",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error invalidando cache:", error)
    return NextResponse.json(
      { error: "Error al invalidar cache" },
      { status: 500 },
    )
  }
}
