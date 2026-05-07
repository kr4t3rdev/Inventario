import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

/**
 * Calcula estadísticas para un cierre contable
 * @param fechaInicio - Fecha de inicio del período
 * @param fechaFin - Fecha de fin del período
 * @returns Estadísticas calculadas
 */
export async function calcularEstadisticasCierre(fechaInicio: Date, fechaFin: Date) {
  // --- FLUJO DE CAJA (CASH BASIS) ---
  // Basado en reconciliaciones (dinero que realmente entró o salió)

  // Total Ventas Reconciliadas
  const totalVentasRec = await prisma.reconciliacionVenta.aggregate({
    _sum: { montoConvertido: true },
    where: {
      fechaReconciliacion: { gte: fechaInicio, lte: fechaFin },
    },
  });

  // Total Servicios Reconciliados
  const totalServiciosRec = await prisma.reconciliacionServicio.aggregate({
    _sum: { montoConvertido: true },
    where: {
      fechaReconciliacion: { gte: fechaInicio, lte: fechaFin },
    },
  });

  const totalIngresosCaja = (Number(totalVentasRec._sum.montoConvertido || 0)) + (Number(totalServiciosRec._sum.montoConvertido || 0));

  // Total Gastos Reconciliados (Pagados)
  const totalGastosPagados = await prisma.reconciliacionGasto.aggregate({
    _sum: { montoConvertido: true },
    where: {
      fechaReconciliacion: { gte: fechaInicio, lte: fechaFin },
    },
  });

  const totalEgresosCaja = Number(totalGastosPagados._sum.montoConvertido || 0);

  // --- RENDIMIENTO ECONÓMICO (ACCRUAL BASIS) ---
  // Basado en registros (lo que se devengó, se haya pagado o no)

  // Ventas Totales
  const ventasTotalesAccrual = await prisma.venta.aggregate({
    _sum: { total: true },
    where: {
      createdAt: { gte: fechaInicio, lte: fechaFin },
    },
  });

  // Servicios Totales
  const serviciosTotalesAccrual = await prisma.ventaServicios.aggregate({
    _sum: { total: true },
    where: {
      createdAt: { gte: fechaInicio, lte: fechaFin },
    },
  });

  const totalIngresosAccrual = Number(ventasTotalesAccrual._sum.total || 0) + Number(serviciosTotalesAccrual._sum.total || 0);

  // Gastos Totales (Operativos + Salarios + Compras + Mermas)
  const total_merma = await prisma.merma.aggregate({
    _sum: { costoTotal: true },
    where: {
      createdAt: { gte: fechaInicio, lte: fechaFin },
    },
  });

  const total_salario = await prisma.pagosalario.aggregate({
    _sum: { salario: true },
    where: {
      createdAt: { gte: fechaInicio, lte: fechaFin },
    }
  });

  const total_gastos_operacion = await prisma.gastosDE.aggregate({
    _sum: { monto: true },
    where: {
      createdAt: { gte: fechaInicio, lte: fechaFin },
    }
  });

  const total_compras = await prisma.gastoCompra.aggregate({
    _sum: { total: true },
    where: {
      fechaCompra: { gte: fechaInicio, lte: fechaFin },
    }
  });

  const totalGastosAccrual = 
    Number(total_gastos_operacion._sum.monto || 0) + 
    Number(total_merma._sum.costoTotal || 0) + 
    Number(total_salario._sum.salario || 0) +
    Number(total_compras._sum.total || 0);

  // Ganancias/Perdidas (Usamos Accrual para el rendimiento real del negocio)
  const ganancias = totalIngresosAccrual > totalGastosAccrual ? totalIngresosAccrual - totalGastosAccrual : 0;
  const perdidas = totalGastosAccrual > totalIngresosAccrual ? totalGastosAccrual - totalIngresosAccrual : 0;

  // Deudas Clientes: ventas no reconciliadas en el periodo
  const deudasClientes = await prisma.venta.aggregate({
    _sum: { total: true },
    where: {
      createdAt: { gte: fechaInicio, lte: fechaFin },
      reconciliaciones: { none: {} },
    },
  });

  // Deudas Proveedores: compras no pagadas en el periodo
  const deudasProveedores = await prisma.gastoCompra.aggregate({
    _sum: { total: true },
    where: {
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
      createdAt: {
        gte: fechaInicio,
        lte: fechaFin,
      },
    },
  });

  // Stock Final: suma de stock actual de productos
  const stockFinal = await prisma.producto.aggregate({
    _sum: {
      stock: true,
    },
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
  const estadisticas = await calcularEstadisticasCierre(fechaInicio, fechaFin);

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
