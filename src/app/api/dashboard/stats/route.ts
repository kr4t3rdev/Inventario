import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet } from "@/lib/auth-middleware"

// Type definitions for dashboard data
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

interface TransferenciaData {
  productoId: string;
  cantidad: number;
  origenId: string | null;
  destinoId: string | null;
  puntoDeVentaOrigenId: string | null;
  puntoDeVentaDestinoId: string | null;
}

interface VentaData {
  productoId: string | null;
  cantidad: number;
  descuento: number | null;
  total: number | null;
  createdAt?: Date;
}

interface VentaServicioData {
  total: number;
  cantidad?: number;
  createdAt?: Date;
}

interface MermaData {
  cantidad: number;
  producto: {
    precioCosto: number | string | null;
  };
  createdAt?: Date;
}

interface GastoDEData {
  monto: number;
  createdAt?: Date;
}

interface SalarioData {
  salario: number;
  createdAt?: Date;
}

interface GastoCompraData {
  total: number;
  cantidad: number;
  createdAt: Date;
}

interface ProductoData {
  id: string;
  stock: number;
  precioCosto: number | null;
  nombre?: string;
  precioVenta?: number | null;
}

// Simple in-memory cache for dashboard stats
const cache = new Map<string, CacheEntry>()
const CACHE_DURATION = 30 * 1000 // 30 seconds for more frequent updates
const DAILY_CACHE_DURATION = 10 * 1000 // 10 seconds for daily data

// Function to invalidate dashboard cache (internal use only)
function invalidateDashboardCache() {
  // Remove all dashboard-related cache entries
  const keysToDelete = Array.from(cache.keys()).filter((key: string) => key.startsWith('dashboard-stats-'))
  keysToDelete.forEach((key: string) => cache.delete(key))
  console.log('Dashboard cache invalidated')
}

// Cache key for daily data specifically
function getDailyDataCacheKey(ubicacionId?: string, tipoUbicacion?: string) {
  return `dashboard-daily-data-${ubicacionId || 'all'}-${tipoUbicacion || 'all'}`
}

