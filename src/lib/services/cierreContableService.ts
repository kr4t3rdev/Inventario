import { prisma } from '@/lib/prisma';
import { getReconciledResultForYear } from '@/features/contabilidad/services/reconciled-result-service';
import { getAccountingYear } from '@/lib/services/fecha-operacion-registry';
import { endOfDay } from '@/lib/date-range';

/**
 * Calcula estadísticas para un cierre contable
 * @param tenantId - ID del tenant (obligatorio para multi-tenant)
 * @param fechaInicio - Fecha de inicio del período
 * @param fechaFin - Fecha de fin del período
 * @returns Estadísticas calculadas
 */
export async function calcularEstadisticasCierre(tenantId: string, fechaInicio: Date, fechaFin: Date) {
  const canonicalResult = await getReconciledResultForYear({
    tenantId,
    year: getAccountingYear(fechaFin),
    startAt: fechaInicio,
    cutoffAt: endOfDay(fechaFin.toISOString()),
  });
  const annual = canonicalResult.annual;
  // Caja real: ingresos por cobros reconciliados y egresos por pagos operativos más compras.
  // El COGS es reconocimiento accrual proporcional al ingreso; no es salida de dinero.
  const totalIngresosCaja = annual.income.total;
  const totalEgresosCaja = annual.operatingExpenses.total + annual.inventoryPurchases;
  const totalIngresosAccrual = annual.income.total;

  // Gastos Totales (Operativos + Salarios + Compras + Mermas)
  const total_merma = await prisma.merma.aggregate({
    _sum: { costoTotal: true },
    where: {
      tenantId,
      createdAt: { gte: fechaInicio, lte: fechaFin },
    },
  });

  const totalGastosAccrual = annual.costOfSales.total + annual.operatingExpenses.total;

  // Ganancias/Perdidas (Usamos Accrual para el rendimiento real del negocio)
  const resultadoPeriodo = annual.reconciledResult;
  const ganancias = Math.max(resultadoPeriodo, 0);
  const perdidas = Math.max(-resultadoPeriodo, 0);

  // Deudas Clientes: ventas no reconciliadas en el periodo
  const deudasClientes = await prisma.venta.aggregate({
    _sum: { total: true },
    where: {
      tenantId,
      createdAt: { gte: fechaInicio, lte: fechaFin },
      reconciliaciones: { none: {} },
    },
  });

  // Deudas Proveedores: compras no pagadas en el periodo
  const deudasProveedores = await prisma.gastoCompra.aggregate({
    _sum: { total: true },
    where: {
      tenantId,
      fechaCompra: { gte: fechaInicio, lte: fechaFin },
      reconciliaciones: { none: {} },
    },
  });

  // Inventario Vendido: suma de cantidades vendidas
  const inventarioVendido = await prisma.venta.aggregate({
    _sum: {
      cantidad: true,
    },
    where: {
      tenantId,
      createdAt: {
        gte: fechaInicio,
        lte: fechaFin,
      },
    },
  });

  // Inventario Rebajado: suma de mermas
  const inventarioRebajado = await prisma.merma.aggregate({
    _sum: {
      cantidad: true,
    },
    where: {
      tenantId,
      createdAt: {
        gte: fechaInicio,
        lte: fechaFin,
      },
    },
  });

  // Stock Final: suma de stock actual de productos del tenant
  const stockFinal = await prisma.producto.aggregate({
    _sum: {
      stock: true,
    },
    where: { tenantId },
  });

  // Márgenes
  const margenGanancia = totalIngresosAccrual > 0 ? (ganancias / totalIngresosAccrual) * 100 : 0;
  const margenPerdida = totalIngresosAccrual > 0 ? (perdidas / totalIngresosAccrual) * 100 : 0;

  // Análisis comparativo
  const totalExistenciasMovidas = (inventarioVendido._sum.cantidad || 0) + (inventarioRebajado._sum.cantidad || 0);
  const ventasVsExistencias = totalExistenciasMovidas > 0 ? `Ventas representan ${(inventarioVendido._sum.cantidad || 0) / totalExistenciasMovidas * 100}% de movimientos de inventario` : "Sin movimientos";

  return {
    totalVentas: totalIngresosAccrual,
    totalGastos: totalGastosAccrual,
    ingresosCaja: totalIngresosCaja,
    egresosCaja: totalEgresosCaja,
    ganancias,
    perdidas,
    deudasClientes: deudasClientes._sum.total || 0,
    deudasProveedores: deudasProveedores._sum.total || 0,
    inventarioVendido: inventarioVendido._sum.cantidad || 0,
    inventarioRebajado: inventarioRebajado._sum.cantidad || 0,
    stockFinal: stockFinal._sum.stock || 0,
    margenGanancia,
    margenPerdida,
    ventasVsExistencias,
  };
}

/**
 * Crea un cierre contable con cálculos automáticos
 * @param tipo - Tipo de cierre
 * @param fechaInicio - Fecha inicio
 * @param fechaFin - Fecha fin
 * @param creadoPor - Usuario que crea
 * @param observaciones - Observaciones opcionales
 * @returns Cierre creado
 */
export async function crearCierreContable(
  tenantId: string,
  tipo: string,
  fechaInicio: Date,
  fechaFin: Date,
  creadoPor: string,
  observaciones?: string
) {
  const estadisticas = await calcularEstadisticasCierre(tenantId, fechaInicio, fechaFin);

  const cierre = await prisma.cierreContable.create({
    data: {
      tenantId,
      tipo,
      fechaInicio,
      fechaFin,
      ...estadisticas,
      creadoPor,
      observaciones,
    },
  });

  return cierre;
}
