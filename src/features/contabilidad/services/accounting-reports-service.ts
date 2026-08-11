import { prisma } from '@/lib/prisma';
import { AccountingAccountsService } from '@/features/contabilidad/services/accounting-accounts-service';
import { endOfDay } from '@/lib/date-range';

interface CuentaBancariaResumen {
  cuentaId: string;
  nombreBanco: string;
  numeroCuenta: string;
  saldo: number;
  moneda: string | null;
  tipoCuenta?: string;
}

interface ExchangeStat {
  totalTransacciones: number;
  montoTotalOriginal: number;
  montoTotalConvertido: number;
  tasaPromedio: number;
  tasaMinima: number;
  tasaMaxima: number;
}

interface ExchangeConversion {
  id: string;
  tipo: string;
  fecha: Date;
  montoOriginal: number;
  monedaOriginal: string;
  montoConvertido: number;
  monedaDestino: string;
  tasaCambio: number;
  referencia: string | null;
  descripcion: string;
}

interface ExchangeImpactConversion {
  id: string;
  fecha: Date;
  tipo: string;
  monedaOriginal: string;
  montoOriginal: number;
  tasaCambio: number;
  montoConvertido: number;
  cuentaId: string;
  cuenta: {
    nombreBanco?: string | null;
    numeroCuenta?: string | null;
    moneda?: string | null;
  } | null;
  descripcion: string | null;
}

function buildDateFilter(fechaInicio?: string | null, fechaFin?: string | null): Record<string, Date> {
  const dateFilter: Record<string, Date> = {};
  if (fechaInicio) dateFilter.gte = new Date(fechaInicio);
  if (fechaFin) dateFilter.lte = endOfDay(fechaFin);
  return dateFilter;
}

function generateCSV(movimientos: unknown[]): string {
  const headers = [
    'Fecha', 'Tipo', 'Descripción', 'Cuenta', 'Tipo Pago', 'Monto', 'Moneda',
    'Monto Convertido', 'Tasa Cambio', 'Realizado Por', 'Referencia', 'Observaciones',
  ];

  const rows = movimientos.map((mov: any) => [
    new Date(mov.fecha).toLocaleDateString(),
    mov.tipo,
    mov.descripcion,
    mov.cuenta,
    mov.tipoPago,
    mov.monto.toString(),
    mov.moneda,
    mov.montoConvertido?.toString() || '',
    mov.tasaCambio?.toString() || '',
    mov.realizadoPor,
    mov.referencia,
    mov.observaciones || '',
  ]);

  return [headers, ...rows]
    .map((row) => row.map((field) => `"${field}"`).join(','))
    .join('\n');
}

function generateResumenCSV(resumenPorMoneda: any[], cuentasBancarias: CuentaBancariaResumen[], estadisticas: any): string {
  const sections: string[] = [];
  sections.push('RESUMEN POR MONEDA');
  sections.push('Moneda,Saldo Actual,Total Ingresos,Total Egresos,Flujo Neto,Ingresos Ventas,Ingresos Servicios,Ingresos Ajustes,Egresos Gastos,Egresos Ajustes');
  resumenPorMoneda.forEach((resumen: any) => {
    sections.push([
      resumen.moneda,
      resumen.saldoActual,
      resumen.totalIngresos,
      resumen.totalEgresos,
      resumen.flujoNeto,
      resumen.desglose.ingresos.ventas,
      resumen.desglose.ingresos.servicios,
      resumen.desglose.ingresos.ajustes,
      resumen.desglose.egresos.gastos,
      resumen.desglose.egresos.ajustes,
    ].join(','));
  });
  sections.push('');
  sections.push('CUENTAS BANCARIAS');
  sections.push('Banco,Número Cuenta,Saldo,Moneda');
  cuentasBancarias.forEach((cuenta) => {
    sections.push([
      cuenta.nombreBanco,
      cuenta.numeroCuenta,
      cuenta.saldo,
      cuenta.moneda || 'CUP',
    ].map((field) => `"${field}"`).join(','));
  });
  sections.push('');
  sections.push('ESTADÍSTICAS');
  sections.push(`Total Cuentas,${estadisticas.totalCuentas}`);
  sections.push(`Total Reconciliaciones,${estadisticas.totalReconciliaciones}`);
  sections.push(`Total Transferencias,${estadisticas.totalTransferencias}`);
  sections.push(`Total Ajustes,${estadisticas.totalAjustes}`);
  return sections.join('\n');
}

function generateExchangeCSV(historialTasas: any[], conversiones: ExchangeConversion[], estadisticas: Record<string, ExchangeStat>): string {
  const sections: string[] = [];

  sections.push('HISTORIAL DE TASAS DE CAMBIO');
  sections.push('Fecha,Moneda Origen,Moneda Destino,Tasa');
  historialTasas.forEach((tasa: any) => {
    sections.push([
      new Date(tasa.fechaVigencia).toLocaleDateString(),
      tasa.monedaOrigen.codigo,
      tasa.monedaDestino,
      tasa.tasa,
    ].map((field) => `"${field}"`).join(','));
  });

  sections.push('');
  sections.push('CONVERSIONES REALIZADAS');
  sections.push('Fecha,Tipo,Descripción,Monto Original,Moneda Original,Monto Convertido,Moneda Destino,Tasa Cambio,Referencia');
  conversiones.forEach((conv) => {
    sections.push([
      new Date(conv.fecha).toLocaleDateString(),
      conv.tipo,
      conv.descripcion,
      conv.montoOriginal,
      conv.monedaOriginal,
      conv.montoConvertido,
      conv.monedaDestino,
      conv.tasaCambio,
      conv.referencia,
    ].map((field) => `"${field}"`).join(','));
  });

  sections.push('');
  sections.push('ESTADÍSTICAS POR MONEDA');
  sections.push('Moneda,Total Transacciones,Monto Total Original,Monto Total Convertido,Tasa Promedio,Tasa Mínima,Tasa Máxima');
  Object.entries(estadisticas).forEach(([moneda, stats]) => {
    sections.push([
      moneda,
      stats.totalTransacciones,
      stats.montoTotalOriginal.toFixed(2),
      stats.montoTotalConvertido.toFixed(2),
      stats.tasaPromedio.toFixed(4),
      stats.tasaMinima.toFixed(4),
      stats.tasaMaxima.toFixed(4),
    ].join(','));
  });

  return sections.join('\n');
}

function getMostActiveTransferAccounts(transferencias: any[]): Array<{ cuenta: string; totalTransferencias: number; montoTotal: number }> {
  const cuentasActividad = transferencias.reduce((acc: Record<string, { totalTransferencias: number; montoTotal: number }>, trans: any) => {
    const cuentaOrigenKey = `${trans.cuentaOrigen.nombreBanco} - ${trans.cuentaOrigen.numeroCuenta}`;
    if (!acc[cuentaOrigenKey]) {
      acc[cuentaOrigenKey] = { totalTransferencias: 0, montoTotal: 0 };
    }
    acc[cuentaOrigenKey].totalTransferencias += 1;
    acc[cuentaOrigenKey].montoTotal += Number(trans.montoOrigen);

    const cuentaDestinoKey = `${trans.cuentaDestino.nombreBanco} - ${trans.cuentaDestino.numeroCuenta}`;
    if (!acc[cuentaDestinoKey]) {
      acc[cuentaDestinoKey] = { totalTransferencias: 0, montoTotal: 0 };
    }
    acc[cuentaDestinoKey].totalTransferencias += 1;
    acc[cuentaDestinoKey].montoTotal += Number(trans.montoDestino);

    return acc;
  }, {});

  return Object.entries(cuentasActividad)
    .map(([cuenta, stats]) => ({
      cuenta,
      totalTransferencias: stats.totalTransferencias,
      montoTotal: stats.montoTotal,
    }))
    .sort((a, b) => b.totalTransferencias - a.totalTransferencias)
    .slice(0, 10);
}

function getAverageTransferAmountsByCurrency(transferencias: any[]): Record<string, number> {
  const montosPorMoneda = transferencias.reduce((acc: Record<string, { total: number; count: number }>, trans: any) => {
    const moneda = trans.monedaOrigen || 'CUP';
    if (!acc[moneda]) {
      acc[moneda] = { total: 0, count: 0 };
    }
    acc[moneda].total += Number(trans.montoOrigen);
    acc[moneda].count += 1;
    return acc;
  }, {});

  return Object.entries(montosPorMoneda).reduce((acc: Record<string, number>, [moneda, stats]) => {
    acc[moneda] = stats.total / stats.count;
    return acc;
  }, {});
}