export const GET = withAuthGet(async (request: NextRequest, context: any, user: any) => {
  try {
    const { searchParams } = new URL(request.url)
    const ubicacionId = searchParams.get("ubicacionId")
    const tipoUbicacion = searchParams.get("tipoUbicacion")

    // Create cache key based on request parameters
    const cacheKey = `dashboard-stats-${ubicacionId || 'all'}-${tipoUbicacion || 'all'}`

    // Check cache first - use shorter cache for more frequent updates
    const cached = cache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cached.data)
    }

    // Optimized: Use Promise.all for parallel queries
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
      productosDataRaw
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
        }
      }),
      prisma.ventaItem.findMany({
        select: {
          productoId: true,
          cantidad: true,
          total: true,
          producto: {
            select: { precioCosto: true, precioVenta: true, nombre: true }
          }
        }
      }),
      prisma.venta.findMany({
        where: {
          productoId: { not: null },
          ventaPadreId: null,
          items: { none: {} }
        },
        select: { productoId: true, cantidad: true }
      }),
      prisma.ventaServicios.findMany({
        select: { total: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.merma.findMany({
        select: {
          cantidad: true,
          producto: {
            select: { precioCosto: true }
          }
        }
      }),
      prisma.gastosDE.findMany({
        select: { monto: true },
        orderBy: { periodo: 'desc' }
      }),
      prisma.pagosalario.findMany({
        select: { salario: true },
        orderBy: { periodo: 'desc' }
      }),
      prisma.transferencia.findMany({
        select: {
          productoId: true,
          cantidad: true,
          origenId: true,
          destinoId: true,
          puntoDeVentaOrigenId: true,
          puntoDeVentaDestinoId: true
        }
      }),
      prisma.producto.findMany({
        select: { id: true, nombre: true, stock: true, precioCosto: true, precioVenta: true }
      })
    ])

    const ventasItemsPorProducto = ventaItemsData.reduce((acc: Record<string, number>, item: { productoId: string; cantidad: number }) => {
      acc[item.productoId] = (acc[item.productoId] || 0) + Number(item.cantidad || 0)
      return acc
    }, {})

    const ventasLegacyPorProducto = ventasLegacyData.reduce((acc: Record<string, number>, venta: { productoId: string | null; cantidad: number }) => {
      if (!venta.productoId) return acc
      acc[venta.productoId] = (acc[venta.productoId] || 0) + Number(venta.cantidad || 0)
      return acc
    }, {})

    /**
     * @description Obtiene la cantidad vendida total por producto combinando items y ventas legacy.
     * @param {string} productoId - ID del producto.
     * @returns {number} Cantidad total vendida del producto.
     */
    const getVentasProductoTotal = (productoId: string) =>
      (ventasItemsPorProducto[productoId] || 0) + (ventasLegacyPorProducto[productoId] || 0)

    const precioCostoPorProducto = productosDataRaw.reduce((acc: Record<string, number>, producto: { id: string; precioCosto: number | null }) => {
      acc[producto.id] = Number(producto.precioCosto || 0)
      return acc
    }, {})

    const precioVentaPorProducto = productosDataRaw.reduce((acc: Record<string, number>, producto: { id: string; precioVenta: number | null }) => {
      acc[producto.id] = Number(producto.precioVenta || 0)
      return acc
    }, {})

    // Calcular stock real por producto (Almacén + PVs)
    const productosData = productosDataRaw.map((producto: ProductoData) => {
      // Stock en puntos de venta = Entradas a PV - Salidas de PV - Ventas
      // Nota: En este contexto simplificado del dashboard, usaremos las transferencias ya cargadas
      const tEntrada = transferenciasData
        .filter((t: TransferenciaData) => t.productoId === producto.id && t.puntoDeVentaDestinoId !== null)
        .reduce((sum: number, t: TransferenciaData) => sum + t.cantidad, 0)
      
      const tSalida = transferenciasData
        .filter((t: TransferenciaData) => t.productoId === producto.id && t.puntoDeVentaOrigenId !== null)
        .reduce((sum: number, t: TransferenciaData) => sum + t.cantidad, 0)
        
      const vTotal = getVentasProductoTotal(producto.id)

      // Para el dashboard, si no tenemos el ID exacto en ventasData (que no lo pedimos en el select), 
      // usaremos el stock que ya calculamos en la API de productos para ser consistentes.
      // Sin embargo, para no hacer N consultas extra aquí, vamos a mejorar el select de ventasData.
      return {
        ...producto,
        // Por ahora mantenemos la lógica de que producto.stock es lo principal
        // pero idealmente esto debería reflejar el total.
      }
    })

    const valorTotalInventario = productosDataRaw.reduce((sum: number, producto: { id: string; stock: number; precioCosto: number | null }) => {
      const tEntrada = transferenciasData
        .filter((t: { productoId: string; puntoDeVentaDestinoId: string | null; cantidad: number }) => t.productoId === producto.id && t.puntoDeVentaDestinoId !== null)
        .reduce((sum: number, t: { cantidad: number }) => sum + t.cantidad, 0)
      
      const tSalida = transferenciasData
        .filter((t: { productoId: string; puntoDeVentaOrigenId: string | null; cantidad: number }) => t.productoId === producto.id && t.puntoDeVentaOrigenId !== null)
        .reduce((sum: number, t: { cantidad: number }) => sum + t.cantidad, 0)

      const vTotal = getVentasProductoTotal(producto.id)

      const stockTotal = producto.stock + (tEntrada - tSalida - vTotal)
      return sum + Math.max(0, stockTotal) * Number(producto.precioCosto || 0)
    }, 0)

    // Restaurar los cálculos eliminados accidentalmente
    const totalPrecioC =
      ventaItemsData.reduce((sum: number, item: { cantidad: number; producto: { precioCosto: number | string | null } | null }) => {
        return sum + Number(item.cantidad || 0) * Number(item.producto?.precioCosto || 0)
      }, 0) +
      ventasLegacyData.reduce((sum: number, venta: { productoId: string | null; cantidad: number }) => {
        if (!venta.productoId) return sum
        return sum + Number(venta.cantidad || 0) * (precioCostoPorProducto[venta.productoId] || 0)
      }, 0)

    const totalIngresos =
      ventasData.reduce((sum: number, venta: { total: number | null }) => sum + Number(venta.total || 0), 0) +
      ventaServiciosData.reduce((sum: number, servicio: { total: number }) => sum + servicio.total, 0)

    const totalGastosMermas = mermasData.reduce((sum: number, merma: { cantidad: number; producto: { precioCosto: number | string | null } }) => {
      return sum + merma.cantidad * Number(merma.producto.precioCosto || 0)
    }, 0)

    const totalGastosDE = gastosDEData.reduce((sum: number, gasto: { monto: number }) => sum + gasto.monto, 0)
    const totalGastosSalarios = salariosData.reduce((sum: number, salario: { salario: number }) => sum + salario.salario, 0)

    const totalBeneficio = totalIngresos - totalPrecioC - totalGastosMermas - totalGastosDE - totalGastosSalarios

    // Optimized: Get all temporal data in parallel
    const fechaInicio = new Date()
    fechaInicio.setMonth(fechaInicio.getMonth() - 6)

    // Fechas para cálculos diarios (últimos 60 días)
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
      ventaServiciosDiariosData
    ] = await Promise.all([
      prisma.venta.findMany({
        where: { createdAt: { gte: fechaInicio }, ventaPadreId: null },
        select: {
          createdAt: true,
          cantidad: true,
          total: true,
        }
      }),
      prisma.ventaServicios.findMany({
        where: { createdAt: { gte: fechaInicio } },
        select: { createdAt: true, total: true, cantidad: true }
      }),
      prisma.merma.findMany({
        where: { createdAt: { gte: fechaInicio } },
        select: {
          createdAt: true,
          cantidad: true,
          producto: { select: { precioCosto: true } }
        }
      }),
      prisma.gastosDE.findMany({
        where: { createdAt: { gte: fechaInicio } },
        select: { createdAt: true, monto: true }
      }),
      prisma.pagosalario.findMany({
        where: { createdAt: { gte: fechaInicio } },
        select: { createdAt: true, salario: true }
      }),
      prisma.gastoCompra.findMany({
        where: { createdAt: { gte: fechaInicio } },
        select: { createdAt: true, total: true, cantidad: true }
      }),
      // Datos diarios para cálculos de ventas hoy/ayer/promedio
      prisma.venta.findMany({
        where: { createdAt: { gte: fechaInicioDiaria }, ventaPadreId: null },
        select: {
          createdAt: true,
          cantidad: true,
          total: true,
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.ventaServicios.findMany({
        where: { createdAt: { gte: fechaInicioDiaria } },
        select: { createdAt: true, total: true, cantidad: true },
        orderBy: { createdAt: 'desc' }
      })
    ])

    // Optimized aggregation functions with proper typing
    type MonthlyAggregation = Record<string, Record<string, number>>;
    
    interface VentaPorMesData {
      createdAt: Date;
      cantidad: number;
      total: number | null;
    }
    
    interface VentaServicioPorMesData {
      createdAt: Date;
      total: number;
      cantidad: number;
    }
    
    interface MermaPorMesData {
      createdAt: Date;
      cantidad: number;
      producto: { precioCosto: number | string | null };
    }
    
    interface GastoDePorMesData {
      createdAt: Date;
      monto: number;
    }
    
    interface GastoSalarioPorMesData {
      createdAt: Date;
      salario: number;
    }
    
    interface GastoCompraPorMesData {
      createdAt: Date;
      total: number;
      cantidad: number;
    }

    const createMonthlyAggregation = <T extends { createdAt: Date }>(
      data: T[], 
      valueFields: Record<string, (item: T) => number>
    ): MonthlyAggregation => {
      return data.reduce((acc: MonthlyAggregation, item: T) => {
        const mes = item.createdAt.toISOString().slice(0, 7)
        if (!acc[mes]) acc[mes] = {}
        Object.entries(valueFields).forEach(([key, getter]: [string, (item: T) => number]) => {
          acc[mes][key] = (acc[mes][key] || 0) + getter(item)
        })
        return acc
      }, {} as MonthlyAggregation)
    }

    const ventasAgrupadas = createMonthlyAggregation<VentaPorMesData>(ventasPorMesData as VentaPorMesData[], {
      ingresos: (venta: VentaPorMesData) => Number(venta.total || 0),
      cantidad: (venta: VentaPorMesData) => venta.cantidad
    })

    const serviciosAgrupados = createMonthlyAggregation<VentaServicioPorMesData>(ventaServicioPorMesData as VentaServicioPorMesData[], {
      ingresos: (servicio: VentaServicioPorMesData) => servicio.total,
      cantidad: (servicio: VentaServicioPorMesData) => servicio.cantidad
    })

    const mermasAgrupadas = createMonthlyAggregation<MermaPorMesData>(mermasPorMesData as MermaPorMesData[], {
      gastos: (merma: MermaPorMesData) => merma.cantidad * Number(merma.producto.precioCosto || 0),
      cantidad: (merma: MermaPorMesData) => merma.cantidad
    })

    const gastosDEAgrupados = createMonthlyAggregation<GastoDePorMesData>(gastosDeExplotacionPorMesData as GastoDePorMesData[], {
      gastosE: (gasto: GastoDePorMesData) => gasto.monto || 0,
      cantidad: () => 0
    })

    const gastosSalariosAgrupados = createMonthlyAggregation<GastoSalarioPorMesData>(gastosSalariosPorMesData as GastoSalarioPorMesData[], {
      gastos: (salario: GastoSalarioPorMesData) => salario.salario || 0,
      cantidad: () => 0
    })

    const gastosComprasAgrupados = createMonthlyAggregation<GastoCompraPorMesData>(gastosComprasPorMesData as GastoCompraPorMesData[], {
      gastos: (compra: GastoCompraPorMesData) => compra.total || 0,
      cantidad: (compra: GastoCompraPorMesData) => compra.cantidad || 0
    })
    
    //console.log('gastos de explotacion:', mermasAgrupadas);

    // Combinar datos por mes
    const mesesCompletos = new Set([...Object.keys(ventasAgrupadas), ...Object.keys(gastosDEAgrupados) , ...Object.keys(mermasAgrupadas), ...Object.keys(serviciosAgrupados), ...Object.keys(gastosComprasAgrupados), ...Object.keys(gastosSalariosAgrupados)])

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

    // Función para obtener el número de semana del año
    function getWeekNumber(date: Date): string {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
      return `${d.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`
    }

    // Optimized: Combine weekly data more efficiently
    const semanasCompletos = new Set([...Object.keys(ventasAgrupadas), ...Object.keys(gastosDEAgrupados) , ...Object.keys(mermasAgrupadas), ...Object.keys(serviciosAgrupados), ...Object.keys(gastosComprasAgrupados), ...Object.keys(gastosSalariosAgrupados)])

    const datosPorSemana = Array.from(semanasCompletos)
      .sort()
      .map((mes: string) => {
        // Convertir mes a semana (aproximadamente, usando el primer día del mes)
        const [year, month] = mes.split('-').map(Number)
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
      .sort((a: { semana: string }, b: { semana: string }) => a.semana.localeCompare(b.semana))
      .slice(-12) // Últimas 12 semanas

    // Obtener productos más vendidos (VentasItem + legacy)
    const ventasPorProducto: Record<string, number> = {
      ...ventasItemsPorProducto,
    }
    Object.entries(ventasLegacyPorProducto).forEach(([productoId, cantidad]) => {
      ventasPorProducto[productoId] = (ventasPorProducto[productoId] || 0) + cantidad
    })

    const ingresosItemsPorProducto = ventaItemsData.reduce((acc: Record<string, number>, item: { productoId: string; total: number }) => {
      acc[item.productoId] = (acc[item.productoId] || 0) + Number(item.total || 0)
      return acc
    }, {})

    const ingresosLegacyPorProducto = ventasLegacyData.reduce((acc: Record<string, number>, venta: { productoId: string | null; cantidad: number }) => {
      if (!venta.productoId) return acc
      acc[venta.productoId] =
        (acc[venta.productoId] || 0) + Number(venta.cantidad || 0) * (precioVentaPorProducto[venta.productoId] || 0)
      return acc
    }, {})

    const productosVentas = Object.entries(ventasPorProducto)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    // Una sola query batch en lugar de N+1 findUnique separados
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
      const ingresos = (ingresosItemsPorProducto[productoId] || 0) + (ingresosLegacyPorProducto[productoId] || 0)
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

    // Obtener productos con stock bajo usando lógica híbrida
    // Construir condición WHERE base para filtrado por ubicación
    const baseWhereCondition = tipoUbicacion === "almacen" && ubicacionId 
      ? { almacenId: ubicacionId }
      : tipoUbicacion === "puntoDeVenta" && ubicacionId
      ? { puntoDeVentaId: ubicacionId }
      : {};

    // Obtener todos los productos (con filtro de ubicación si aplica)
    // select limitado: sólo los campos necesarios para calcular stock bajo
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
    });

    // Definir tipos para el agrupamiento
    type ProductoConRelaciones = typeof todosLosProductos[0];
    type GrupoProducto = {
      productos: ProductoConRelaciones[];
      stockTotal: number;
      stockMinimoMin: number;
      representante: ProductoConRelaciones;
    };

    // Agrupar productos por nombre y calcular stock total
    const productosAgrupados = todosLosProductos.reduce((acc: Record<string, GrupoProducto>, producto: ProductoConRelaciones) => {
      const key = producto.nombre;
      if (!acc[key]) {
        acc[key] = {
          productos: [],
          stockTotal: 0,
          stockMinimoMin: Number.MAX_SAFE_INTEGER,
          representante: producto, // Usar el primer producto como representante
        };
      }
      
      acc[key].productos.push(producto);
      acc[key].stockTotal += producto.stock;
      
      // Usar el stockMinimo más bajo entre todas las instancias del producto
      // Si hay al menos una instancia con stockMinimo > 0, usar ese valor
      if (producto.stockMinimo > 0) {
        acc[key].stockMinimoMin = Math.min(acc[key].stockMinimoMin, producto.stockMinimo);
      }
      
      return acc;
    }, {} as Record<string, GrupoProducto>);

    // Filtrar productos con stock bajo usando lógica híbrida
    const productosStockBajo: (ProductoConRelaciones & {
      stockTotal: number;
      stockMinimo: number;
      diferencia: number;
      umbralUsado: number;
    })[] = [];
    
    for (const nombreProducto in productosAgrupados) {
      const grupo = productosAgrupados[nombreProducto];
      const stockTotal = grupo.stockTotal;
      const stockMinimo = grupo.stockMinimoMin === Number.MAX_SAFE_INTEGER ? 0 : grupo.stockMinimoMin;
      
      // Lógica híbrida: usar stockMinimo si > 0, sino usar umbral por defecto de 10
      const umbral = stockMinimo > 0 ? stockMinimo : 10;
      
      if (stockTotal < umbral) {
        const diferencia = umbral - stockTotal;
        
        productosStockBajo.push({
          ...grupo.representante,
          stockTotal,
          stockMinimo,
          diferencia,
          umbralUsado: umbral,
        });
      }
    }

    // Ordenar por stock total ascendente y limitar a 5
    productosStockBajo.sort((a: typeof productosStockBajo[0], b: typeof productosStockBajo[0]) => a.stockTotal - b.stockTotal);
    productosStockBajo.splice(5); // Mantener solo los primeros 5
    

    // Obtener productos con stock bajo (menos de 10 unidades)
    // const productosStockBajo = await prisma.producto.findMany({
    //   where: {
        
    //     stock: {
    //       lt: 10,
    //     },
    //   },
    //   include: {
    //     categoria: true,
    //     unidad: true,
    //   },
    //   orderBy: {
    //     stock: "asc",
    //   },
    //   take: 5,
    // })

    // Estadísticas de transferencias por tipo
    const transferenciasStats = {
      almacenAAlmacen: transferenciasData.filter((t: { origenId: string | null; destinoId: string | null }) => t.origenId && t.destinoId).length,
      almacenAPuntoVenta: transferenciasData.filter((t: { origenId: string | null; puntoDeVentaDestinoId: string | null }) => t.origenId && t.puntoDeVentaDestinoId).length,
      puntoVentaAAlmacen: transferenciasData.filter((t: { puntoDeVentaOrigenId: string | null; destinoId: string | null }) => t.puntoDeVentaOrigenId && t.destinoId).length,
      puntoVentaAPuntoVenta: transferenciasData.filter((t: { puntoDeVentaOrigenId: string | null; puntoDeVentaDestinoId: string | null }) => t.puntoDeVentaOrigenId && t.puntoDeVentaDestinoId).length,
    }

    // Distribución de stock por categoría
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

    const distribucionStock = stockPorCategoria.map((categoria: { nombre: string; productos: { stock: number; precioCosto: number | string | null }[] }) => ({
      categoria: categoria.nombre,
      productos: categoria.productos.length,
      stockTotal: categoria.productos.reduce((sum: number, p: { stock: number }) => sum + p.stock, 0),
      valorTotal: categoria.productos.reduce((sum: number, p: { stock: number; precioCosto: number | string | null }) => sum + p.stock * Number(p.precioCosto), 0),
    }))

    // Type definitions for daily sales calculation
    interface VentaDiariaData {
      createdAt: Date;
      cantidad: number;
      total: number | null;
    }
    
    interface VentaServicioDiariaData {
      createdAt: Date;
      total: number;
      cantidad: number;
    }
    
    interface DiaVentas {
      ingresos: number;
      cantidad: number;
    }

    // Cálculo de ventas diarias para dashboard
    const calcularVentasDiarias = () => {
      const hoy = new Date()
      const ayer = new Date()
      ayer.setDate(ayer.getDate() - 1)

      // Formatear fechas para comparar (YYYY-MM-DD)
      const formatoFecha = (fecha: Date) => fecha.toISOString().split('T')[0]
      
      const fechaHoy = formatoFecha(hoy)
      const fechaAyer = formatoFecha(ayer)

      // Calcular ventas del día actual
      const ventasHoy = ventasDiariasData.filter((venta: VentaDiariaData) => 
        formatoFecha(venta.createdAt) === fechaHoy
      )
      const ventasServiciosHoy = ventaServiciosDiariosData.filter((servicio: VentaServicioDiariaData) => 
        formatoFecha(servicio.createdAt) === fechaHoy
      )

      // Calcular ventas del día anterior
      const ventasAyer = ventasDiariasData.filter((venta: VentaDiariaData) => 
        formatoFecha(venta.createdAt) === fechaAyer
      )
      const ventasServiciosAyer = ventaServiciosDiariosData.filter((servicio: VentaServicioDiariaData) => 
        formatoFecha(servicio.createdAt) === fechaAyer
      )

      // Calcular ingresos y cantidades
      const calcularDia = (ventas: VentaDiariaData[], servicios: VentaServicioDiariaData[]) => {
        const ingresosVentas = ventas.reduce((sum: number, venta: VentaDiariaData) => 
          sum + Number(venta.total || 0), 0
        )
        const ingresosServicios = servicios.reduce((sum: number, servicio: VentaServicioDiariaData) => sum + servicio.total, 0)
        const cantidadVentas = ventas.reduce((sum: number, venta: VentaDiariaData) => sum + venta.cantidad, 0)
        const cantidadServicios = servicios.reduce((sum: number, servicio: VentaServicioDiariaData) => sum + (servicio.cantidad || 0), 0)
        
        return {
          ingresos: ingresosVentas + ingresosServicios,
          cantidad: cantidadVentas + cantidadServicios
        }
      }

      const datosHoy = calcularDia(ventasHoy, ventasServiciosHoy)
      const datosAyer = calcularDia(ventasAyer, ventasServiciosAyer)

      // Calcular promedio diario de los últimos 60 días
      const ventasPorDia = new Map<string, DiaVentas>()
      
      // Agrupar todas las ventas por día
      const todosLosItems: (VentaDiariaData | VentaServicioDiariaData)[] = [...ventasDiariasData, ...ventaServiciosDiariosData]
      todosLosItems.forEach((item: VentaDiariaData | VentaServicioDiariaData) => {
        const fecha = formatoFecha(item.createdAt)
        const datosDia = ventasPorDia.get(fecha) || { ingresos: 0, cantidad: 0 }
        ventasPorDia.set(fecha, datosDia)
        
        if ('total' in item) {
          // Es una venta
          const venta = item as VentaDiariaData
          datosDia.ingresos += Number(venta.total || 0)
          datosDia.cantidad += venta.cantidad
        } else {
          // Es un servicio
          const servicio = item as VentaServicioDiariaData
          datosDia.ingresos += servicio.total
          datosDia.cantidad += servicio.cantidad || 0
        }
      })

      // Calcular promedios
      const diasAnalizados = Array.from(ventasPorDia.values())
      const totalIngresos = diasAnalizados.reduce((sum: number, dia: DiaVentas) => sum + dia.ingresos, 0)
      const totalCantidad = diasAnalizados.reduce((sum: number, dia: DiaVentas) => sum + dia.cantidad, 0)
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
        totalCantidadPeriodo: totalCantidad
      }
    }

    const ventasDiarias = calcularVentasDiarias()

const result = {
  // Estadísticas generales
  totalProductos,
  totalAlmacenes,
  totalPuntosVenta,
  totalVentas: ventasData.length,
  totalMermas: mermasData.length,
  totalTransferencias: transferenciasData.length,

  // Financieras
  totalIngresos,
  totalGastosMermas,
  totalBeneficio,
  valorTotalInventario,

  // Datos temporales
  datosPorMes,
  datosPorSemana,

  // Ventas diarias calculadas
  ventasDiarias,

  // Rankings
  productosMasVendidos,
  productosStockBajo,

  // Distribuciones
  distribucionStock,
  transferenciasStats,
}

// Cache the result
cache.set(cacheKey, { data: result, timestamp: Date.now() })

return NextResponse.json(result)
   } catch (error) {
     console.error("Error al obtener estadísticas del dashboard:", error)
     return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 })
   }
})

// Endpoint para invalidar el cache del dashboard
export async function DELETE() {
  try {
    invalidateDashboardCache()
    return NextResponse.json({ message: 'Dashboard cache invalidated successfully' })
  } catch (error) {
    console.error('Error invalidating dashboard cache:', error)
    return NextResponse.json({ error: 'Failed to invalidate cache' }, { status: 500 })
  }
}
