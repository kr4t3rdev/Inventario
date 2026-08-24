import { ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';

interface BankAccountHistoryParams {
  tenantId: string;
  cuentaId: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  tipoMovimiento?: string | null;
  page?: number;
  limit?: number;
}

interface HistorialTransaccion {
  transaccionId: string;
  fecha: Date;
  tipoMovimiento: string;
  descripcion: string;
  montoOriginal: number;
  monedaOriginal: string;
  tasaCambio: number | null;
  montoConvertido: number;
  observaciones?: string;
}

const CUENTA_SELECT = {
  cuentaId: true,
  nombreBanco: true,
  numeroCuenta: true,
  tipoCuenta: true,
  saldo: true,
  moneda: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Shared read service for bank-account mobile/web adapters.
 */
export const BankAccountReadService = {
  async list(tenantId: string) {
    const cuentas = await prisma.cuentaBancaria.findMany({
      where: { tenantId },
      select: CUENTA_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return { cuentas: cuentas.map((cuenta) => ({ ...cuenta, saldo: Number(cuenta.saldo) })) };
  },

  async getById({ tenantId, cuentaId }: { tenantId: string; cuentaId: string }) {
    const cuenta = await prisma.cuentaBancaria.findFirst({
      where: { tenantId, cuentaId },
      select: CUENTA_SELECT,
    });

    if (!cuenta) {
      throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
    }

    return { ...cuenta, saldo: Number(cuenta.saldo) };
  },

  async getHistory({
    tenantId,
    cuentaId,
    fechaInicio,
    fechaFin,
    tipoMovimiento,
    page = 1,
    limit = 50,
  }: BankAccountHistoryParams) {
    const cuenta = await prisma.cuentaBancaria.findFirst({
      where: { tenantId, cuentaId },
      select: { cuentaId: true, saldo: true, moneda: true },
    });

    if (!cuenta) {
      throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
    }

    const dateFilter: Record<string, Date> = {};
    if (fechaInicio) dateFilter.gte = new Date(fechaInicio);
    if (fechaFin) dateFilter.lte = new Date(fechaFin);
    const sf = Object.keys(dateFilter).length ? { gte: dateFilter.gte!, lte: dateFilter.lte! } : {};
    const wf = Object.keys(sf).length ? { fechaReconciliacion: sf } : {};

    const [rV, rS, rG, aj, tO, tD, iC, pD] = await Promise.all([
      prisma.reconciliacionVenta.findMany({ where: { cuentaId, ...wf }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, fechaReconciliacion: true, observaciones: true, tipoReconciliacion: true } }),
      prisma.reconciliacionServicio.findMany({ where: { cuentaId, ...wf }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, fechaReconciliacion: true, observaciones: true } }),
      prisma.reconciliacionGasto.findMany({ where: { cuentaId, ...wf }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, descripcion: true, fechaReconciliacion: true, observaciones: true } }),
      prisma.ajusteBancario.findMany({ where: { cuentaId, ...(Object.keys(sf).length ? { fechaOperacion: sf } : {}) }, select: { ajusteId: true, tipo: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, descripcion: true, motivo: true, fechaOperacion: true, createdAt: true } }),
      prisma.transferenciaBancaria.findMany({ where: { cuentaOrigenId: cuentaId, ...(Object.keys(sf).length ? { fechaTransferencia: sf } : {}) }, select: { transferenciaId: true, montoOrigen: true, monedaOrigen: true, montoDestino: true, tasaCambio: true, fechaTransferencia: true, descripcion: true, cuentaDestino: { select: { nombreBanco: true, numeroCuenta: true } } } }),
      prisma.transferenciaBancaria.findMany({ where: { cuentaDestinoId: cuentaId, ...(Object.keys(sf).length ? { fechaTransferencia: sf } : {}) }, select: { transferenciaId: true, montoOrigen: true, montoDestino: true, monedaDestino: true, tasaCambio: true, fechaTransferencia: true, descripcion: true, cuentaOrigen: { select: { nombreBanco: true, numeroCuenta: true } } } }),
      prisma.inyeccionCapital.findMany({ where: { cuentaId, ...(Object.keys(sf).length ? { createdAt: sf } : {}) }, select: { id: true, tipo: true, montoRecibido: true, moneda: true, descripcion: true, createdAt: true } }),
      prisma.pagoDeuda.findMany({ where: { cuentaId, ...(Object.keys(sf).length ? { fechaPago: sf } : {}) }, select: { id: true, montoPagado: true, fechaPago: true, comprobante: true, observaciones: true } }),
    ]);

    let transacciones: HistorialTransaccion[] = [];
    transacciones = transacciones.concat(
      rV.map((r): HistorialTransaccion => ({ transaccionId: r.reconciliacionId, fecha: r.fechaReconciliacion, tipoMovimiento: ['PRESTAMO_CASH', 'PRESTAMO_CASH_DESEMBOLSO', 'DEUDA_CASH', 'DEUDA_CASH_DESEMBOLSO'].includes(r.tipoReconciliacion ?? '') ? r.tipoReconciliacion!.toLowerCase() : 'venta', descripcion: 'Venta ' + r.reconciliacionId, montoOriginal: Number(r.monto), monedaOriginal: r.moneda || 'CUP', tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null, montoConvertido: Number(r.montoConvertido || r.monto), observaciones: r.observaciones ?? undefined })),
      rS.map((r): HistorialTransaccion => ({ transaccionId: r.reconciliacionId, fecha: r.fechaReconciliacion, tipoMovimiento: 'servicio', descripcion: 'Servicio ' + r.reconciliacionId, montoOriginal: Number(r.monto), monedaOriginal: r.moneda || 'CUP', tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null, montoConvertido: Number(r.montoConvertido || r.monto), observaciones: r.observaciones ?? undefined })),
      rG.map((r): HistorialTransaccion => ({ transaccionId: r.reconciliacionId, fecha: r.fechaReconciliacion, tipoMovimiento: 'gasto', descripcion: r.descripcion || 'Gasto ' + r.reconciliacionId, montoOriginal: Number(r.monto), monedaOriginal: r.moneda || 'CUP', tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null, montoConvertido: Number(r.montoConvertido || r.monto), observaciones: r.observaciones ?? undefined })),
      aj.map((a): HistorialTransaccion => ({ transaccionId: a.ajusteId, fecha: a.fechaOperacion, tipoMovimiento: a.tipo === 'ingreso' ? 'ajuste_ingreso' : 'ajuste_egreso', descripcion: a.descripcion ?? '', montoOriginal: Number(a.monto), monedaOriginal: a.moneda || 'CUP', tasaCambio: a.tasaCambio ? Number(a.tasaCambio) : null, montoConvertido: Number(a.montoConvertido || a.monto), observaciones: a.motivo ?? undefined })),
      tO.map((t): HistorialTransaccion => ({ transaccionId: t.transferenciaId + '-origen', fecha: t.fechaTransferencia, tipoMovimiento: 'transferencia_salida', descripcion: 'Transferencia a ' + (t.cuentaDestino?.nombreBanco || '') + ' - ' + (t.cuentaDestino?.numeroCuenta || ''), montoOriginal: -Math.abs(Number(t.montoOrigen)), monedaOriginal: t.monedaOrigen || 'CUP', tasaCambio: t.tasaCambio ? Number(t.tasaCambio) : null, montoConvertido: Number(t.montoDestino), observaciones: t.descripcion ?? undefined })),
      tD.map((t): HistorialTransaccion => ({ transaccionId: t.transferenciaId + '-destino', fecha: t.fechaTransferencia, tipoMovimiento: 'transferencia_entrada', descripcion: 'Transferencia desde ' + (t.cuentaOrigen?.nombreBanco || '') + ' - ' + (t.cuentaOrigen?.numeroCuenta || ''), montoOriginal: Number(t.montoDestino), monedaOriginal: t.monedaDestino || 'CUP', tasaCambio: t.tasaCambio ? Number(t.tasaCambio) : null, montoConvertido: Number(t.montoOrigen), observaciones: t.descripcion ?? undefined })),
      iC.map((i): HistorialTransaccion => ({ transaccionId: i.id, fecha: i.createdAt, tipoMovimiento: 'inyeccion_capital', descripcion: i.descripcion || i.tipo, montoOriginal: Number(i.montoRecibido), monedaOriginal: i.moneda || 'CUP', tasaCambio: null, montoConvertido: Number(i.montoRecibido) })),
      pD.map((p): HistorialTransaccion => ({ transaccionId: p.id, fecha: p.fechaPago, tipoMovimiento: 'pago_deuda', descripcion: 'Pago de deuda: ' + (p.comprobante || p.id), montoOriginal: -Math.abs(Number(p.montoPagado)), monedaOriginal: cuenta.moneda || 'CUP', tasaCambio: null, montoConvertido: Number(p.montoPagado), observaciones: p.observaciones ?? undefined })),
    );

    transacciones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    if (tipoMovimiento) {
      transacciones = transacciones.filter((transaccion) => transaccion.tipoMovimiento === tipoMovimiento);
    }

    const total = transacciones.length;
    const offset = (page - 1) * limit;
    const paginated = transacciones.slice(offset, offset + limit);

    return {
      transacciones: paginated,
      resumen: {
        saldoActual: Number(cuenta.saldo),
        totalIngresos: transacciones.filter((t) => t.montoOriginal > 0).reduce((sum, t) => sum + t.montoOriginal, 0),
        totalEgresos: transacciones.filter((t) => t.montoOriginal < 0).reduce((sum, t) => sum + Math.abs(t.montoOriginal), 0),
        totalMovimientos: total,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};