function generateTransfersCSV(transferencias: any[], estadisticas: any): string {
  const sections: string[] = [];

  sections.push('TRANSFERENCIAS BANCARIAS');
  sections.push('Fecha,Número Comprobante,Cuenta Origen,Cuenta Destino,Monto Origen,Moneda Origen,Monto Destino,Moneda Destino,Tasa Cambio,Motivo,Descripción,Comprobante Generado');

  transferencias.forEach((trans: any) => {
    sections.push([
      new Date(trans.fechaTransferencia).toLocaleDateString(),
      trans.numeroComprobante,
      `${trans.cuentaOrigen.banco} - ${trans.cuentaOrigen.numeroCuenta}`,
      `${trans.cuentaDestino.banco} - ${trans.cuentaDestino.numeroCuenta}`,
      trans.montoOrigen.toString(),
      trans.monedaOrigen,
      trans.montoDestino.toString(),
      trans.monedaDestino,
      trans.tasaCambio?.toString() || '',
      trans.motivo,
      trans.descripcion || '',
      trans.comprobanteGenerado ? 'Sí' : 'No',
    ].map((field) => `"${field}"`).join(','));
  });

  sections.push('');
  sections.push('ESTADÍSTICAS');
  sections.push(`Total Transferencias,${estadisticas.totalTransferencias}`);
  sections.push(`Transferencias con Conversión,${estadisticas.transferenciasConConversion}`);

  sections.push('');
  sections.push('MONTO TOTAL POR MONEDA');
  sections.push('Moneda,Monto Total');
  Object.entries(estadisticas.montoTotalPorMoneda).forEach(([moneda, monto]) => {
    sections.push(`${moneda},${monto}`);
  });

  sections.push('');
  sections.push('PROMEDIO MONTOS POR MONEDA');
  sections.push('Moneda,Promedio');
  Object.entries(estadisticas.promedioMontosPorMoneda).forEach(([moneda, promedio]) => {
    sections.push(`${moneda},${Number(promedio).toFixed(2)}`);
  });

  sections.push('');
  sections.push('CUENTAS MÁS ACTIVAS');
  sections.push('Cuenta,Total Transferencias,Monto Total');
  estadisticas.cuentasMasActivas.forEach((cuenta: any) => {
    sections.push([
      cuenta.cuenta,
      cuenta.totalTransferencias,
      cuenta.montoTotal.toFixed(2),
    ].map((field: string | number) => `"${field}"`).join(','));
  });

  return sections.join('\n');
}

function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average === 0) return 0;

  const variance = values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length;
  return Math.sqrt(variance) / average;
}

function generateExchangeImpactRecommendations(data: {
  gananciaPerdidaTotal: number;
  volatilidadPromedio: number;
  porMoneda: Array<{ codigo: string; impactoTotal: number }>;
  porCuenta: Array<{ nivelRiesgo: string }>;
}) {
  const recomendaciones: Array<{
    titulo: string;
    descripcion: string;
    prioridad: string;
    impactoEstimado?: number;
  }> = [];

  if (data.gananciaPerdidaTotal < -5000) {
    recomendaciones.push({
      titulo: 'Pérdidas significativas por exchange',
      descripcion: 'Se han detectado pérdidas importantes debido a fluctuaciones del tipo de cambio. Considere implementar estrategias de cobertura.',
      prioridad: 'alta',
      impactoEstimado: Math.abs(data.gananciaPerdidaTotal) * 0.3,
    });
  }

  if (data.volatilidadPromedio > 0.1) {
    recomendaciones.push({
      titulo: 'Alta volatilidad en tipos de cambio',
      descripcion: 'Los tipos de cambio muestran alta volatilidad. Considere diversificar las monedas o ajustar la frecuencia de conversiones.',
      prioridad: 'media',
    });
  }

  const monedaDominante = data.porMoneda.reduce<{ codigo: string; impactoTotal: number } | null>(
    (max, moneda) => (max && Math.abs(max.impactoTotal) > Math.abs(moneda.impactoTotal) ? max : moneda),
    null,
  );

  if (monedaDominante && Math.abs(monedaDominante.impactoTotal) > Math.abs(data.gananciaPerdidaTotal) * 0.7) {
    recomendaciones.push({
      titulo: `Concentración de riesgo en ${monedaDominante.codigo}`,
      descripcion: `La mayoría del impacto del exchange proviene de ${monedaDominante.codigo}. Considere diversificar las operaciones.`,
      prioridad: 'media',
    });
  }

  const cuentasAltoRiesgo = data.porCuenta.filter((cuenta) => cuenta.nivelRiesgo === 'alto');
  if (cuentasAltoRiesgo.length > 0) {
    recomendaciones.push({
      titulo: 'Cuentas con alto riesgo cambiario',
      descripcion: `${cuentasAltoRiesgo.length} cuenta(s) muestran alto riesgo cambiario. Revise las operaciones en estas cuentas.`,
      prioridad: 'media',
    });
  }

  return recomendaciones;
}

/**
 * @description Servicio compartido para reportes contables base reutilizable por web y mobile.
 */
