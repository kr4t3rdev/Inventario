/**
 * @description Pure server queries for Dashboard — shared between Server Actions and Server Components.
 * This file has NO 'use server' directive so it can be called directly from RSC.
 * The business logic is extracted here to avoid context/cookie issues when calling
 * Server Actions directly from Server Components.
 */
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, format, subMonths, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

const ULTIMOS_DIAS = 30

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
export async function getDashboardStatsQuery(tenantId: string): Promise<DashboardStats> {
  const [
    totalProductos, totalAlmacenes, totalPuntosVenta,
    ventasData, ventaItemsData, ventaServiciosData,
    mermasData, gastosDEData, salariosData,
    transferenciasData, productosDataRaw,
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
    prisma.ventaServicios.findMany({
      where: { tenantId },
      select: { total: true, createdAt: true },
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
        categoria: { select: { nombre: true } },
        unidad: { select: { simbolo: true } },
      },
    }),
  ])

  // @ts-expect-error
  const totalIngresos = ventasData.reduce((s: number, v: VentaDiariaData) => s + (v.total ?? 0), 0)
    + ventaServiciosData.reduce((s: number, v: any) => s + (v.total ?? 0), 0)
  const totalGastosMermas = mermasData.reduce((s: number, m: any) => s + (m.cantidad * (m.producto?.precioCosto ?? 0)), 0)
  const totalGastos = gastosDEData.reduce((s: number, g: any) => s + g.monto, 0)
    + salariosData.reduce((s: number, p: any) => s + p.salario + (p.bonificaciones ?? 0) + (p.horasExtras ?? 0), 0)
  const totalCostoVentas = ventaItemsData.reduce((s: number, i: VentaItemData) => s + i.cantidad * (i.producto?.precioCosto ?? 0), 0)
  const totalBeneficio = totalIngresos - totalCostoVentas - totalGastosMermas - totalGastos
  const valorTotalInventario = productosDataRaw.reduce((s: number, p: any) => s + (p.stock * (p.precioCosto ?? 0)), 0)

  // Productos más vendidos
  const ventasPorProducto: Record<string, { nombre: string; categoria: string; ventas: number; ingresos: number }> = {}
  for (const v of ventaItemsData) {
    if (!v.productoId || !v.producto) continue
    const id = v.productoId
    if (!ventasPorProducto[id]) ventasPorProducto[id] = { nombre: v.producto.nombre, categoria: '', ventas: 0, ingresos: 0 }
    ventasPorProducto[id].ventas += v.cantidad
    ventasPorProducto[id].ingresos += v.total
  }
  const productosMasVendidos = Object.entries(ventasPorProducto)
    .sort((a, b) => b[1].ventas - a[1].ventas)
    .slice(0, 10)
    .map(([id, d]) => ({
      id, nombre: d.nombre, categoria: d.categoria, ventas: d.ventas, ingresos: d.ingresos,
      stock: productosDataRaw.find((p: any) => p.id === id)?.stock ?? 0,
    }))

  // Productos con stock bajo
  const productosStockBajo = productosDataRaw
    .filter((p: any) => p.stockMinimo > 0 && p.stock <= p.stockMinimo)
    .map((p: any) => ({
      id: p.id, nombre: p.nombre, stock: p.stock, stockTotal: p.stock,
      stockMinimo: p.stockMinimo, diferencia: p.stock - p.stockMinimo,
      umbralUsado: p.stockMinimo, categoria: p.categoria ?? { nombre: 'Sin categoría' },
      unidad: p.unidad ?? { simbolo: 'und' },
    }))

  // Datos mensuales
  const datosPorMes = Array.from({ length: 6 }, (_, i) => {
    const mes = subMonths(new Date(), 5 - i)
    const fInicio = startOfDay(new Date(mes.getFullYear(), mes.getMonth(), 1))
    const fFin = endOfDay(new Date(mes.getFullYear(), mes.getMonth() + 1, 0))
    return {
      mes: format(mes, 'MMM', { locale: es }),
      ingresosVentas: ventasData.filter((v: any) => v.createdAt >= fInicio && v.createdAt <= fFin).reduce((s: number, v: any) => s + (v.total ?? 0), 0),
      ingresosServicios: ventaServiciosData.filter((v: any) => v.createdAt >= fInicio && v.createdAt <= fFin).reduce((s: number, v: any) => s + (v.total ?? 0), 0),
      gastosMermas: mermasData.filter((m: any) => m.createdAt >= fInicio && m.createdAt <= fFin).reduce((s: number, m: any) => s + (m.cantidad * (m.producto?.precioCosto ?? 0)), 0),
      gastosDeExplotacion: gastosDEData.filter((g: any) => g.createdAt >= fInicio && g.createdAt <= fFin).reduce((s: number, g: any) => s + g.monto, 0),
      gastosDeExplotacionCantidad: gastosDEData.filter((g: any) => g.createdAt >= fInicio && g.createdAt <= fFin).length,
      gastosCompras: 0,
      gastosComprasCantidad: 0,
      gastosSalarios: salariosData.filter((p: any) => p.createdAt >= fInicio && p.createdAt <= fFin).reduce((s: number, p: any) => s + p.salario + (p.bonificaciones ?? 0) + (p.horasExtras ?? 0), 0),
      gastosSalariosCantidad: salariosData.filter((p: any) => p.createdAt >= fInicio && p.createdAt <= fFin).length,
      ventasCantidad: ventasData.filter((v: any) => v.createdAt >= fInicio && v.createdAt <= fFin).length,
      ventasServiciosCantidad: ventaServiciosData.filter((v: any) => v.createdAt >= fInicio && v.createdAt <= fFin).length,
      mermasCantidad: mermasData.filter((m: any) => m.createdAt >= fInicio && m.createdAt <= fFin).length,
    }
  })

  // Ventas diarias (últimos 30 días)
  const ahora = new Date()
  const hoy = startOfDay(ahora)
  const ayer = startOfDay(subDays(ahora, 1))

  const datosHoy: DiaVentas = { ingresos: 0, cantidad: 0 }
  const datosAyer: DiaVentas = { ingresos: 0, cantidad: 0 }
  const ventasPorDia = new Map<string, DiaVentas>()

  for (const v of ventasData) {
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
      (t: any) => t.origenId && t.destinoId,
    ).length,
    almacenAPuntoVenta: transferenciasData.filter(
      (t: any) => t.origenId && t.puntoDeVentaDestinoId,
    ).length,
    puntoVentaAAlmacen: transferenciasData.filter(
      (t: any) => t.puntoDeVentaOrigenId && t.destinoId,
    ).length,
    puntoVentaAPuntoVenta: transferenciasData.filter(
      (t: any) => t.puntoDeVentaOrigenId && t.puntoDeVentaDestinoId,
    ).length,
  }

  const distribucionStock: { categoria: string; productos: number; stockTotal: number; valorTotal: number }[] = []
  const catMap = new Map<string, { productos: number; stockTotal: number; valorTotal: number }>()
  for (const p of productosDataRaw) {
    const cat = p.categoria?.nombre ?? 'Sin categoría'
    const e = catMap.get(cat) || { productos: 0, stockTotal: 0, valorTotal: 0 }
    e.productos++; e.stockTotal += p.stock; e.valorTotal += p.stock * (p.precioCosto ?? 0)
    catMap.set(cat, e)
  }
  for (const [categoria, d] of catMap) distribucionStock.push({ categoria, ...d })

  return {
    totalProductos, totalAlmacenes, totalPuntosVenta,
    totalVentas: ventasData.length,
    totalMermas: mermasData.length,
    totalTransferencias: transferenciasData.length,
    totalIngresos, totalGastosMermas, totalBeneficio, valorTotalInventario,
    datosPorMes, datosPorSemana: datosPorMes,
    ventasDiarias, productosMasVendidos, productosStockBajo,
    distribucionStock, transferenciasStats,
  }
}
