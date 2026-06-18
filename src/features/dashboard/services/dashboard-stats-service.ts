import { endOfDay, startOfDay } from 'date-fns';

import { prisma } from '@/lib/prisma';
import type {
  CacheEntry,
  DiaVentas,
  GastoCompraPorMesData,
  GastoDePorMesData,
  GastoSalarioPorMesData,
  MermaPorMesData,
  MonthlyAggregation,
  TransferenciaData,
  VentaDiariaData,
  VentaPorMesData,
  VentaServicioDiariaData,
  VentaServicioPorMesData,
} from '@/features/dashboard/api/types';

interface DashboardStatsArgs {
  tenantId: string;
  ubicacionId?: string | null;
  tipoUbicacion?: string | null;
}

interface ProductoDashboard {
  id: string;
  nombre: string;
  stock: number;
  stockMinimo: number;
  precioCosto?: number | null;
  precioVenta?: number | null;
  almacenId?: string | null;
  puntoDeVentaId?: string | null;
  categoria?: { nombre: string } | null;
  unidad?: { simbolo: string } | null;
}

interface TopProductoData {
  id: string;
  nombre: string;
  stock: number;
  categoria: { nombre: string } | null;
}

interface ProductoStockBajoData {
  id: string;
  nombre: string;
  stock: number;
  stockMinimo: number;
  categoria: { nombre: string } | null;
  unidad: { simbolo: string } | null;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 30 * 1000;

/**
 * @description Invalidates cached dashboard stats.
 * @returns {void} No return value.
 */
export function invalidateDashboardStatsCache(): void {
  const keysToDelete = Array.from(cache.keys()).filter((key) => key.startsWith('dashboard-stats-'));
  keysToDelete.forEach((key) => cache.delete(key));
}

/**
 * @description Returns tenant-scoped dashboard statistics using the legacy dashboard behavior.
 * @param {DashboardStatsArgs} args - Tenant and optional location filters.
 * @returns {Promise<Record<string, unknown>>} Dashboard stats payload.
 */
export async function getDashboardStatsData({
  tenantId,
  ubicacionId,
  tipoUbicacion,
}: DashboardStatsArgs): Promise<Record<string, unknown>> {
  const cacheKey = `dashboard-stats-${tenantId}-${ubicacionId || 'all'}-${tipoUbicacion || 'all'}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as Record<string, unknown>;
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
      select: { total: true, createdAt: true, cantidad: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.merma.findMany({
      where: { tenantId },
      select: {
        cantidad: true,
        createdAt: true,
        producto: { select: { precioCosto: true } },
      },
    }),
    prisma.gastosDE.findMany({
      where: { tenantId },
      select: { monto: true, createdAt: true },
      orderBy: { periodo: 'desc' },
    }),
    prisma.pagosalario.findMany({
      where: { tenantId },
      select: { salario: true, bonificaciones: true, horasExtras: true, createdAt: true },
      orderBy: { periodo: 'desc' },
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
  ]);

  const ventasItemsPorProducto = ventaItemsData.reduce<Record<string, number>>((acc, item) => {
    if (!item.productoId) {
      return acc;
    }

    acc[item.productoId] = (acc[item.productoId] || 0) + Number(item.cantidad || 0);
    return acc;
  }, {});

  const ventasLegacyPorProducto = ventasLegacyData.reduce<Record<string, number>>((acc, venta) => {
    if (!venta.productoId) {
      return acc;
    }

    acc[venta.productoId] = (acc[venta.productoId] || 0) + Number(venta.cantidad || 0);
    return acc;
  }, {});

  const getVentasProductoTotal = (productoId: string): number => {
    return (ventasItemsPorProducto[productoId] || 0) + (ventasLegacyPorProducto[productoId] || 0);
  };

  const precioCostoPorProducto = productosDataRaw.reduce<Record<string, number>>((acc, producto) => {
    acc[producto.id] = Number(producto.precioCosto || 0);
    return acc;
  }, {});

  const precioVentaPorProducto = productosDataRaw.reduce<Record<string, number>>((acc, producto) => {
    acc[producto.id] = Number(producto.precioVenta || 0);
    return acc;
  }, {});

  // Pre-calcular transferencias por producto (O(n) en vez de O(n*m))
  const transferenciasEntradaPorProducto = new Map<string, number>();
  const transferenciasSalidaPorProducto = new Map<string, number>();

  for (const t of transferenciasData) {
    if (t.puntoDeVentaDestinoId) {
      transferenciasEntradaPorProducto.set(
        t.productoId,
        (transferenciasEntradaPorProducto.get(t.productoId) || 0) + t.cantidad
      );
    }
    if (t.puntoDeVentaOrigenId) {
      transferenciasSalidaPorProducto.set(
        t.productoId,
        (transferenciasSalidaPorProducto.get(t.productoId) || 0) + t.cantidad
      );
    }
  }

  const valorTotalInventario = productosDataRaw.reduce((sum, producto) => {
    const transferenciaEntrada = transferenciasEntradaPorProducto.get(producto.id) || 0;
    const transferenciaSalida = transferenciasSalidaPorProducto.get(producto.id) || 0;
    const ventasTotales = getVentasProductoTotal(producto.id);
    const stockTotal = producto.stock + (transferenciaEntrada - transferenciaSalida - ventasTotales);

    return sum + Math.max(0, stockTotal) * Number(producto.precioCosto || 0);
  }, 0);

  const totalPrecioCosto =
    ventaItemsData.reduce((sum, item) => {
      return sum + Number(item.cantidad || 0) * Number(item.producto?.precioCosto || 0);
    }, 0) +
    ventasLegacyData.reduce((sum, venta) => {
      if (!venta.productoId) {
        return sum;
      }

      return sum + Number(venta.cantidad || 0) * (precioCostoPorProducto[venta.productoId] || 0);
    }, 0);

  // Calcular totalIngresos incluyendo ventas legacy correctamente
  const totalIngresos =
    // Ingresos de ventas con items (suma de item.total)
    ventaItemsData.reduce((sum, item) => sum + Number(item.total || 0), 0) +
    // Ingresos de ventas legacy (cantidad * precioVenta)
    ventasLegacyData.reduce((sum, venta) => {
      if (!venta.productoId) return sum;
      return sum + Number(venta.cantidad || 0) * (precioVentaPorProducto[venta.productoId] || 0);
    }, 0) +
    // Ingresos de servicios
    ventaServiciosData.reduce((sum, servicio) => sum + Number(servicio.total || 0), 0);

  const totalGastosMermas = mermasData.reduce((sum, merma) => {
    return sum + merma.cantidad * Number(merma.producto?.precioCosto || 0);
  }, 0);

  const totalGastosDE = gastosDEData.reduce((sum, gasto) => sum + Number(gasto.monto || 0), 0);
  const totalGastosSalarios = salariosData.reduce(
    (sum, salario) => sum + Number(salario.salario || 0) + Number(salario.bonificaciones || 0) + Number(salario.horasExtras || 0),
    0
  );

  const totalBeneficio =
    totalIngresos - totalPrecioCosto - totalGastosMermas - totalGastosDE - totalGastosSalarios;

  const fechaInicio = new Date();
  fechaInicio.setMonth(fechaInicio.getMonth() - 6);

  const fechaInicioDiaria = new Date();
  fechaInicioDiaria.setDate(fechaInicioDiaria.getDate() - 60);

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
      select: { createdAt: true, cantidad: true, total: true },
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
      select: { createdAt: true, salario: true, bonificaciones: true, horasExtras: true },
    }),
    prisma.gastoCompra.findMany({
      where: { tenantId, createdAt: { gte: fechaInicio } },
      select: { createdAt: true, total: true, cantidad: true },
    }),
    prisma.venta.findMany({
      where: { tenantId, createdAt: { gte: fechaInicioDiaria }, ventaPadreId: null },
      select: { createdAt: true, cantidad: true, total: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ventaServicios.findMany({
      where: { tenantId, createdAt: { gte: fechaInicioDiaria } },
      select: { createdAt: true, total: true, cantidad: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const createMonthlyAggregation = <T extends { createdAt: Date }>(
    data: T[],
    valueFields: Record<string, (item: T) => number>,
  ): MonthlyAggregation => {
    return data.reduce<MonthlyAggregation>((acc, item) => {
      const mes = item.createdAt.toISOString().slice(0, 7);
      if (!acc[mes]) {
        acc[mes] = {};
      }

      Object.entries(valueFields).forEach(([key, getter]) => {
        acc[mes][key] = (acc[mes][key] || 0) + getter(item);
      });

      return acc;
    }, {});
  };

  const ventasAgrupadas = createMonthlyAggregation(ventasPorMesData as VentaPorMesData[], {
    ingresos: (venta) => Number(venta.total || 0),
    cantidad: (venta) => venta.cantidad,
  });

  const serviciosAgrupados = createMonthlyAggregation(
    ventaServicioPorMesData as VentaServicioPorMesData[],
    {
      ingresos: (servicio) => Number(servicio.total || 0),
      cantidad: (servicio) => servicio.cantidad,
    },
  );

  const mermasAgrupadas = createMonthlyAggregation(mermasPorMesData as MermaPorMesData[], {
    gastos: (merma) => merma.cantidad * Number(merma.producto.precioCosto || 0),
    cantidad: (merma) => merma.cantidad,
  });

  const gastosDEAgrupados = createMonthlyAggregation(
    gastosDeExplotacionPorMesData as GastoDePorMesData[],
    {
      gastosE: (gasto) => gasto.monto || 0,
      cantidad: () => 0,
    },
  );

  const gastosSalariosAgrupados = createMonthlyAggregation(
    gastosSalariosPorMesData as GastoSalarioPorMesData[],
    {
      gastos: (salario) => (salario.salario || 0) + (salario.bonificaciones || 0) + (salario.horasExtras || 0),
      cantidad: () => 0,
    },
  );

  const gastosComprasAgrupados = createMonthlyAggregation(
    gastosComprasPorMesData as GastoCompraPorMesData[],
    {
      gastos: (compra) => compra.total || 0,
      cantidad: (compra) => compra.cantidad || 0,
    },
  );

  const mesesCompletos = new Set([
    ...Object.keys(ventasAgrupadas),
    ...Object.keys(gastosDEAgrupados),
    ...Object.keys(mermasAgrupadas),
    ...Object.keys(serviciosAgrupados),
    ...Object.keys(gastosComprasAgrupados),
    ...Object.keys(gastosSalariosAgrupados),
  ]);

  const datosPorMes = Array.from(mesesCompletos)
    .sort()
    .map((mes) => ({
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
      ventasServiciosCantidad: Number(serviciosAgrupados[mes]?.cantidad) || 0,
      mermasCantidad: mermasAgrupadas[mes]?.cantidad || 0,
    }));

  const getWeekNumber = (date: Date): string => {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

    return `${utcDate.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
  };

  const semanasCompletas = Array.from(mesesCompletos)
    .sort()
    .map((mes) => {
      const [year, month] = mes.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      const semana = getWeekNumber(date);

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
        ventasServiciosCantidad: Number(serviciosAgrupados[mes]?.cantidad) || 0,
        mermasCantidad: mermasAgrupadas[mes]?.cantidad || 0,
      };
    })
    .sort((a, b) => a.semana.localeCompare(b.semana))
    .slice(-12);