export const AccountingReportsService = {
  async getSummaryReport(params: {
    tenantId: string;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    cuentaId?: string | null;
    moneda?: string | null;
    export?: string | null;
  }) {
    const dateFilter = buildDateFilter(params.fechaInicio, params.fechaFin);
    const cuentaId = params.cuentaId ?? null;
    const exportFormat = params.export ?? null;

    const cuentasBancarias = await prisma.cuentaBancaria.findMany({
      where: {
        tenantId: params.tenantId,
        isActive: true,
        ...(cuentaId ? { cuentaId } : {}),
      },
      select: {
        cuentaId: true,
        nombreBanco: true,
        numeroCuenta: true,
        saldo: true,
        moneda: true,
        tipoCuenta: true,
      },
    });

    const saldosPorMoneda = cuentasBancarias.reduce((acc: Record<string, number>, cuenta: CuentaBancariaResumen) => {
      const monedaCuenta = cuenta.moneda || 'CUP';
      if (!acc[monedaCuenta]) acc[monedaCuenta] = 0;
      acc[monedaCuenta] += Number(cuenta.saldo || 0);
      return acc;
    }, {});

    const accountFilter = {
      tenantId: params.tenantId,
      ...(cuentaId ? { cuentaId } : {}),
    };
    const accountRelationFilter = {
      cuentaBancaria: { tenantId: params.tenantId },
      ...(cuentaId ? { cuentaId } : {}),
    };

    const [reconciliacionesVentas, reconciliacionesServicios, reconciliacionesGastos, transferencias, ajustesBancarios, inyeccionesCapital, pagosDeuda] = await Promise.all([
      prisma.reconciliacionVenta.findMany({
        where: {
          ...accountFilter,
          ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}),
          tipoReconciliacion: { notIn: ['PRESTAMO_CASH_DESEMBOLSO'] },
        },
        select: { monto: true, moneda: true, montoConvertido: true, fechaReconciliacion: true, tipoReconciliacion: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } } },
      }),
      prisma.reconciliacionServicio.findMany({
        where: { ...accountFilter, ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}) },
        select: { monto: true, moneda: true, montoConvertido: true, fechaReconciliacion: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } } },
      }),
      prisma.reconciliacionGasto.findMany({
        where: { ...accountFilter, ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}) },
        select: { monto: true, moneda: true, montoConvertido: true, tipoGasto: true, fechaReconciliacion: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } } },
      }),
      prisma.transferenciaBancaria.findMany({
        where: {
          tenantId: params.tenantId,
          ...(Object.keys(dateFilter).length > 0 ? { fechaTransferencia: dateFilter } : {}),
          ...(cuentaId ? { OR: [{ cuentaOrigenId: cuentaId }, { cuentaDestinoId: cuentaId }] } : {}),
        },
      }),
      prisma.ajusteBancario.findMany({
        where: { ...accountFilter, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}) },
        select: { tipo: true, monto: true, moneda: true, montoConvertido: true },
      }),
      prisma.inyeccionCapital.findMany({
        where: { ...accountRelationFilter, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}) },
        select: { tipo: true, montoRecibido: true, moneda: true },
      }),
      prisma.pagoDeuda.findMany({
        where: { ...accountRelationFilter, ...(Object.keys(dateFilter).length > 0 ? { fechaPago: dateFilter } : {}) },
        select: { montoPagado: true, cuentaBancaria: { select: { moneda: true } } },
      }),
    ]);

    const ingresosVentas: Record<string, number> = {};
    const egresosPrestamosCash: Record<string, number> = {};
    reconciliacionesVentas.forEach((r: any) => {
      const m = r.moneda || 'CUP';
      if (r.tipoReconciliacion === 'PRESTAMO_CASH') return;
      if (r.tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO') return;
      if (r.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO') {
        egresosPrestamosCash[m] = (egresosPrestamosCash[m] || 0) + Number(r.monto);
        return;
      }
      ingresosVentas[m] = (ingresosVentas[m] || 0) + Number(r.monto);
    });

    const ingresosServicios: Record<string, number> = {};
    reconciliacionesServicios.forEach((r: any) => {
      const m = r.moneda || 'CUP';
      ingresosServicios[m] = (ingresosServicios[m] || 0) + Number(r.monto);
    });

    const egresosGastos: Record<string, number> = {};
    reconciliacionesGastos.forEach((r: any) => {
      const m = r.moneda || 'CUP';
      egresosGastos[m] = (egresosGastos[m] || 0) + Number(r.monto);
    });

    const ingresosAjustes: Record<string, number> = {};
    const egresosAjustes: Record<string, number> = {};
    ajustesBancarios.forEach((r: any) => {
      const m = r.moneda || 'CUP';
      if (r.tipo === 'ingreso') ingresosAjustes[m] = (ingresosAjustes[m] || 0) + Number(r.monto);
      else egresosAjustes[m] = (egresosAjustes[m] || 0) + Number(r.monto);
    });

    const ingresosInyecciones: Record<string, number> = {};
    inyeccionesCapital.forEach((r: any) => {
      const m = r.moneda || 'CUP';
      ingresosInyecciones[m] = (ingresosInyecciones[m] || 0) + Number(r.montoRecibido);
    });

    const egresosPagosDeuda: Record<string, number> = {};
    pagosDeuda.forEach((r: any) => {
      const m = r.cuentaBancaria.moneda || 'CUP';
      egresosPagosDeuda[m] = (egresosPagosDeuda[m] || 0) + Number(r.montoPagado);
    });

    const monedas = Array.from(new Set([
      ...Object.keys(saldosPorMoneda),
      ...Object.keys(ingresosVentas),
      ...Object.keys(ingresosServicios),
      ...Object.keys(egresosGastos),
      ...Object.keys(ingresosAjustes),
      ...Object.keys(egresosAjustes),
      ...Object.keys(ingresosInyecciones),
      ...Object.keys(egresosPagosDeuda),
      ...Object.keys(egresosPrestamosCash),
    ]));

    const resumenPorMoneda = monedas.map((monedaCode) => {
      const totalIngresos = (ingresosVentas[monedaCode] || 0) + (ingresosServicios[monedaCode] || 0) + (ingresosAjustes[monedaCode] || 0) + (ingresosInyecciones[monedaCode] || 0);
      const totalEgresos = (egresosGastos[monedaCode] || 0) + (egresosAjustes[monedaCode] || 0) + (egresosPagosDeuda[monedaCode] || 0) + (egresosPrestamosCash[monedaCode] || 0);
      return {
        moneda: monedaCode,
        saldoActual: saldosPorMoneda[monedaCode] || 0,
        totalIngresos,
        totalEgresos,
        flujoNeto: totalIngresos - totalEgresos,
        desglose: {
          ingresos: {
            ventas: ingresosVentas[monedaCode] || 0,
            servicios: ingresosServicios[monedaCode] || 0,
            ajustes: ingresosAjustes[monedaCode] || 0,
            inyecciones: inyeccionesCapital,
          },
          egresos: {
            gastos: egresosGastos[monedaCode] || 0,
            ajustes: egresosAjustes[monedaCode] || 0,
            pagosDeuda: egresosPagosDeuda[monedaCode] || 0,
            prestamosCash: egresosPrestamosCash[monedaCode] || 0,
          },
        },
      };
    });

    const estadisticas = {
      totalCuentas: cuentasBancarias.length,
      totalReconciliaciones: reconciliacionesVentas.length + reconciliacionesServicios.length + reconciliacionesGastos.length,
      totalTransferencias: transferencias.length,
      totalAjustes: ajustesBancarios.length,
      totalInyecciones: inyeccionesCapital.length,
      periodo: {
        fechaInicio: params.fechaInicio || 'Sin límite',
        fechaFin: params.fechaFin || 'Sin límite',
      },
    };

    return {
      resumenPorMoneda,
      cuentasBancarias,
      estadisticas,
      filtros: {
        fechaInicio: params.fechaInicio || null,
        fechaFin: params.fechaFin || null,
        cuentaId,
        moneda: params.moneda || 'CUP',
      },
      exportContent: exportFormat === 'csv' ? generateResumenCSV(resumenPorMoneda, cuentasBancarias as any, estadisticas) : null,
    };
  },

  async getMovementsReport(params: {
    tenantId: string;
    busqueda?: string | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    cuentaId?: string | null;
    tipoMovimiento?: string | null;
    moneda?: string | null;
    page?: number;
    limit?: number;
    formato?: string | null;
  }) {
    const dateFilter = buildDateFilter(params.fechaInicio, params.fechaFin);
    const cuentaId = params.cuentaId ?? null;
    const busqueda = params.busqueda ?? null;
    const tipoMovimiento = params.tipoMovimiento ?? null;
    const moneda = params.moneda ?? null;
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const accountFilter = {
      tenantId: params.tenantId,
      ...(cuentaId ? { cuentaId } : {}),
    };
    const accountRelationFilter = {
      cuentaBancaria: { tenantId: params.tenantId },
      ...(cuentaId ? { cuentaId } : {}),
    };

    const [ventasMovimientos, serviciosMovimientos, gastosMovimientos, transferenciasMovimientos, ajustesMovimientos, inyeccionesMovimientos, pagosDeudaMovimientos] = await Promise.all([
      prisma.reconciliacionVenta.findMany({
        where: { ...accountFilter, ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}), ...(moneda ? { moneda } : {}) },
        select: {
          reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, fechaReconciliacion: true,
          observaciones: true, reconciliadoPor: true, tipoReconciliacion: true,
          venta: { select: { ventaId: true, total: true, createdAt: true } },
          prestamoCash: { select: { id: true, cliente: { select: { nombre: true } } } },
          deudaCash: { select: { id: true, proveedor: { select: { nombre: true } } } },
          cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } },
          tipoPago: { select: { nombre: true } },
        }, orderBy: { fechaReconciliacion: 'desc' },
      }),
      prisma.reconciliacionServicio.findMany({
        where: { ...accountFilter, ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}), ...(moneda ? { moneda } : {}) },
        select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, fechaReconciliacion: true, observaciones: true, reconciliadoPor: true, ventasServicio: { select: { ventaServicioId: true } }, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } }, tipoPago: { select: { nombre: true } } }, orderBy: { fechaReconciliacion: 'desc' },
      }),
      prisma.reconciliacionGasto.findMany({
        where: { ...accountFilter, ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}), ...(moneda ? { moneda } : {}) },
        select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, tipoGasto: true, descripcion: true, periodo: true, fechaReconciliacion: true, observaciones: true, reconciliadoPor: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } }, tipoPago: { select: { nombre: true } } }, orderBy: { fechaReconciliacion: 'desc' },
      }),
      prisma.transferenciaBancaria.findMany({
        where: {
          tenantId: params.tenantId,
          ...(Object.keys(dateFilter).length > 0 ? { fechaTransferencia: dateFilter } : {}),
          ...((cuentaId || moneda) ? {
            AND: [
              ...(cuentaId ? [{ OR: [{ cuentaOrigenId: cuentaId }, { cuentaDestinoId: cuentaId }] }] : []),
              ...(moneda ? [{ OR: [{ monedaOrigen: moneda }, { monedaDestino: moneda }] }] : []),
            ],
          } : {}),
        },
        select: { transferenciaId: true, numeroComprobante: true, montoOrigen: true, monedaOrigen: true, montoDestino: true, monedaDestino: true, tasaCambio: true, motivo: true, descripcion: true, fechaTransferencia: true, cuentaOrigen: { select: { nombreBanco: true, numeroCuenta: true } }, cuentaDestino: { select: { nombreBanco: true, numeroCuenta: true } } }, orderBy: { fechaTransferencia: 'desc' },
      }),
      prisma.ajusteBancario.findMany({
        where: { ...accountFilter, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}), ...(moneda ? { moneda } : {}) },
        select: { ajusteId: true, tipo: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, descripcion: true, motivo: true, realizadoPor: true, createdAt: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } } }, orderBy: { createdAt: 'desc' },
      }),
      prisma.inyeccionCapital.findMany({
        where: { ...accountRelationFilter, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}), ...(moneda ? { moneda } : {}) },
        select: { id: true, tipo: true, montoRecibido: true, moneda: true, descripcion: true, socio: true, entidadPrestamista: true, createdAt: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } } }, orderBy: { createdAt: 'desc' },
      }),
      prisma.pagoDeuda.findMany({
        where: { ...accountRelationFilter, ...(Object.keys(dateFilter).length > 0 ? { fechaPago: dateFilter } : {}), cuentaBancaria: { tenantId: params.tenantId, ...(moneda ? { moneda } : {}) } },
        select: { id: true, montoPagado: true, fechaPago: true, comprobante: true, observaciones: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true, moneda: true } }, inyeccion: { select: { entidadPrestamista: true, tipo: true } } }, orderBy: { fechaPago: 'desc' },
      }),
    ]);

    const movimientos = ([] as any[]).concat(
      ventasMovimientos.map((mov: any) => ({
        id: mov.reconciliacionId,
        tipo: mov.tipoReconciliacion === 'PRESTAMO_CASH' ? 'prestamo_cash_pago' : mov.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO' ? 'prestamo_cash_desembolso' : mov.tipoReconciliacion === 'DEUDA_CASH' ? 'deuda_cash_pago' : mov.tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO' ? 'deuda_cash_desembolso' : 'venta',
        fecha: mov.fechaReconciliacion,
        monto: Number(mov.monto),
        moneda: mov.moneda || 'CUP',
        montoConvertido: mov.tasaCambio ? Number(mov.monto) * Number(mov.tasaCambio) : Number(mov.monto),
        tasaCambio: mov.tasaCambio ? Number(mov.tasaCambio) : null,
        descripcion: mov.tipoReconciliacion === 'PRESTAMO_CASH' ? 'Cobro Prestamo Cash' : mov.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO' ? 'Desembolso Prestamo Cash' : mov.tipoReconciliacion === 'DEUDA_CASH' ? 'Pago Deuda Cash' : mov.tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO' ? 'Desembolso de Deuda Cash' : mov.venta ? `Venta ${mov.venta.ventaId}` : `Cobro ${mov.reconciliacionId}`,
        cuenta: `${mov.cuentaBancaria.nombreBanco} - ${mov.cuentaBancaria.numeroCuenta}`,
        tipoPago: mov.tipoPago.nombre,
        observaciones: mov.observaciones,
        realizadoPor: mov.reconciliadoPor,
        referencia: mov.venta?.ventaId || mov.prestamoCash?.id || mov.deudaCash?.id || mov.reconciliacionId,
        detalles: { tipoReconciliacion: mov.tipoReconciliacion },
      })),
      serviciosMovimientos.map((mov: any) => ({ id: mov.reconciliacionId, tipo: 'servicio', fecha: mov.fechaReconciliacion, monto: Number(mov.monto), moneda: mov.moneda || 'CUP', montoConvertido: mov.tasaCambio ? Number(mov.monto) * Number(mov.tasaCambio) : Number(mov.monto), tasaCambio: mov.tasaCambio ? Number(mov.tasaCambio) : null, descripcion: `Servicio ${mov.ventasServicio.ventaServicioId}`, cuenta: `${mov.cuentaBancaria.nombreBanco} - ${mov.cuentaBancaria.numeroCuenta}`, tipoPago: mov.tipoPago.nombre, observaciones: mov.observaciones, realizadoPor: mov.reconciliadoPor, referencia: mov.ventasServicio.ventaServicioId, detalles: {} })),
      gastosMovimientos.map((mov: any) => ({ id: mov.reconciliacionId, tipo: mov.tipoGasto === 'salario' ? 'salario' : 'gasto', fecha: mov.fechaReconciliacion, monto: -Number(mov.monto), moneda: mov.moneda || 'CUP', montoConvertido: mov.tasaCambio ? -Number(mov.monto) * Number(mov.tasaCambio) : -Number(mov.monto), tasaCambio: mov.tasaCambio ? Number(mov.tasaCambio) : null, descripcion: mov.descripcion, cuenta: `${mov.cuentaBancaria.nombreBanco} - ${mov.cuentaBancaria.numeroCuenta}`, tipoPago: mov.tipoPago.nombre, observaciones: mov.observaciones, realizadoPor: mov.reconciliadoPor, referencia: mov.reconciliacionId, detalles: { periodo: mov.periodo } })),
      transferenciasMovimientos.flatMap((mov: any) => {
        const rows = [] as any[];
        rows.push({ id: `${mov.transferenciaId}-origen`, tipo: 'transferencia_salida', fecha: mov.fechaTransferencia, monto: -Number(mov.montoOrigen), moneda: mov.monedaOrigen || 'CUP', montoConvertido: null, tasaCambio: mov.tasaCambio ? Number(mov.tasaCambio) : null, descripcion: `Transf a ${mov.cuentaDestino.nombreBanco}`, cuenta: `${mov.cuentaOrigen.nombreBanco} - ${mov.cuentaOrigen.numeroCuenta}`, tipoPago: 'Transferencia', observaciones: mov.descripcion, realizadoPor: 'Sistema', referencia: mov.numeroComprobante, detalles: { motivo: mov.motivo } });
        rows.push({ id: `${mov.transferenciaId}-destino`, tipo: 'transferencia_entrada', fecha: mov.fechaTransferencia, monto: Number(mov.montoDestino), moneda: mov.monedaDestino || 'CUP', montoConvertido: Number(mov.montoDestino), tasaCambio: mov.tasaCambio ? Number(mov.tasaCambio) : null, descripcion: `Transf desde ${mov.cuentaOrigen.nombreBanco}`, cuenta: `${mov.cuentaDestino.nombreBanco} - ${mov.cuentaDestino.numeroCuenta}`, tipoPago: 'Transferencia', observaciones: mov.descripcion, realizadoPor: 'Sistema', referencia: mov.numeroComprobante, detalles: { motivo: mov.motivo } });
        return rows;
      }),
      ajustesMovimientos.map((mov: any) => ({ id: mov.ajusteId, tipo: mov.tipo === 'ingreso' ? 'ajuste_ingreso' : 'ajuste_egreso', fecha: mov.createdAt, monto: mov.tipo === 'ingreso' ? Number(mov.monto) : -Number(mov.monto), moneda: mov.moneda || 'CUP', montoConvertido: mov.tasaCambio ? (mov.tipo === 'ingreso' ? Number(mov.monto) * Number(mov.tasaCambio) : -Number(mov.monto) * Number(mov.tasaCambio)) : (mov.tipo === 'ingreso' ? Number(mov.monto) : -Number(mov.monto)), tasaCambio: mov.tasaCambio ? Number(mov.tasaCambio) : null, descripcion: mov.descripcion, cuenta: `${mov.cuentaBancaria.nombreBanco} - ${mov.cuentaBancaria.numeroCuenta}`, tipoPago: mov.tipo === 'ingreso' ? 'Ajuste Ingreso' : 'Ajuste Egreso', observaciones: mov.motivo, realizadoPor: mov.realizadoPor, referencia: mov.ajusteId, detalles: { tipoAjuste: mov.tipo, motivo: mov.motivo } })),
      inyeccionesMovimientos.map((mov: any) => ({ id: mov.id, tipo: 'inyeccion_capital', fecha: mov.createdAt, monto: Number(mov.montoRecibido), moneda: mov.moneda || 'CUP', montoConvertido: Number(mov.montoRecibido), tasaCambio: null, descripcion: mov.tipo === 'CAPITAL_SOCIAL' ? `Aportación Capital: ${mov.socio}` : `Préstamo: ${mov.entidadPrestamista}`, cuenta: `${mov.cuentaBancaria.nombreBanco} - ${mov.cuentaBancaria.numeroCuenta}`, tipoPago: mov.tipo === 'CAPITAL_SOCIAL' ? 'Capital Social' : 'Deuda Externa', observaciones: mov.descripcion, realizadoPor: 'Sistema', referencia: mov.id, detalles: { tipoInyeccion: mov.tipo, entidad: mov.tipo === 'CAPITAL_SOCIAL' ? mov.socio : mov.entidadPrestamista } })),
      pagosDeudaMovimientos.map((mov: any) => ({ id: mov.id, tipo: 'pago_deuda', fecha: mov.fechaPago, monto: -Number(mov.montoPagado), moneda: mov.cuentaBancaria.moneda || 'CUP', montoConvertido: -Number(mov.montoPagado), tasaCambio: null, descripcion: `Pago Deuda: ${mov.inyeccion.entidadPrestamista}`, cuenta: `${mov.cuentaBancaria.nombreBanco} - ${mov.cuentaBancaria.numeroCuenta}`, tipoPago: 'Pago Deuda', observaciones: mov.observaciones, realizadoPor: 'Sistema', referencia: mov.comprobante || mov.id, detalles: { comprobante: mov.comprobante } })),
    );

    let movimientosFiltrados = tipoMovimiento && tipoMovimiento !== 'all'
      ? movimientos.filter((mov) => mov.tipo === tipoMovimiento)
      : movimientos;

    if (busqueda) {
      const q = busqueda.toLowerCase();
      movimientosFiltrados = movimientosFiltrados.filter((mov) =>
        mov.descripcion.toLowerCase().includes(q) ||
        mov.referencia?.toLowerCase().includes(q) ||
        mov.observaciones?.toLowerCase().includes(q),
      );
    }

    movimientosFiltrados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const offset = (page - 1) * limit;
    const movimientosPaginados = movimientosFiltrados.slice(offset, offset + limit);

    const totalesPorMoneda = movimientosFiltrados.reduce((acc, mov) => {
      const m = mov.moneda;
      if (!acc[m]) acc[m] = { ingresos: 0, egresos: 0, neto: 0 };
      if (mov.monto > 0) acc[m].ingresos += mov.monto;
      else acc[m].egresos += Math.abs(mov.monto);
      acc[m].neto += mov.monto;
      return acc;
    }, {} as Record<string, { ingresos: number; egresos: number; neto: number }>);

    return {
      data: movimientosPaginados,
      totales: totalesPorMoneda,
      pagination: {
        page,
        limit,
        total: movimientosFiltrados.length,
        totalPages: Math.ceil(movimientosFiltrados.length / limit),
      },
      filtros: {
        busqueda,
        fechaInicio: params.fechaInicio || null,
        fechaFin: params.fechaFin || null,
        cuentaId,
        tipoMovimiento,
        moneda,
      },
      exportContent: params.formato === 'csv' ? generateCSV(movimientosFiltrados) : null,
    };
  },

  async getExchangeReport(params: {
    tenantId: string;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    monedaOrigen?: string | null;
    monedaDestino?: string | null;
    export?: string | null;
  }) {
    const dateFilter = buildDateFilter(params.fechaInicio, params.fechaFin);

    const historialTasas = await prisma.tasaCambio.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 ? { fechaVigencia: dateFilter } : {}),
        ...(params.monedaOrigen ? { monedaOrigenId: params.monedaOrigen } : {}),
        ...(params.monedaDestino ? { monedaDestino: params.monedaDestino } : {}),
      },
      include: {
        monedaOrigen: {
          select: {
            codigo: true,
            nombre: true,
            simbolo: true,
          },
        },
      },
      orderBy: { fechaVigencia: 'desc' },
    });

    const transaccionesConversion = await prisma.transaccionMoneda.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        ...(params.monedaOrigen ? { monedaId: params.monedaOrigen } : {}),
      },
      include: {
        moneda: {
          select: {
            codigo: true,
            nombre: true,
            simbolo: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const [
      reconciliacionesVentas,
      reconciliacionesServicios,
      reconciliacionesGastos,
      ajustesBancarios,
      transferencias,
    ] = await Promise.all([
      prisma.reconciliacionVenta.findMany({
        where: {
          tasaCambio: { not: null },
          ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}),
          ...(params.monedaOrigen ? { moneda: params.monedaOrigen } : {}),
        },
        select: {
          reconciliacionId: true,
          monto: true,
          moneda: true,
          montoConvertido: true,
          tasaCambio: true,
          fechaReconciliacion: true,
          venta: { select: { ventaId: true } },
        },
      }),
      prisma.reconciliacionServicio.findMany({
        where: {
          tasaCambio: { not: null },
          ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}),
          ...(params.monedaOrigen ? { moneda: params.monedaOrigen } : {}),
        },
        select: {
          reconciliacionId: true,
          monto: true,
          moneda: true,
          montoConvertido: true,
          tasaCambio: true,
          fechaReconciliacion: true,
          ventasServicio: { select: { ventaServicioId: true } },
        },
      }),
      prisma.reconciliacionGasto.findMany({
        where: {
          tasaCambio: { not: null },
          ...(Object.keys(dateFilter).length > 0 ? { fechaReconciliacion: dateFilter } : {}),
          ...(params.monedaOrigen ? { moneda: params.monedaOrigen } : {}),
        },
        select: {
          reconciliacionId: true,
          monto: true,
          moneda: true,
          montoConvertido: true,
          tasaCambio: true,
          tipoGasto: true,
          descripcion: true,
          fechaReconciliacion: true,
        },
      }),
      prisma.ajusteBancario.findMany({
        where: {
          tasaCambio: { not: null },
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
          ...(params.monedaOrigen ? { moneda: params.monedaOrigen } : {}),
        },
        select: {
          ajusteId: true,
          tipo: true,
          monto: true,
          moneda: true,
          montoConvertido: true,
          tasaCambio: true,
          descripcion: true,
          createdAt: true,
        },
      }),
      prisma.transferenciaBancaria.findMany({
        where: {
          tasaCambio: { not: null },
          ...(Object.keys(dateFilter).length > 0 ? { fechaTransferencia: dateFilter } : {}),
          ...(params.monedaOrigen ? { monedaOrigen: params.monedaOrigen } : {}),
        },
        select: {
          transferenciaId: true,
          numeroComprobante: true,
          montoOrigen: true,
          monedaOrigen: true,
          montoDestino: true,
          monedaDestino: true,
          tasaCambio: true,
          motivo: true,
          fechaTransferencia: true,
        },
      }),
    ]);

    const conversiones: ExchangeConversion[] = [
      ...reconciliacionesVentas.map((rec: any) => ({
        id: rec.reconciliacionId,
        tipo: 'venta',
        fecha: rec.fechaReconciliacion,
        montoOriginal: Number(rec.monto),
        monedaOriginal: rec.moneda || 'CUP',
        montoConvertido: Number(rec.montoConvertido || 0),
        monedaDestino: 'CUP',
        tasaCambio: Number(rec.tasaCambio || 0),
        referencia: rec.venta.ventaId,
        descripcion: `Venta ${rec.venta.ventaId}`,
      })),
      ...reconciliacionesServicios.map((rec: any) => ({
        id: rec.reconciliacionId,
        tipo: 'servicio',
        fecha: rec.fechaReconciliacion,
        montoOriginal: Number(rec.monto),
        monedaOriginal: rec.moneda || 'CUP',
        montoConvertido: Number(rec.montoConvertido || 0),
        monedaDestino: 'CUP',
        tasaCambio: Number(rec.tasaCambio || 0),
        referencia: rec.ventasServicio.ventaServicioId,
        descripcion: `Servicio ${rec.ventasServicio.ventaServicioId}`,
      })),
      ...reconciliacionesGastos.map((rec: any) => ({
        id: rec.reconciliacionId,
        tipo: 'gasto',
        fecha: rec.fechaReconciliacion,
        montoOriginal: Number(rec.monto),
        monedaOriginal: rec.moneda || 'CUP',
        montoConvertido: Number(rec.montoConvertido || 0),
        monedaDestino: 'CUP',
        tasaCambio: Number(rec.tasaCambio || 0),
        referencia: rec.reconciliacionId,
        descripcion: `${rec.tipoGasto}: ${rec.descripcion}`,
      })),
      ...ajustesBancarios.map((rec: any) => ({
        id: rec.ajusteId,
        tipo: 'ajuste',
        fecha: rec.createdAt,
        montoOriginal: Number(rec.monto),
        monedaOriginal: rec.moneda || 'CUP',
        montoConvertido: Number(rec.montoConvertido || 0),
        monedaDestino: 'CUP',
        tasaCambio: Number(rec.tasaCambio || 0),
        referencia: rec.ajusteId,
        descripcion: `Ajuste ${rec.tipo}: ${rec.descripcion}`,
      })),
      ...transferencias.map((rec: any) => ({
        id: rec.transferenciaId,
        tipo: 'transferencia',
        fecha: rec.fechaTransferencia,
        montoOriginal: Number(rec.montoOrigen),
        monedaOriginal: rec.monedaOrigen || 'CUP',
        montoConvertido: Number(rec.montoDestino),
        monedaDestino: rec.monedaDestino || 'CUP',
        tasaCambio: Number(rec.tasaCambio || 0),
        referencia: rec.numeroComprobante,
        descripcion: `Transferencia: ${rec.motivo}`,
      })),
    ];

    conversiones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    const estadisticasConversion = conversiones.reduce<Record<string, ExchangeStat>>((acc, conv) => {
      const moneda = conv.monedaOriginal;
      if (!acc[moneda]) {
        acc[moneda] = {
          totalTransacciones: 0,
          montoTotalOriginal: 0,
          montoTotalConvertido: 0,
          tasaPromedio: 0,
          tasaMinima: Number.MAX_VALUE,
          tasaMaxima: 0,
        };
      }

      acc[moneda].totalTransacciones += 1;
      acc[moneda].montoTotalOriginal += conv.montoOriginal;
      acc[moneda].montoTotalConvertido += conv.montoConvertido;
      acc[moneda].tasaMinima = Math.min(acc[moneda].tasaMinima, conv.tasaCambio);
      acc[moneda].tasaMaxima = Math.max(acc[moneda].tasaMaxima, conv.tasaCambio);
      return acc;
    }, {});

    Object.keys(estadisticasConversion).forEach((moneda) => {
      const stats = estadisticasConversion[moneda];
      stats.tasaPromedio = stats.montoTotalOriginal > 0
        ? stats.montoTotalConvertido / stats.montoTotalOriginal
        : 0;
      if (stats.tasaMinima === Number.MAX_VALUE) stats.tasaMinima = 0;
    });

    return {
      historialTasas: historialTasas.map((tasa: any) => ({
        tasaId: tasa.tasaId,
        monedaOrigen: tasa.monedaOrigen,
        monedaDestino: tasa.monedaDestino,
        tasa: Number(tasa.tasa),
        fechaVigencia: tasa.fechaVigencia,
      })),
      transaccionesConversion: transaccionesConversion.map((trans: any) => ({
        transaccionId: trans.transaccionId,
        tipoTransaccion: trans.tipoTransaccion,
        referenciaId: trans.referenciaId,
        moneda: trans.moneda,
        montoOriginal: Number(trans.montoOriginal),
        tasaCambio: Number(trans.tasaCambio),
        montoConvertido: Number(trans.montoConvertido),
        createdAt: trans.createdAt,
      })),
      conversiones,
      estadisticasConversion,
      filtros: {
        fechaInicio: params.fechaInicio || null,
        fechaFin: params.fechaFin || null,
        monedaOrigen: params.monedaOrigen || null,
        monedaDestino: params.monedaDestino || null,
      },
      exportContent: params.export === 'csv'
        ? generateExchangeCSV(historialTasas as any[], conversiones, estadisticasConversion)
        : null,
    };
  },

  async getExchangeImpactReport(params: {
    tenantId: string;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    monedaBase?: string | null;
    tipoAnalisis?: string | null;
  }) {
    const fechaFiltros = buildDateFilter(params.fechaInicio, params.fechaFin);
    const monedaBase = params.monedaBase || 'CUP';

    const [
      reconciliacionesVenta,
      reconciliacionesServicio,
      reconciliacionesGasto,
      ajustesBancarios,
      transferencias,
    ] = await Promise.all([
      prisma.reconciliacionVenta.findMany({
        where: {
          ...(Object.keys(fechaFiltros).length > 0 ? { fechaReconciliacion: fechaFiltros } : {}),
          tasaCambio: { not: null },
          moneda: { not: monedaBase },
        },
        include: {
          cuentaBancaria: true,
          venta: true,
          tipoPago: true,
        },
        orderBy: { fechaReconciliacion: 'desc' },
      }),
      prisma.reconciliacionServicio.findMany({
        where: {
          ...(Object.keys(fechaFiltros).length > 0 ? { fechaReconciliacion: fechaFiltros } : {}),
          tasaCambio: { not: null },
          moneda: { not: monedaBase },
        },
        include: {
          cuentaBancaria: true,
          tipoPago: true,
        },
        orderBy: { fechaReconciliacion: 'desc' },
      }),
      prisma.reconciliacionGasto.findMany({
        where: {
          ...(Object.keys(fechaFiltros).length > 0 ? { fechaReconciliacion: fechaFiltros } : {}),
          tasaCambio: { not: null },
          moneda: { not: monedaBase },
        },
        include: {
          cuentaBancaria: true,
          pagoSalario: true,
          gastoDE: true,
          gastoCompra: true,
          tipoPago: true,
        },
        orderBy: { fechaReconciliacion: 'desc' },
      }),
      prisma.ajusteBancario.findMany({
        where: {
          ...(Object.keys(fechaFiltros).length > 0 ? { createdAt: fechaFiltros } : {}),
          tasaCambio: { not: null },
          moneda: { not: monedaBase },
        },
        include: {
          cuentaBancaria: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transferenciaBancaria.findMany({
        where: {
          ...(Object.keys(fechaFiltros).length > 0 ? { fechaTransferencia: fechaFiltros } : {}),
          tasaCambio: { not: null },
          OR: [
            { monedaOrigen: { not: monedaBase } },
            { monedaDestino: { not: monedaBase } },
          ],
        },
        include: {
          cuentaOrigen: true,
          cuentaDestino: true,
        },
        orderBy: { fechaTransferencia: 'desc' },
      }),
    ]);

    const conversiones: ExchangeImpactConversion[] = [];

    reconciliacionesVenta.forEach((rec: any) => {
      conversiones.push({
        id: rec.reconciliacionId,
        fecha: rec.fechaReconciliacion,
        tipo: 'venta',
        monedaOriginal: rec.moneda,
        montoOriginal: Number(rec.monto),
        tasaCambio: Number(rec.tasaCambio),
        montoConvertido: Number(rec.montoConvertido || rec.monto),
        cuentaId: rec.cuentaId,
        cuenta: rec.cuentaBancaria,
        descripcion: `Venta reconciliada - ${rec.venta?.ventaId || 'N/A'}`,
      });
    });

    reconciliacionesServicio.forEach((rec: any) => {
      conversiones.push({
        id: rec.reconciliacionId,
        fecha: rec.fechaReconciliacion,
        tipo: 'servicio',
        monedaOriginal: rec.moneda,
        montoOriginal: Number(rec.monto),
        tasaCambio: Number(rec.tasaCambio),
        montoConvertido: Number(rec.montoConvertido || rec.monto),
        cuentaId: rec.cuentaId,
        cuenta: rec.cuentaBancaria,
        descripcion: `Servicio reconciliado - ${rec.reconciliadoPor}`,
      });
    });

    reconciliacionesGasto.forEach((rec: any) => {
      conversiones.push({
        id: rec.reconciliacionId,
        fecha: rec.fechaReconciliacion,
        tipo: rec.tipoGasto,
        monedaOriginal: rec.moneda,
        montoOriginal: Number(rec.monto),
        tasaCambio: Number(rec.tasaCambio),
        montoConvertido: Number(rec.montoConvertido || rec.monto),
        cuentaId: rec.cuentaId,
        cuenta: rec.cuentaBancaria,
        descripcion: rec.descripcion,
      });
    });

    ajustesBancarios.forEach((ajuste: any) => {
      conversiones.push({
        id: ajuste.ajusteId,
        fecha: ajuste.createdAt,
        tipo: `ajuste_${ajuste.tipo}`,
        monedaOriginal: ajuste.moneda,
        montoOriginal: Number(ajuste.monto),
        tasaCambio: Number(ajuste.tasaCambio),
        montoConvertido: Number(ajuste.montoConvertido || ajuste.monto),
        cuentaId: ajuste.cuentaId,
        cuenta: ajuste.cuentaBancaria,
        descripcion: ajuste.descripcion,
      });
    });

    transferencias.forEach((transfer: any) => {
      if (transfer.monedaOrigen !== monedaBase && transfer.tasaCambio) {
        conversiones.push({
          id: `${transfer.transferenciaId}_origen`,
          fecha: transfer.fechaTransferencia,
          tipo: 'transferencia_origen',
          monedaOriginal: transfer.monedaOrigen,
          montoOriginal: Number(transfer.montoOrigen),
          tasaCambio: Number(transfer.tasaCambio),
          montoConvertido: Number(transfer.montoDestino),
          cuentaId: transfer.cuentaOrigenId,
          cuenta: transfer.cuentaOrigen,
          descripcion: `Transferencia a ${transfer.cuentaDestino?.nombreBanco}`,
        });
      }

      if (transfer.monedaDestino !== monedaBase && transfer.tasaCambio) {
        conversiones.push({
          id: `${transfer.transferenciaId}_destino`,
          fecha: transfer.fechaTransferencia,
          tipo: 'transferencia_destino',
          monedaOriginal: transfer.monedaDestino,
          montoOriginal: Number(transfer.montoDestino),
          tasaCambio: Number(transfer.tasaCambio),
          montoConvertido: Number(transfer.montoOrigen),
          cuentaId: transfer.cuentaDestinoId,
          cuenta: transfer.cuentaDestino,
          descripcion: `Transferencia desde ${transfer.cuentaOrigen?.nombreBanco}`,
        });
      }
    });

    const monedasInfo = await prisma.moneda.findMany({
      where: {
        codigo: {
          in: [...new Set(conversiones.map((conversion) => conversion.monedaOriginal))],
        },
      },
    });

    const monedasMap = new Map(
      monedasInfo.map((moneda) => [moneda.codigo, moneda]),
    );

    let gananciaPerdidaTotal = 0;
    let totalConvertido = 0;
    const impactoPorMoneda = new Map<string, {
      codigo: string;
      nombre: string;
      simbolo: string;
      impactoTotal: number;
      volumenConvertido: number;
      transacciones: Array<{
        fecha: string;
        impacto: number;
        monto: number;
        tasa: number;
        tipo: string;
        descripcion: string | null;
      }>;
      tasas: number[];
    }>();

    for (const movimiento of conversiones) {
      const monedaInfo = monedasMap.get(movimiento.monedaOriginal);
      const montoEsperado = movimiento.montoOriginal * movimiento.tasaCambio;
      const impacto = movimiento.montoConvertido - montoEsperado;

      gananciaPerdidaTotal += impacto;
      totalConvertido += movimiento.montoConvertido;

      if (!impactoPorMoneda.has(movimiento.monedaOriginal)) {
        impactoPorMoneda.set(movimiento.monedaOriginal, {
          codigo: movimiento.monedaOriginal,
          nombre: monedaInfo?.nombre || movimiento.monedaOriginal,
          simbolo: monedaInfo?.simbolo || movimiento.monedaOriginal,
          impactoTotal: 0,
          volumenConvertido: 0,
          transacciones: [],
          tasas: [],
        });
      }

      const monedaData = impactoPorMoneda.get(movimiento.monedaOriginal)!;
      monedaData.impactoTotal += impacto;
      monedaData.volumenConvertido += movimiento.montoOriginal;
      monedaData.transacciones.push({
        fecha: movimiento.fecha.toISOString(),
        impacto,
        monto: movimiento.montoOriginal,
        tasa: movimiento.tasaCambio,
        tipo: movimiento.tipo,
        descripcion: movimiento.descripcion,
      });
      monedaData.tasas.push(movimiento.tasaCambio);
    }

    const porMoneda = Array.from(impactoPorMoneda.values()).map((moneda) => {
      const tasaPromedio = moneda.tasas.reduce((sum, tasa) => sum + tasa, 0) / moneda.tasas.length;
      const volatilidad = calculateVolatility(moneda.tasas);

      return {
        codigo: moneda.codigo,
        nombre: moneda.nombre,
        simbolo: moneda.simbolo,
        impactoTotal: moneda.impactoTotal,
        volumenConvertido: moneda.volumenConvertido,
        transacciones: moneda.transacciones,
        tasas: moneda.tasas,
        tasaPromedio,
        volatilidad,
        transaccionesSignificativas: [...moneda.transacciones]
          .sort((a, b) => Math.abs(b.impacto) - Math.abs(a.impacto))
          .slice(0, 5)
          .map((tx) => ({ fecha: tx.fecha, impacto: tx.impacto })),
      };
    });

    const impactoPorCuenta = new Map<string, {
      cuentaId: string;
      nombreBanco: string;
      numeroCuenta: string;
      moneda: string;
      totalConversiones: number;
      volumenTotal: number;
      impactoTotal: number;
      nivelRiesgo: string;
      tiposOperacion: string[];
      riesgoPromedio: number;
    }>();

    for (const movimiento of conversiones) {
      if (!impactoPorCuenta.has(movimiento.cuentaId)) {
        impactoPorCuenta.set(movimiento.cuentaId, {
          cuentaId: movimiento.cuentaId,
          nombreBanco: movimiento.cuenta?.nombreBanco || 'N/A',
          numeroCuenta: movimiento.cuenta?.numeroCuenta || 'N/A',
          moneda: movimiento.cuenta?.moneda || monedaBase,
          totalConversiones: 0,
          volumenTotal: 0,
          impactoTotal: 0,
          nivelRiesgo: 'bajo',
          tiposOperacion: [],
          riesgoPromedio: 0,
        });
      }

      const cuentaData = impactoPorCuenta.get(movimiento.cuentaId)!;
      const montoEsperado = movimiento.montoOriginal * movimiento.tasaCambio;
      const impacto = movimiento.montoConvertido - montoEsperado;
      cuentaData.totalConversiones += 1;
      cuentaData.volumenTotal += movimiento.montoOriginal;
      cuentaData.impactoTotal += impacto;
    }

    const porCuenta = Array.from(impactoPorCuenta.values()).map((cuenta) => {
      const riesgos: number[] = [];
      const tiposOperacion = new Set<string>();

      for (const movimiento of conversiones) {
        if (movimiento.cuentaId === cuenta.cuentaId) {
          const montoEsperado = movimiento.montoOriginal * movimiento.tasaCambio;
          const impacto = movimiento.montoConvertido - montoEsperado;
          riesgos.push(Math.abs(impacto));
          tiposOperacion.add(movimiento.tipo);
        }
      }

      const riesgoPromedio = riesgos.length > 0
        ? riesgos.reduce((sum, riesgo) => sum + riesgo, 0) / riesgos.length
        : 0;
      const nivelRiesgo = riesgoPromedio > 1000 ? 'alto' : riesgoPromedio > 500 ? 'medio' : 'bajo';

      return {
        cuentaId: cuenta.cuentaId,
        nombreBanco: cuenta.nombreBanco,
        numeroCuenta: cuenta.numeroCuenta,
        moneda: cuenta.moneda,
        totalConversiones: cuenta.totalConversiones,
        volumenTotal: cuenta.volumenTotal,
        impactoTotal: cuenta.impactoTotal,
        nivelRiesgo,
        tiposOperacion: Array.from(tiposOperacion),
        riesgoPromedio,
      };
    });

    const volatilidadPromedio = calculateVolatility(
      conversiones.map((conversion) => conversion.tasaCambio),
    );
    const nivelRiesgo = volatilidadPromedio > 0.1 ? 'alto' : volatilidadPromedio > 0.05 ? 'medio' : 'bajo';

    return {
      resumen: {
        gananciaPerdidaTotal,
        totalConvertido,
        nivelRiesgo,
        volatilidadPromedio,
        tipoAnalisis: params.tipoAnalisis || 'general',
      },
      porMoneda,
      porCuenta,
      recomendaciones: generateExchangeImpactRecommendations({
        gananciaPerdidaTotal,
        volatilidadPromedio,
        porMoneda,
        porCuenta,
      }),
      filtros: {
        fechaInicio: params.fechaInicio || null,
        fechaFin: params.fechaFin || null,
        monedaBase,
        tipoAnalisis: params.tipoAnalisis || 'general',
      },
    };
  },

  async getTransfersReport(params: {
    tenantId: string;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    cuentaOrigenId?: string | null;
    cuentaDestinoId?: string | null;
    moneda?: string | null;
    realizadoPor?: string | null;
    export?: string | null;
    page?: number;
    limit?: number;
  }) {
    const dateFilter = buildDateFilter(params.fechaInicio, params.fechaFin);
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;

    const transferencias = await prisma.transferenciaBancaria.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 ? { fechaTransferencia: dateFilter } : {}),
        ...(params.cuentaOrigenId ? { cuentaOrigenId: params.cuentaOrigenId } : {}),
        ...(params.cuentaDestinoId ? { cuentaDestinoId: params.cuentaDestinoId } : {}),
        ...(params.moneda ? {
          OR: [
            { monedaOrigen: params.moneda },
            { monedaDestino: params.moneda },
          ],
        } : {}),
      },
      include: {
        cuentaOrigen: {
          select: {
            cuentaId: true,
            nombreBanco: true,
            numeroCuenta: true,
            moneda: true,
          },
        },
        cuentaDestino: {
          select: {
            cuentaId: true,
            nombreBanco: true,
            numeroCuenta: true,
            moneda: true,
          },
        },
      },
      orderBy: { fechaTransferencia: 'desc' },
    });

    const offset = (page - 1) * limit;
    const transferenciasPaginadas = params.export ? transferencias : transferencias.slice(offset, offset + limit);

    const estadisticas = {
      totalTransferencias: transferencias.length,
      montoTotalPorMoneda: transferencias.reduce((acc: Record<string, number>, trans: any) => {
        const monedaOrigen = trans.monedaOrigen || 'CUP';
        if (!acc[monedaOrigen]) acc[monedaOrigen] = 0;
        acc[monedaOrigen] += Number(trans.montoOrigen);
        return acc;
      }, {}),
      transferenciasConConversion: transferencias.filter((transferencia: any) => transferencia.tasaCambio !== null).length,
      cuentasMasActivas: getMostActiveTransferAccounts(transferencias),
      promedioMontosPorMoneda: getAverageTransferAmountsByCurrency(transferencias),
    };

    const transferenciasFormateadas = transferenciasPaginadas.map((trans: any) => ({
      transferenciaId: trans.transferenciaId,
      numeroComprobante: trans.numeroComprobante,
      fechaTransferencia: trans.fechaTransferencia,
      cuentaOrigen: {
        id: trans.cuentaOrigen.cuentaId,
        banco: trans.cuentaOrigen.nombreBanco,
        numeroCuenta: trans.cuentaOrigen.numeroCuenta,
        moneda: trans.cuentaOrigen.moneda || 'CUP',
      },
      cuentaDestino: {
        id: trans.cuentaDestino.cuentaId,
        banco: trans.cuentaDestino.nombreBanco,
        numeroCuenta: trans.cuentaDestino.numeroCuenta,
        moneda: trans.cuentaDestino.moneda || 'CUP',
      },
      montoOrigen: Number(trans.montoOrigen),
      monedaOrigen: trans.monedaOrigen || 'CUP',
      montoDestino: Number(trans.montoDestino),
      monedaDestino: trans.monedaDestino || 'CUP',
      tasaCambio: trans.tasaCambio ? Number(trans.tasaCambio) : null,
      tieneConversion: trans.monedaOrigen !== trans.monedaDestino,
      motivo: trans.motivo,
      descripcion: trans.descripcion,
      comprobanteGenerado: trans.comprobanteGenerado,
      rutaComprobante: trans.rutaComprobante,
    }));

    return {
      transferencias: transferenciasFormateadas,
      estadisticas,
      paginacion: {
        page,
        limit,
        total: transferencias.length,
        totalPages: Math.ceil(transferencias.length / limit),
      },
      filtros: {
        fechaInicio: params.fechaInicio || null,
        fechaFin: params.fechaFin || null,
        cuentaOrigenId: params.cuentaOrigenId || null,
        cuentaDestinoId: params.cuentaDestinoId || null,
        moneda: params.moneda || null,
        realizadoPor: params.realizadoPor || null,
      },
      exportContent: params.export === 'csv'
        ? generateTransfersCSV(transferenciasFormateadas, estadisticas)
        : null,
    };
  },

  async getOverdueInvoicesReport(params: {
    tenantId: string;
  }) {
    const cuentas = await prisma.cuentaPorCobrar.findMany({
      where: {
        estado: { not: 'PAGADA' },
      },
      include: {
        cliente: true,
        factura: {
          include: {
            venta: {
              include: {
                reconciliaciones: {
                  include: {
                    tipoPago: true,
                    cuentaBancaria: true,
                  },
                  orderBy: {
                    fechaReconciliacion: 'desc',
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const clientesMap = new Map<string, {
      clienteId: string;
      nombre: string;
      corriente: number;
      dias30: number;
      dias60: number;
      dias90: number;
      dias120: number;
      total: number;
    }>();

    const facturas: Array<{
      id: string;
      numero: string | null;
      cliente: string;
      fecha: string;
      dias: number;
      saldo: number;
      categoria: 'Corriente' | '30-60 Días' | '60-90 Días' | '90-120 Días' | '+120 Días';
    }> = [];

    const now = new Date();

    for (const cuenta of cuentas) {
      if (!cuenta.clienteId) continue;

      const toNum = (value: any) => {
        if (!value) return 0;
        if (typeof value === 'object' && 'toNumber' in value) return value.toNumber();
        return Number(value);
      };

      const totalFactura = toNum(cuenta.factura?.total ?? cuenta.factura?.venta?.total ?? cuenta.montoDeuda);
      const reconciliaciones = cuenta.factura?.venta?.reconciliaciones ?? [];
      const totalPagadoFactura = (reconciliaciones as any[]).reduce(
        (sum, rec) => sum + toNum(rec?.monto),
        0,
      );
      const totalPagado = Math.max(totalPagadoFactura, toNum(cuenta.montoPagado));
      const saldoPendiente = Math.max(0, totalFactura - totalPagado);

      if (saldoPendiente <= 0.01) continue;

      const fechaReferencia = new Date(cuenta.createdAt);
      const diffTime = Math.abs(now.getTime() - fechaReferencia.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let bucket: 'Corriente' | '30-60 Días' | '60-90 Días' | '90-120 Días' | '+120 Días' = 'Corriente';

      if (!clientesMap.has(cuenta.clienteId)) {
        clientesMap.set(cuenta.clienteId, {
          clienteId: cuenta.clienteId,
          nombre: cuenta.cliente.nombre,
          corriente: 0,
          dias30: 0,
          dias60: 0,
          dias90: 0,
          dias120: 0,
          total: 0,
        });
      }

      const clienteData = clientesMap.get(cuenta.clienteId)!;

      if (diffDays <= 30) {
        clienteData.corriente += saldoPendiente;
        bucket = 'Corriente';
      } else if (diffDays <= 60) {
        clienteData.dias30 += saldoPendiente;
        bucket = '30-60 Días';
      } else if (diffDays <= 90) {
        clienteData.dias60 += saldoPendiente;
        bucket = '60-90 Días';
      } else if (diffDays <= 120) {
        clienteData.dias90 += saldoPendiente;
        bucket = '90-120 Días';
      } else {
        clienteData.dias120 += saldoPendiente;
        bucket = '+120 Días';
      }

      clienteData.total += saldoPendiente;

      facturas.push({
        id: cuenta.facturaId || cuenta.id,
        numero: cuenta.factura?.numeroFactura || cuenta.numeroFactura || 'S/N',
        cliente: cuenta.cliente.nombre,
        fecha: cuenta.createdAt.toISOString(),
        dias: diffDays,
        saldo: saldoPendiente,
        categoria: bucket,
      });
    }

    const reporte = Array.from(clientesMap.values()).sort((a, b) => b.total - a.total);
    facturas.sort((a, b) => b.dias - a.dias);

    return { reporte, facturas };
  },

  async getClientAccountAnalysisReport(params: {
    tenantId: string;
    clienteId: string;
  }) {
    const receivables = await AccountingAccountsService.listReceivables({
      tenantId: params.tenantId,
      clienteId: params.clienteId,
      page: 1,
      limit: 1000,
    });

    const cuentasPendientes = receivables.cuentas.filter((cuenta: any) => {
      const saldoRaw = cuenta?.saldoFactura ?? cuenta?.montoDeuda ?? 0;
      const saldo = Number.isFinite(Number(saldoRaw))
        ? Number(saldoRaw)
        : Number(cuenta?.montoDeuda ?? 0) - Number(cuenta?.montoPagado ?? 0);
      return saldo > 0.01;
    });

    const today = new Date();
    const estadisticas = cuentasPendientes.reduce((acc, curr: any) => {
      const saldoRaw = curr?.saldoFactura ?? curr?.montoDeuda ?? 0;
      const saldo = Number.isFinite(Number(saldoRaw))
        ? Number(saldoRaw)
        : Number(curr?.montoDeuda ?? 0) - Number(curr?.montoPagado ?? 0);

      if (saldo <= 0.01) return acc;

      acc.totalDeuda += saldo;
      acc.facturasPendientes += 1;

      if (curr.estado === 'PARCIAL') {
        acc.pagosParciales += 1;
      }

      if (curr.fechaVencimiento && new Date(curr.fechaVencimiento) < today) {
        acc.totalVencido += saldo;
      }

      return acc;
    }, {
      totalDeuda: 0,
      totalVencido: 0,
      facturasPendientes: 0,
      pagosParciales: 0,
    });

    const facturas = await prisma.factura.findMany({
      where: {
        tenantId: params.tenantId,
        clienteId: params.clienteId,
      },
      include: {
        serie: { select: { serieId: true, prefijo: true, descripcion: true } },
        cliente: { select: { clienteId: true, nombre: true, direccion: true, telefono: true } },
        venta: {
          include: {
            puntoDeVenta: { select: { pvId: true, nombre: true } },
            producto: { select: { id: true, nombre: true, precioVenta: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const historialFacturas = facturas.map((factura: any) => ({
      ...factura,
      subtotal: Number(factura.subtotal),
      total: Number(factura.total),
      descuento: Number(factura.descuento ?? 0),
      impuestos: Number(factura.impuestos ?? 0),
      cargoTransporte: Number(factura.cargoTransporte ?? 0),
      tasaCambio: factura.tasaCambio ? Number(factura.tasaCambio) : null,
    }));

    const latestActivityCandidates = cuentasPendientes
      .map((cuenta: any) => new Date(cuenta.updatedAt).getTime())
      .filter((time: number) => !Number.isNaN(time));

    return {
      clienteId: params.clienteId,
      estadisticas,
      cuentasPendientes,
      historialFacturas,
      ultimaActividad: latestActivityCandidates.length > 0
        ? new Date(Math.max(...latestActivityCandidates)).toISOString()
        : null,
    };
  },

  async getCustomerAdvancesReport(params: {
    tenantId: string;
    clienteId?: string | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
  }) {
    const anticipos = await prisma.anticipo.findMany({
      where: {
        tenantId: params.tenantId,
        tipo: 'COBRO',
        ...(params.clienteId ? { clienteId: params.clienteId } : {}),
        ...(params.fechaInicio || params.fechaFin
          ? {
              fechaReserva: {
                ...(params.fechaInicio ? { gte: new Date(params.fechaInicio) } : {}),
                ...(params.fechaFin ? { lte: new Date(params.fechaFin) } : {}),
              },
            }
          : {}),
      },
      include: {
        cliente: { select: { clienteId: true, nombre: true } },
        contrato: { select: { contratoId: true, numeroContrato: true } },
      },
      orderBy: { fechaReserva: 'desc' },
    });

    const grouped = new Map<string, {
      cliente: { clienteId: string; nombre: string } | null;
      anticipos: typeof anticipos;
      totales: { totalOriginal: number; totalEjecutado: number; totalPendiente: number };
    }>();

    for (const anticipo of anticipos) {
      const key = anticipo.clienteId || 'sin-cliente';
      const current = grouped.get(key) || {
        cliente: anticipo.cliente || null,
        anticipos: [],
        totales: { totalOriginal: 0, totalEjecutado: 0, totalPendiente: 0 },
      };

      const montoOriginal = Number(anticipo.montoOriginal || 0);
      const saldoDisponible = Number(anticipo.saldoDisponible || 0);
      current.anticipos.push(anticipo);
      current.totales.totalOriginal += montoOriginal;
      current.totales.totalEjecutado += montoOriginal - saldoDisponible;
      current.totales.totalPendiente += saldoDisponible;
      grouped.set(key, current);
    }

    return { clientes: Array.from(grouped.values()) };
  },

  async getProviderAdvancesReport(params: {
    tenantId: string;
    proveedorId?: string | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
  }) {
    const anticipos = await prisma.anticipo.findMany({
      where: {
        tenantId: params.tenantId,
        tipo: 'PAGO',
        ...(params.proveedorId ? { proveedorId: params.proveedorId } : {}),
        ...(params.fechaInicio || params.fechaFin
          ? {
              fechaReserva: {
                ...(params.fechaInicio ? { gte: new Date(params.fechaInicio) } : {}),
                ...(params.fechaFin ? { lte: new Date(params.fechaFin) } : {}),
              },
            }
          : {}),
      },
      include: {
        proveedor: { select: { vendorId: true, nombre: true } },
        contrato: { select: { contratoId: true, numeroContrato: true } },
      },
      orderBy: { fechaReserva: 'desc' },
    });

    const grouped = new Map<string, {
      proveedor: { vendorId: string; nombre: string } | null;
      anticipos: typeof anticipos;
      totales: { totalOriginal: number; totalEjecutado: number; totalPendiente: number };
    }>();

    for (const anticipo of anticipos) {
      const key = anticipo.proveedorId || 'sin-proveedor';
      const current = grouped.get(key) || {
        proveedor: anticipo.proveedor || null,
        anticipos: [],
        totales: { totalOriginal: 0, totalEjecutado: 0, totalPendiente: 0 },
      };

      const montoOriginal = Number(anticipo.montoOriginal || 0);
      const saldoDisponible = Number(anticipo.saldoDisponible || 0);
      current.anticipos.push(anticipo);
      current.totales.totalOriginal += montoOriginal;
      current.totales.totalEjecutado += montoOriginal - saldoDisponible;
      current.totales.totalPendiente += saldoDisponible;
      grouped.set(key, current);
    }

    return { proveedores: Array.from(grouped.values()) };
  },

  async getAdvancesSummaryReport(params: {
    tenantId: string;
    tipo?: 'PAGO' | 'COBRO' | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
  }) {
    const anticipos = await prisma.anticipo.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.tipo ? { tipo: params.tipo } : {}),
        ...(params.fechaInicio || params.fechaFin
          ? {
              fechaReserva: {
                ...(params.fechaInicio ? { gte: new Date(params.fechaInicio) } : {}),
                ...(params.fechaFin ? { lte: new Date(params.fechaFin) } : {}),
              },
            }
          : {}),
      },
      select: {
        tipo: true,
        estado: true,
        moneda: true,
        montoOriginal: true,
        saldoDisponible: true,
      },
    });

    const porTipo = anticipos.reduce((acc: Record<string, number>, anticipo) => {
      const key = anticipo.tipo || 'UNKNOWN';
      acc[key] = (acc[key] || 0) + Number(anticipo.montoOriginal || 0);
      return acc;
    }, {});

    const porEstado = anticipos.reduce((acc: Record<string, number>, anticipo) => {
      const key = anticipo.estado || 'UNKNOWN';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const porMoneda = anticipos.reduce((acc: Record<string, { total: number; pendiente: number }>, anticipo) => {
      const key = anticipo.moneda || 'CUP';
      if (!acc[key]) acc[key] = { total: 0, pendiente: 0 };
      acc[key].total += Number(anticipo.montoOriginal || 0);
      acc[key].pendiente += Number(anticipo.saldoDisponible || 0);
      return acc;
    }, {});

    const totalAnticipos = anticipos.reduce((sum, anticipo) => sum + Number(anticipo.montoOriginal || 0), 0);
    const totalPendiente = anticipos.reduce((sum, anticipo) => sum + Number(anticipo.saldoDisponible || 0), 0);

    return {
      resumen: {
        porTipo,
        porEstado,
        porMoneda,
        totalesGenerales: {
          totalAnticipos,
          totalEjecutado: totalAnticipos - totalPendiente,
          totalPendiente,
        },
      },
    };
  },
};
