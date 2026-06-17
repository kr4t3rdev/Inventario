import { prisma } from '@/lib/prisma';
import {
  getCuentasPorCobrarSchema,
  getCuentasPorPagarSchema,
} from '@/features/contabilidad/schemas-cuentas';

const CXC_INCLUDE = {
  cliente: { select: { clienteId: true, nombre: true } },
  factura: {
    select: {
      idFactura: true,
      total: true,
      numeroFactura: true,
      createdAt: true,
      venta: {
        select: {
          ventaId: true,
          total: true,
          reconciliaciones: {
            select: {
              reconciliacionId: true,
              monto: true,
              moneda: true,
              tasaCambio: true,
              idTransferencia: true,
              fechaReconciliacion: true,
              tipoPago: { select: { nombre: true } },
              cuentaBancaria: { select: { nombreBanco: true } },
            },
          },
          cliente: { select: { nombre: true } },
        },
      },
    },
  },
  prestamoCash: {
    select: {
      id: true,
      idNumerico: true,
      montoCapital: true,
      moneda: true,
      tasaCambioAlCrear: true,
      observaciones: true,
      estado: true,
    },
  },
} as const;

const CXP_INCLUDE = {
  proveedor: {
    select: {
      vendorId: true,
      nombre: true,
      cuentaCUP: true,
      cuentaUSD: true,
    },
  },
  pagos: {
    select: {
      pagoCuentaPorPagarId: true,
      monto: true,
      numeroTransaccion: true,
      cuentaProveedor: true,
      fechaPago: true,
      observaciones: true,
    },
    orderBy: { fechaPago: 'desc' as const },
  },
  deudaCash: {
    select: {
      id: true,
      idNumerico: true,
      montoCapital: true,
      moneda: true,
      estado: true,
    },
  },
} as const;

/**
 * @description Normaliza montos de reconciliación a CUP para cálculos de saldo.
 * @param {number} monto - Monto original.
 * @param {string} moneda - Moneda del monto.
 * @param {number | null} tasaCambio - Tasa de cambio usada para conversión.
 * @returns {number} Monto normalizado en CUP.
 */
function normalizarMontoReconciliacion(
  monto: number,
  moneda: string,
  tasaCambio: number | null,
): number {
  if (
    moneda === 'USD' &&
    tasaCambio &&
    Number.isFinite(Number(tasaCambio)) &&
    Number(tasaCambio) > 0
  ) {
    return monto * Number(tasaCambio);
  }

  return monto;
}

/**
 * @description Calcula antigüedad contable en días y rango.
 * @param {Date} fecha - Fecha base de la operación.
 * @returns {{ rangoAntiguedad: string; diasTranscurridos: number }} Antigüedad calculada.
 */
function computeAging(fecha: Date): {
  rangoAntiguedad: string;
  diasTranscurridos: number;
} {
  const now = new Date();
  const diffMs = now.getTime() - fecha.getTime();
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (dias <= 30) return { rangoAntiguedad: '0-30', diasTranscurridos: dias };
  if (dias <= 60) return { rangoAntiguedad: '31-60', diasTranscurridos: dias };
  if (dias <= 90) return { rangoAntiguedad: '61-90', diasTranscurridos: dias };

  return { rangoAntiguedad: '90+', diasTranscurridos: dias };
}

/**
 * @description Enriquece una cuenta por cobrar con saldos y datos derivados.
 * @param {Record<string, unknown>} cuenta - Registro crudo de Prisma.
 * @returns {Record<string, unknown>} Cuenta enriquecida.
 */
function enriquecerCuentaPorCobrar(cuenta: Record<string, unknown>) {
  const facturaRecord = cuenta.factura as Record<string, unknown> | null;
  const ventaRecord = facturaRecord?.venta as Record<string, unknown> | undefined;
  const recs = (ventaRecord?.reconciliaciones ?? []) as Array<{
    monto: number;
    moneda: string;
    tasaCambio: number | null;
  }>;

  const totalPagadoFactura =
    recs.length > 0
      ? recs.reduce(
          (sum, rec) =>
            sum +
            normalizarMontoReconciliacion(Number(rec.monto), rec.moneda, rec.tasaCambio),
          0,
        )
      : Number(cuenta.montoPagado ?? 0);

  const totalFactura = facturaRecord?.total
    ? Number(facturaRecord.total)
    : Number(cuenta.montoDeuda ?? 0);
  const saldoFactura = Math.max(0, totalFactura - totalPagadoFactura);
  const createdAt = cuenta.createdAt as Date;
  const aging = computeAging(createdAt);

  return {
    id: cuenta.id as string,
    idCC: cuenta.idCC as number,
    facturaId: cuenta.facturaId as string | null,
    numeroFactura: cuenta.numeroFactura as string | null,
    clienteId: cuenta.clienteId as string,
    montoDeuda: Number(cuenta.montoDeuda),
    montoPagado: Number(cuenta.montoPagado),
    idTransferencia: cuenta.idTransferencia as string | null,
    estado: cuenta.estado as 'PENDIENTE' | 'PAGADA' | 'PARCIAL',
    tipoCuenta: cuenta.tipoCuenta as string | null,
    fechaVencimiento: cuenta.fechaVencimiento as string | null,
    totalFactura,
    totalPagadoFactura,
    saldoFactura,
    moneda: cuenta.moneda as string,
    cliente: cuenta.cliente as { clienteId: string; nombre: string } | null,
    factura: facturaRecord
      ? {
          ...facturaRecord,
          total: Number(facturaRecord.total),
          venta: (facturaRecord.venta as Record<string, unknown> | null)
            ? {
                ...(facturaRecord.venta as Record<string, unknown>),
                total: Number((facturaRecord.venta as Record<string, unknown>).total),
              }
            : null,
        }
      : null,
    prestamoCash: cuenta.prestamoCash as Record<string, unknown> | null,
    _reconciliaciones: recs as Record<string, unknown>[],
    diasTranscurridos: aging.diasTranscurridos,
    rangoAntiguedad: aging.rangoAntiguedad,
    createdAt,
    updatedAt: cuenta.updatedAt as Date,
  };
}