  const ventasPorProducto: Record<string, number> = { ...ventasItemsPorProducto };
  Object.entries(ventasLegacyPorProducto).forEach(([productoId, cantidad]) => {
    ventasPorProducto[productoId] = (ventasPorProducto[productoId] || 0) + Number(cantidad);
  });

  const ingresosItemsPorProducto = ventaItemsData.reduce<Record<string, number>>((acc, item) => {
    if (!item.productoId) {
      return acc;
    }

    acc[item.productoId] = (acc[item.productoId] || 0) + Number(item.total || 0);
    return acc;
  }, {});

  const ingresosLegacyPorProducto = ventasLegacyData.reduce<Record<string, number>>((acc, venta) => {
    if (!venta.productoId) {
      return acc;
    }

    acc[venta.productoId] =
      (acc[venta.productoId] || 0) +
      Number(venta.cantidad || 0) * (precioVentaPorProducto[venta.productoId] || 0);
    return acc;
  }, {});

  const productosVentas = Object.entries(ventasPorProducto)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topProductoIds = productosVentas.map(([productoId]) => productoId);
  const topProductosData = await prisma.producto.findMany({
    where: { tenantId, id: { in: topProductoIds } },
    select: {
      id: true,
      nombre: true,
      stock: true,
      categoria: { select: { nombre: true } },
    },
  }) as TopProductoData[];
  const topProductosMap = new Map(topProductosData.map((producto) => [producto.id, producto]));

