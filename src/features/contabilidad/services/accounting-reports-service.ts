import { prisma } from '@/lib/prisma';

interface CuentaBancariaResumen {
  cuentaId: string;
  nombreBanco: string;
  numeroCuenta: string;
  saldo: number;
  moneda: string | null;
  tipoCuenta?: string;
}

function buildDateFilter(fechaInicio?: string | null, fechaFin?: string | null): Record<string, Date> {
  const dateFilter: Record<string, Date> = {};
  if (fechaInicio) dateFilter.gte = new Date(fechaInicio);
  if (fechaFin) dateFilter.lte = new Date(fechaFin);
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

    const accountFilter = cuentaId ? { cuentaId } : {};

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
          ...(Object.keys(dateFilter).length > 0 ? { fechaTransferencia: dateFilter } : {}),
          ...(cuentaId ? { OR: [{ cuentaOrigenId: cuentaId }, { cuentaDestinoId: cuentaId }] } : {}),
        },
      }),
      prisma.ajusteBancario.findMany({
        where: { ...accountFilter, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}) },
        select: { tipo: true, monto: true, moneda: true, montoConvertido: true },
      }),
      prisma.inyeccionCapital.findMany({
        where: { ...accountFilter, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}) },
        select: { tipo: true, montoRecibido: true, moneda: true },
      }),
      prisma.pagoDeuda.findMany({
        where: { ...accountFilter, ...(Object.keys(dateFilter).length > 0 ? { fechaPago: dateFilter } : {}) },
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
    const accountFilter = cuentaId ? { cuentaId } : {};

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
        where: { ...(Object.keys(dateFilter).length > 0 ? { fechaTransferencia: dateFilter } : {}), ...(cuentaId ? { OR: [{ cuentaOrigenId: cuentaId }, { cuentaDestinoId: cuentaId }] } : {}), ...(moneda ? { OR: [{ monedaOrigen: moneda }, { monedaDestino: moneda }] } : {}) },
        select: { transferenciaId: true, numeroComprobante: true, montoOrigen: true, monedaOrigen: true, montoDestino: true, monedaDestino: true, tasaCambio: true, motivo: true, descripcion: true, fechaTransferencia: true, cuentaOrigen: { select: { nombreBanco: true, numeroCuenta: true } }, cuentaDestino: { select: { nombreBanco: true, numeroCuenta: true } } }, orderBy: { fechaTransferencia: 'desc' },
      }),
      prisma.ajusteBancario.findMany({
        where: { ...accountFilter, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}), ...(moneda ? { moneda } : {}) },
        select: { ajusteId: true, tipo: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, descripcion: true, motivo: true, realizadoPor: true, createdAt: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } } }, orderBy: { createdAt: 'desc' },
      }),
      prisma.inyeccionCapital.findMany({
        where: { ...accountFilter, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}), ...(moneda ? { moneda } : {}) },
        select: { id: true, tipo: true, montoRecibido: true, moneda: true, descripcion: true, socio: true, entidadPrestamista: true, createdAt: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } } }, orderBy: { createdAt: 'desc' },
      }),
      prisma.pagoDeuda.findMany({
        where: { ...accountFilter, ...(Object.keys(dateFilter).length > 0 ? { fechaPago: dateFilter } : {}), ...(moneda ? { cuentaBancaria: { moneda } } : {}) },
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
};