/**
 * @description Enriquece una cuenta por pagar con métricas derivadas y pagos.
 * @param {Record<string, unknown>} cuenta - Registro crudo de Prisma.
 * @returns {Record<string, unknown>} Cuenta enriquecida.
 */
function enriquecerCuentaPorPagar(cuenta: Record<string, unknown>) {
  const fechaEmision = cuenta.fechaEmision
    ? new Date(cuenta.fechaEmision as string)
    : new Date();
  const aging = Number.isNaN(fechaEmision.getTime())
    ? { rangoAntiguedad: '0-30', diasTranscurridos: 0 }
    : computeAging(fechaEmision);
  const pagos = (cuenta.pagos as Array<Record<string, unknown>> | undefined) ?? [];

  return {
    cuentaPorPagarId: cuenta.cuentaPorPagarId as string,
    numeroFactura: cuenta.numeroFactura as string,
    tipo: cuenta.tipo as 'compra' | 'servicio',
    gastoCompraId: cuenta.gastoCompraId as string | null,
    gastosDEId: cuenta.gastosDEId as string | null,
    proveedorId: cuenta.proveedorId as string | null,
    proveedorNombre: cuenta.proveedorNombre as string | null,
    montoDeuda: Number(cuenta.montoDeuda),
    montoPagado: Number(cuenta.montoPagado),
    saldoPendiente: Number(cuenta.saldoPendiente),
    moneda: cuenta.moneda as string,
    fechaEmision: (cuenta.fechaEmision as Date).toISOString(),
    fechaVencimiento: cuenta.fechaVencimiento
      ? (cuenta.fechaVencimiento as Date).toISOString()
      : null,
    estado: cuenta.estado as 'PENDIENTE' | 'PAGADA' | 'PARCIAL',
    tipoDeuda: cuenta.tipoDeuda as string | null,
    rangoAntiguedad: aging.rangoAntiguedad,
    diasTranscurridos: aging.diasTranscurridos,
    proveedor: cuenta.proveedor as {
      vendorId: string;
      nombre: string;
      cuentaCUP: string | null;
      cuentaUSD: string | null;
    } | null,
    pagos: pagos.map((p) => ({
      pagoCuentaPorPagarId: p.pagoCuentaPorPagarId as string,
      monto: Number(p.monto),
      numeroTransaccion: p.numeroTransaccion as string,
      cuentaProveedor: p.cuentaProveedor as string,
      fechaPago: p.fechaPago as Date,
      observaciones: p.observaciones as string | null,
    })),
    deudaCash: cuenta.deudaCash as {
      id: string;
      idNumerico: number;
      montoCapital: number;
      moneda: string;
      estado: string;
    } | null,
    createdAt: cuenta.createdAt as Date,
    updatedAt: cuenta.updatedAt as Date,
  };
}

/**
 * @description Servicio compartido para lecturas de cuentas por cobrar y pagar.
 */