  const productosMasVendidos = productosVentas
    .map(([productoId, cantidad]) => {
      const producto = topProductosMap.get(productoId);
      const ingresos =
        (ingresosItemsPorProducto[productoId] || 0) + (ingresosLegacyPorProducto[productoId] || 0);

      return {
        id: producto?.id || productoId,
        nombre: producto?.nombre || '',
        categoria: producto?.categoria?.nombre || '',
        ventas: cantidad,
        ingresos,
        stock: producto?.stock || 0,
      };
    })
    .filter(Boolean);

  const baseWhereCondition =
    tipoUbicacion === 'almacen' && ubicacionId
      ? { tenantId, almacenId: ubicacionId }
      : tipoUbicacion === 'puntoDeVenta' && ubicacionId
        ? { tenantId, puntoDeVentaId: ubicacionId }
        : { tenantId };

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
  }) as ProductoStockBajoData[];

  type GrupoProducto = {
    productos: ProductoStockBajoData[];
    stockTotal: number;
    stockMinimoMin: number;
    representante: ProductoStockBajoData;
  };

  const productosAgrupados = todosLosProductos.reduce<Record<string, GrupoProducto>>((acc, producto) => {
    const key = producto.nombre;
    if (!acc[key]) {
      acc[key] = {
        productos: [],
        stockTotal: 0,
        stockMinimoMin: Number.MAX_SAFE_INTEGER,
        representante: producto,
      };
    }

    acc[key].productos.push(producto);
    acc[key].stockTotal += producto.stock;

    if (producto.stockMinimo > 0) {
      acc[key].stockMinimoMin = Math.min(acc[key].stockMinimoMin, producto.stockMinimo);
    }

    return acc;
  }, {});

  const productosStockBajo: Array<ProductoStockBajoData & {
    stockTotal: number;
    stockMinimo: number;
    diferencia: number;
    umbralUsado: number;
  }> = [];

  Object.values(productosAgrupados).forEach((grupo) => {
    const stockTotal = grupo.stockTotal;
    const stockMinimo =
      grupo.stockMinimoMin === Number.MAX_SAFE_INTEGER ? 0 : grupo.stockMinimoMin;
    const umbral = stockMinimo > 0 ? stockMinimo : 10;

    if (stockTotal < umbral) {
      productosStockBajo.push({
        ...grupo.representante,
        stockTotal,
        stockMinimo,
        diferencia: umbral - stockTotal,
        umbralUsado: umbral,
      });
    }
  });

  productosStockBajo.sort((a, b) => a.stockTotal - b.stockTotal);
  productosStockBajo.splice(5);

  const transferenciasStats = {
    almacenAAlmacen: transferenciasData.filter((transferencia) => {
      return transferencia.origenId && transferencia.destinoId;
    }).length,
    almacenAPuntoVenta: transferenciasData.filter((transferencia) => {
      return transferencia.origenId && transferencia.puntoDeVentaDestinoId;
    }).length,
    puntoVentaAAlmacen: transferenciasData.filter((transferencia) => {
      return transferencia.puntoDeVentaOrigenId && transferencia.destinoId;
    }).length,
    puntoVentaAPuntoVenta: transferenciasData.filter((transferencia) => {
      return transferencia.puntoDeVentaOrigenId && transferencia.puntoDeVentaDestinoId;
    }).length,
  };

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
  });

  const distribucionStock = stockPorCategoria.map((categoria) => ({
    categoria: categoria.nombre,
    productos: categoria.productos.length,
    stockTotal: categoria.productos.reduce((sum, producto) => sum + producto.stock, 0),
    valorTotal: categoria.productos.reduce((sum, producto) => {
      return sum + producto.stock * Number(producto.precioCosto || 0);
    }, 0),
  }));

  const calcularVentasDiarias = (): DiaVentas & Record<string, number> => {
    const now = new Date();
    const today = startOfDay(now);
    const yesterday = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

    const dataToday: DiaVentas = { ingresos: 0, cantidad: 0 };
    const dataYesterday: DiaVentas = { ingresos: 0, cantidad: 0 };
    const ventasPorDia = new Map<string, DiaVentas>();

    const mergeDailyEntry = (createdAt: Date, ingresos: number, cantidad: number) => {
      const day = startOfDay(createdAt);
      const key = day.toISOString().split('T')[0];
      const current = ventasPorDia.get(key) || { ingresos: 0, cantidad: 0 };
      current.ingresos += ingresos;
      current.cantidad += cantidad;
      ventasPorDia.set(key, current);

      if (day.getTime() === today.getTime()) {
        dataToday.ingresos += ingresos;
        dataToday.cantidad += cantidad;
      }

      if (day.getTime() === yesterday.getTime()) {
        dataYesterday.ingresos += ingresos;
        dataYesterday.cantidad += cantidad;
      }
    };

    (ventasDiariasData as VentaDiariaData[]).forEach((venta) => {
      mergeDailyEntry(venta.createdAt, Number(venta.total || 0), venta.cantidad);
    });

    (ventaServiciosDiariosData as VentaServicioDiariaData[]).forEach((servicio) => {
      mergeDailyEntry(servicio.createdAt, Number(servicio.total || 0), servicio.cantidad || 0);
    });

    const cutoff = endOfDay(today).getTime() - 60 * 24 * 60 * 60 * 1000;
    const diasAnalizados = Array.from(ventasPorDia.entries())
      .filter(([key]) => new Date(key).getTime() >= cutoff)
      .map(([, value]) => value);

    const totalIngresosPeriodo = diasAnalizados.reduce((sum, dia) => sum + dia.ingresos, 0);
    const totalCantidadPeriodo = diasAnalizados.reduce((sum, dia) => sum + dia.cantidad, 0);
    const diasConVentas = diasAnalizados.filter((dia) => dia.ingresos > 0).length;
    const totalDias = diasAnalizados.length;

    return {
      ventasHoy: dataToday.cantidad,
      ingresosHoy: dataToday.ingresos,
      ventasAyer: dataYesterday.cantidad,
      ingresosAyer: dataYesterday.ingresos,
      promedioVentasDiarias: diasConVentas > 0 ? totalCantidadPeriodo / diasConVentas : 0,
      promedioIngresosDiarios: diasConVentas > 0 ? totalIngresosPeriodo / diasConVentas : 0,
      diasConVentas,
      totalDias,
      totalIngresosPeriodo,
      totalCantidadPeriodo,
      ingresos: 0,
      cantidad: 0,
    };
  };

  const ventasDiarias = calcularVentasDiarias();
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
    datosPorSemana: semanasCompletas,
    ventasDiarias,
    productosMasVendidos,
    productosStockBajo,
    distribucionStock,
    transferenciasStats,
  };

  cache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}
