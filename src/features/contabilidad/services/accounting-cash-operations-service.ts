import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import {
  calcularSaldoPendientePrestamo,
  normalizarEstadoPrestamoCash,
} from '@/lib/utils/prestamo-cash';
import {
  calcularSaldoPendienteDeuda,
  normalizarEstadoDeudaCash,
} from '@/lib/utils/deuda-cash';

const PRESTAMO_INCLUDE = {
  cliente: { select: { clienteId: true, nombre: true } },
  cuentaPorCobrar: true,
  reconciliaciones: {
    include: { tipoPago: true, cuentaBancaria: true },
    orderBy: { fechaReconciliacion: 'desc' as const },
  },
} as const;

const DEUDA_INCLUDE = {
  proveedor: { select: { vendorId: true, nombre: true } },
  cuentaPorPagar: true,
  reconciliaciones: {
    include: { tipoPago: true, cuentaBancaria: true },
    orderBy: { fechaReconciliacion: 'desc' as const },
  },
} as const;

function prestamosCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== 'false';
}

function deudasCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false';
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

/**
 * @description Servicio compartido para lecturas de préstamos/deudas cash en web y mobile.
 */
export const AccountingCashOperationsService = {
  async listCashLoans(params: {
    tenantId: string;
    estado?: string | null;
    clienteId?: string | null;
    moneda?: string | null;
    page?: number;
    limit?: number;
  }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId: params.tenantId, deletedAt: null };
    if (params.estado) where.estado = params.estado;
    if (params.clienteId) where.clienteId = params.clienteId;
    if (params.moneda) where.moneda = params.moneda;

    const [prestamos, total] = await Promise.all([
      prisma.prestamoCash.findMany({
        where,
        include: PRESTAMO_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.prestamoCash.count({ where }),
    ]);

    return {
      prestamos: prestamos.map((prestamo) => ({
        ...prestamo,
        estado: normalizarEstadoPrestamoCash(prestamo.estado, {
          montoDeuda: Number(prestamo.cuentaPorCobrar?.montoDeuda ?? prestamo.montoCapital),
          montoPagado: Number(prestamo.cuentaPorCobrar?.montoPagado ?? 0),
          estado: prestamo.cuentaPorCobrar?.estado,
        }),
        saldoPendiente: calcularSaldoPendientePrestamo(
          Number(prestamo.cuentaPorCobrar?.montoDeuda ?? prestamo.montoCapital),
          Number(prestamo.cuentaPorCobrar?.montoPagado ?? 0),
        ),
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },

  async getCashLoanById(params: { tenantId: string; id: string }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const prestamo = await prisma.prestamoCash.findFirst({
      where: { id: params.id, tenantId: params.tenantId, deletedAt: null },
      include: {
        cliente: { select: { clienteId: true, nombre: true } },
        cuentaPorCobrar: true,
      },
    });

    if (!prestamo) {
      throw new ActionError('Préstamo no encontrado', 'NOT_FOUND');
    }

    return prestamo;
  },

  async getCashLoanHistory(params: { tenantId: string; id: string }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const prestamo = await prisma.prestamoCash.findFirst({
      where: { id: params.id, tenantId: params.tenantId, deletedAt: null },
      include: {
        cliente: { select: { clienteId: true, nombre: true } },
        cuentaPorCobrar: true,
      },
    });

    if (!prestamo) {
      throw new ActionError('Préstamo no encontrado', 'NOT_FOUND');
    }

    const historial = await prisma.reconciliacionVenta.findMany({
      where: { prestamoCashId: params.id, tipoReconciliacion: 'PRESTAMO_CASH' },
      include: {
        cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } },
        tipoPago: { select: { nombre: true } },
      },
      orderBy: { fechaReconciliacion: 'desc' },
    });

    const montoCapital = toNumber(prestamo.montoCapital);
    const totalDeuda = toNumber(prestamo.cuentaPorCobrar.montoDeuda);
    const montoPagado = toNumber(prestamo.cuentaPorCobrar.montoPagado);
    const saldoPendiente = totalDeuda - montoPagado;

    return {
      prestamo: {
        ...prestamo,
        montoCapital,
        tasaInteres: prestamo.tasaInteres != null ? toNumber(prestamo.tasaInteres) : null,
        cuentaPorCobrar: {
          ...prestamo.cuentaPorCobrar,
          montoDeuda: totalDeuda,
          montoPagado,
        },
      },
      resumen: {
        montoCapital,
        totalDeuda,
        montoPagado,
        saldoPendiente,
        cantidadPagos: historial.length,
      },
      historial: historial.map((pago) => ({
        id: pago.reconciliacionId,
        fecha: pago.fechaReconciliacion,
        monto: toNumber(pago.monto),
        moneda: pago.moneda,
        tasaCambio: pago.tasaCambio != null ? toNumber(pago.tasaCambio) : null,
        montoConvertido: pago.montoConvertido != null ? toNumber(pago.montoConvertido) : null,
        observaciones: pago.observaciones,
        tipoPago: pago.tipoPago.nombre,
        cuentaBancaria: `${pago.cuentaBancaria.nombreBanco} - ${pago.cuentaBancaria.numeroCuenta}`,
      })),
    };
  },

  async getCashLoanStats(params: { tenantId: string }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const [totalActivos, totalPagados, totalVencidos, montosPorMoneda, cuentasPendientes, resumenMovimientos] =
      await Promise.all([
        prisma.prestamoCash.count({ where: { tenantId: params.tenantId, estado: 'ACTIVO', deletedAt: null } }),
        prisma.prestamoCash.count({ where: { tenantId: params.tenantId, estado: 'PAGADO', deletedAt: null } }),
        prisma.prestamoCash.count({ where: { tenantId: params.tenantId, estado: 'VENCIDO', deletedAt: null } }),
        prisma.prestamoCash.groupBy({
          by: ['moneda'],
          where: { tenantId: params.tenantId, estado: { not: 'CANCELADO' }, deletedAt: null },
          _sum: { montoCapital: true },
        }),
        prisma.cuentaPorCobrar.findMany({
          where: {
            tenantId: params.tenantId,
            tipoCuenta: 'PRESTAMO_CASH',
            estado: { not: 'PAGADA' },
          },
          select: {
            montoDeuda: true,
            montoPagado: true,
            prestamoCash: { select: { moneda: true } },
          },
        }),
        prisma.reconciliacionVenta.aggregate({
          where: { tenantId: params.tenantId, tipoReconciliacion: 'PRESTAMO_CASH' },
          _sum: { monto: true },
          _avg: { monto: true },
        }),
      ]);

    const montoPendienteCobro: Record<string, number> = {};
    for (const cuenta of cuentasPendientes) {
      const moneda = cuenta.prestamoCash?.moneda ?? 'CUP';
      const pendiente = Number(cuenta.montoDeuda) - Number(cuenta.montoPagado);
      montoPendienteCobro[moneda] = (montoPendienteCobro[moneda] ?? 0) + pendiente;
    }

    const montoTotalPrestado: Record<string, number> = {};
    for (const grupo of montosPorMoneda) {
      montoTotalPrestado[grupo.moneda] = Number(grupo._sum.montoCapital ?? 0);
    }

    return {
      totalActivos,
      totalPagados,
      totalVencidos,
      montoTotalPrestado,
      montoPendienteCobro,
      resumenMovimientos: {
        totalPagos: Number(resumenMovimientos._sum.monto ?? 0),
        promedioPago: Number(resumenMovimientos._avg.monto ?? 0),
      },
    };
  },

  async listCashDebts(params: {
    tenantId: string;
    estado?: string | null;
    proveedorId?: string | null;
    moneda?: string | null;
    page?: number;
    limit?: number;
  }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }

    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId: params.tenantId, deletedAt: null };
    if (params.estado) where.estado = params.estado;
    if (params.proveedorId) where.proveedorId = params.proveedorId;
    if (params.moneda) where.moneda = params.moneda;

    const [deudas, total] = await Promise.all([
      prisma.deudaCash.findMany({
        where,
        include: DEUDA_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.deudaCash.count({ where }),
    ]);

    return {
      deudas: deudas.map((deuda) => ({
        ...deuda,
        estado: normalizarEstadoDeudaCash(deuda.estado, {
          montoDeuda: Number(deuda.cuentaPorPagar?.montoDeuda ?? deuda.montoCapital),
          montoPagado: Number(deuda.cuentaPorPagar?.montoPagado ?? 0),
          estado: deuda.cuentaPorPagar?.estado,
        }),
        saldoPendiente: calcularSaldoPendienteDeuda(
          Number(deuda.cuentaPorPagar?.montoDeuda ?? deuda.montoCapital),
          Number(deuda.cuentaPorPagar?.montoPagado ?? 0),
        ),
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },

  async getCashDebtById(params: { tenantId: string; id: string }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }

    const deuda = await prisma.deudaCash.findFirst({
      where: { id: params.id, tenantId: params.tenantId, deletedAt: null },
      include: {
        proveedor: { select: { vendorId: true, nombre: true } },
        cuentaPorPagar: true,
      },
    });

    if (!deuda) {
      throw new ActionError('Deuda no encontrada', 'NOT_FOUND');
    }

    return deuda;
  },

  async getCashDebtStats(params: { tenantId: string }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }

    const [totalActivas, totalPagadas, totalVencidas, montosPorMoneda, cuentasPendientes] =
      await Promise.all([
        prisma.deudaCash.count({ where: { tenantId: params.tenantId, estado: 'ACTIVO', deletedAt: null } }),
        prisma.deudaCash.count({ where: { tenantId: params.tenantId, estado: 'PAGADO', deletedAt: null } }),
        prisma.deudaCash.count({ where: { tenantId: params.tenantId, estado: 'VENCIDO', deletedAt: null } }),
        prisma.deudaCash.groupBy({
          by: ['moneda'],
          where: { tenantId: params.tenantId, estado: { not: 'CANCELADO' }, deletedAt: null },
          _sum: { montoCapital: true },
        }),
        prisma.cuentaPorPagar.findMany({
          where: {
            tenantId: params.tenantId,
            tipoDeuda: 'DEUDA_CASH',
            estado: { not: 'PAGADA' },
          },
          select: {
            montoDeuda: true,
            montoPagado: true,
            deudaCash: { select: { moneda: true } },
          },
        }),
      ]);

    const montoPendientePago: Record<string, number> = {};
    for (const cuenta of cuentasPendientes) {
      const moneda = cuenta.deudaCash?.moneda ?? 'CUP';
      const pendiente = Number(cuenta.montoDeuda) - Number(cuenta.montoPagado);
      montoPendientePago[moneda] = (montoPendientePago[moneda] ?? 0) + pendiente;
    }

    const montoTotalDeuda: Record<string, number> = {};
    for (const grupo of montosPorMoneda) {
      montoTotalDeuda[grupo.moneda] = Number(grupo._sum.montoCapital ?? 0);
    }

    return {
      totalActivas,
      totalPagadas,
      totalVencidas,
      montoTotalDeuda,
      montoPendientePago,
    };
  },
};