export const AccountingAccountsService = {
  /**
   * @description Lista cuentas por cobrar filtradas para web o mobile.
   * @param {{ tenantId: string; estado?: 'PENDIENTE' | 'PAGADA' | 'PARCIAL' | null; clienteId?: string | null; search?: string | null; page?: number; limit?: number }} input - Filtros y paginación.
   * @returns {Promise<{ cuentas: ReturnType<typeof enriquecerCuentaPorCobrar>[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>} Resultado paginado.
   */
  async listReceivables(input: {
    tenantId: string;
    estado?: 'PENDIENTE' | 'PAGADA' | 'PARCIAL' | null;
    clienteId?: string | null;
    search?: string | null;
    page?: number;
    limit?: number;
  }) {
    const f = getCuentasPorCobrarSchema.parse({
      estado: input.estado ?? undefined,
      clienteId: input.clienteId ?? undefined,
      search: input.search ?? undefined,
      page: input.page,
      limit: input.limit,
    });

    const where: Record<string, unknown> = { tenantId: input.tenantId };
    if (f.estado) where.estado = f.estado;
    if (f.clienteId) where.clienteId = f.clienteId;
    if (f.search) {
      where.OR = [
        { numeroFactura: { contains: f.search, mode: 'insensitive' } },
        { cliente: { nombre: { contains: f.search, mode: 'insensitive' } } },
      ];
    }

    const skip = (f.page - 1) * f.limit;
    const [cuentasRaw, total] = await Promise.all([
      prisma.cuentaPorCobrar.findMany({
        where,
        include: CXC_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: f.limit,
      }),
      prisma.cuentaPorCobrar.count({ where }),
    ]);

    return {
      cuentas: cuentasRaw.map((cuenta) =>
        enriquecerCuentaPorCobrar(cuenta as unknown as Record<string, unknown>),
      ),
      pagination: {
        page: f.page,
        limit: f.limit,
        total,
        totalPages: Math.ceil(total / f.limit),
      },
    };
  },

  /**
   * @description Retorna métricas agregadas de cuentas por cobrar.
   * @param {{ tenantId: string }} input - Tenant de la consulta.
   * @returns {Promise<{ totalPendiente: number; porVencer: number; vencidas: number; totalCuentas: number }>} Resumen agregado.
   */
  async getReceivablesMetrics(input: { tenantId: string }) {
    const ahora = new Date();

    const pendientesAgg = await prisma.cuentaPorCobrar.aggregate({
      where: { tenantId: input.tenantId, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      _sum: { montoDeuda: true },
    });

    const [vencidas, totalCuentas] = await Promise.all([
      prisma.cuentaPorCobrar.count({
        where: {
          tenantId: input.tenantId,
          estado: { not: 'PAGADA' },
          fechaVencimiento: { lt: ahora, not: null },
        },
      }),
      prisma.cuentaPorCobrar.count({ where: { tenantId: input.tenantId } }),
    ]);

    return {
      totalPendiente: Number(pendientesAgg._sum.montoDeuda ?? 0),
      porVencer: totalCuentas - vencidas,
      vencidas,
      totalCuentas,
    };
  },

  /**
   * @description Lista cuentas por pagar con métricas agregadas.
   * @param {{ tenantId: string; estado?: 'PENDIENTE' | 'PAGADA' | 'PARCIAL' | null; tipo?: 'compra' | 'servicio' | null; search?: string | null; page?: number; limit?: number }} input - Filtros y paginación.
   * @returns {Promise<{ cuentas: ReturnType<typeof enriquecerCuentaPorPagar>[]; pagination: { page: number; limit: number; total: number; totalPages: number }; metricas: { totalCuentas: number; totalFacturado: number; totalPagado: number; totalSaldo: number; cuentasPendientes: number; cuentasPagadas: number } }>} Resultado paginado con métricas.
   */
  async listPayables(input: {
    tenantId: string;
    estado?: 'PENDIENTE' | 'PAGADA' | 'PARCIAL' | null;
    tipo?: 'compra' | 'servicio' | null;
    search?: string | null;
    page?: number;
    limit?: number;
  }) {
    const f = getCuentasPorPagarSchema.parse({
      estado: input.estado ?? undefined,
      tipo: input.tipo ?? undefined,
      search: input.search ?? undefined,
      page: input.page,
      limit: input.limit,
    });

    const where: Record<string, unknown> = { tenantId: input.tenantId, deletedAt: null };
    if (f.estado) where.estado = f.estado;
    if (f.tipo) where.tipo = f.tipo;
    if (f.search) {
      where.OR = [
        { numeroFactura: { contains: f.search, mode: 'insensitive' } },
        { proveedorNombre: { contains: f.search, mode: 'insensitive' } },
      ];
    }

    const skip = (f.page - 1) * f.limit;
    const [cuentasRaw, total, aggregates, pendientes, pagadas] = await Promise.all([
      prisma.cuentaPorPagar.findMany({
        where,
        include: CXP_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: f.limit,
      }),
      prisma.cuentaPorPagar.count({ where }),
      prisma.cuentaPorPagar.aggregate({
        where,
        _sum: { montoDeuda: true, montoPagado: true, saldoPendiente: true },
      }),
      prisma.cuentaPorPagar.count({ where: { ...where, estado: 'PENDIENTE' } }),
      prisma.cuentaPorPagar.count({ where: { ...where, estado: 'PAGADA' } }),
    ]);

    return {
      cuentas: cuentasRaw.map((cuenta) =>
        enriquecerCuentaPorPagar(cuenta as unknown as Record<string, unknown>),
      ),
      pagination: {
        page: f.page,
        limit: f.limit,
        total,
        totalPages: Math.ceil(total / f.limit),
      },
      metricas: {
        totalCuentas: total,
        totalFacturado: Number(aggregates._sum.montoDeuda ?? 0),
        totalPagado: Number(aggregates._sum.montoPagado ?? 0),
        totalSaldo: Number(aggregates._sum.saldoPendiente ?? 0),
        cuentasPendientes: pendientes,
        cuentasPagadas: pagadas,
      },
    };
  },
};
