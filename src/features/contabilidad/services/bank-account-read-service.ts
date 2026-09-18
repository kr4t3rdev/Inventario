import { ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { getCivilDateRangeInTimeZone } from '@/features/contabilidad/domain/reconciled-result-calculator';
import { ACCOUNTING_TIME_ZONE } from '@/lib/services/fecha-operacion-registry';

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
  montoConvertido: number | null;
  observaciones?: string;
  prestamoCashId?: string | null;
  deudaCashId?: string | null;
}

const INCOME_MOVEMENT_TYPES = new Set([
  'venta',
  'servicio',
  'ajuste_ingreso',
  'transferencia_entrada',
  'inyeccion_capital',
  'prestamo_cash',
  'prestamo_cash_pago',
  'deuda_cash_desembolso',
]);

const EXPENSE_MOVEMENT_TYPES = new Set([
  'gasto',
  'salario',
  'ajuste_egreso',
  'transferencia_salida',
  'pago_deuda',
  'prestamo_cash_desembolso',
  'deuda_cash',
  'deuda_cash_pago',
]);

/**
 * @description Crea un filtro Prisma semiabierto para fechas civiles en la zona contable.
 * @param {string | null | undefined} fechaInicio - Fecha inicial inclusiva.
 * @param {string | null | undefined} fechaFin - Fecha final inclusiva para el usuario.
 * @returns {Record<string, Date>} Límites de fecha con inicio incluido y fin exclusivo.
 */
function buildDateFilter(
  fechaInicio?: string | null,
  fechaFin?: string | null,
): Record<string, Date> {
  return getCivilDateRangeInTimeZone(fechaInicio, fechaFin, ACCOUNTING_TIME_ZONE);
}

/**
 * @description Normaliza códigos de moneda para comparar el importe con la cuenta.
 * @param {string | null | undefined} currency - Código de moneda de entrada.
 * @returns {string} Código normalizado o CUP por defecto.
 */
function normalizeCurrency(currency?: string | null): string {
  return (currency || 'CUP').trim().toUpperCase();
}

/**
 * @description Conserva la ausencia de evidencia de conversión sin fabricar un importe.
 * @param {unknown} value - Valor decimal devuelto por Prisma.
 * @returns {number | null} Número finito o null si no existe.
 */
function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * @description Convierte un importe a la moneda de la cuenta solo cuando la evidencia es válida.
 * @param {HistorialTransaccion} transaction - Movimiento contable.
 * @param {string} accountCurrency - Moneda de la cuenta bancaria.
 * @returns {number | null} Importe comparable o null si no puede convertirse con seguridad.
 */
function getComparableAmount(
  transaction: HistorialTransaccion,
  accountCurrency: string,
): number | null {
  if (normalizeCurrency(transaction.monedaOriginal) === accountCurrency) {
    return Math.abs(transaction.montoOriginal);
  }

  // montoConvertido se persiste hacia la moneda funcional CUP, no necesariamente hacia la
  // moneda de la cuenta. Solo es comparable aquí cuando la cuenta también es CUP y hay tasa.
  if (
    accountCurrency === 'CUP' &&
    transaction.tasaCambio != null &&
    transaction.tasaCambio > 0 &&
    transaction.montoConvertido != null && Number.isFinite(transaction.montoConvertido)
  ) {
    return Math.abs(transaction.montoConvertido);
  }

  return null;
}

/**
 * @description Calcula el resumen de historial sin mezclar monedas no comparables.
 * @param {HistorialTransaccion[]} transactions - Movimientos ya filtrados.
 * @param {string} accountCurrency - Moneda de la cuenta bancaria.
 * @returns {{ totalIngresos: number; totalEgresos: number; monedasNoConvertidas: string[] }} Resumen.
 */
function summarizeTransactions(
  transactions: HistorialTransaccion[],
  accountCurrency: string,
) {
  const unresolvedCurrencies = new Set<string>();
  let totalIngresos = 0;
  let totalEgresos = 0;

  transactions.forEach((transaction) => {
    const amount = getComparableAmount(transaction, accountCurrency);
    if (amount == null) {
      unresolvedCurrencies.add(normalizeCurrency(transaction.monedaOriginal));
      return;
    }

    if (INCOME_MOVEMENT_TYPES.has(transaction.tipoMovimiento)) {
      totalIngresos += amount;
    } else if (EXPENSE_MOVEMENT_TYPES.has(transaction.tipoMovimiento)) {
      totalEgresos += amount;
    }
  });

  return {
    totalIngresos,
    totalEgresos,
    monedasNoConvertidas: Array.from(unresolvedCurrencies).sort(),
  };
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

    const dateFilter = buildDateFilter(fechaInicio, fechaFin);
    const sf = Object.keys(dateFilter).length ? dateFilter : {};
    const wf = Object.keys(sf).length ? { fechaReconciliacion: sf } : {};

    const [rV, rS, rG, aj, tO, tD, iC, pD] = await Promise.all([
      prisma.reconciliacionVenta.findMany({ where: { cuentaId, ...wf }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, fechaReconciliacion: true, observaciones: true, tipoReconciliacion: true, prestamoCashId: true, deudaCashId: true } }),
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
      rV.map((r): HistorialTransaccion => ({ transaccionId: r.reconciliacionId, fecha: r.fechaReconciliacion, tipoMovimiento: ['PRESTAMO_CASH', 'PRESTAMO_CASH_DESEMBOLSO', 'DEUDA_CASH', 'DEUDA_CASH_DESEMBOLSO'].includes(r.tipoReconciliacion ?? '') ? r.tipoReconciliacion!.toLowerCase() : 'venta', descripcion: 'Venta ' + r.reconciliacionId, montoOriginal: Number(r.monto), monedaOriginal: r.moneda || 'CUP', tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null, montoConvertido: toNullableNumber(r.montoConvertido), observaciones: r.observaciones ?? undefined, prestamoCashId: r.prestamoCashId ?? null, deudaCashId: r.deudaCashId ?? null })),
      rS.map((r): HistorialTransaccion => ({ transaccionId: r.reconciliacionId, fecha: r.fechaReconciliacion, tipoMovimiento: 'servicio', descripcion: 'Servicio ' + r.reconciliacionId, montoOriginal: Number(r.monto), monedaOriginal: r.moneda || 'CUP', tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null, montoConvertido: toNullableNumber(r.montoConvertido), observaciones: r.observaciones ?? undefined })),
      rG.map((r): HistorialTransaccion => ({ transaccionId: r.reconciliacionId, fecha: r.fechaReconciliacion, tipoMovimiento: 'gasto', descripcion: r.descripcion || 'Gasto ' + r.reconciliacionId, montoOriginal: Number(r.monto), monedaOriginal: r.moneda || 'CUP', tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null, montoConvertido: toNullableNumber(r.montoConvertido), observaciones: r.observaciones ?? undefined })),
      aj.map((a): HistorialTransaccion => ({ transaccionId: a.ajusteId, fecha: a.fechaOperacion, tipoMovimiento: a.tipo === 'ingreso' ? 'ajuste_ingreso' : 'ajuste_egreso', descripcion: a.descripcion ?? '', montoOriginal: Number(a.monto), monedaOriginal: a.moneda || 'CUP', tasaCambio: a.tasaCambio ? Number(a.tasaCambio) : null, montoConvertido: toNullableNumber(a.montoConvertido), observaciones: a.motivo ?? undefined })),
      tO.map((t): HistorialTransaccion => ({ transaccionId: t.transferenciaId + '-origen', fecha: t.fechaTransferencia, tipoMovimiento: 'transferencia_salida', descripcion: 'Transferencia a ' + (t.cuentaDestino?.nombreBanco || '') + ' - ' + (t.cuentaDestino?.numeroCuenta || ''), montoOriginal: -Math.abs(Number(t.montoOrigen)), monedaOriginal: t.monedaOrigen || 'CUP', tasaCambio: t.tasaCambio ? Number(t.tasaCambio) : null, montoConvertido: Number(t.montoOrigen), observaciones: t.descripcion ?? undefined })),
      tD.map((t): HistorialTransaccion => ({ transaccionId: t.transferenciaId + '-destino', fecha: t.fechaTransferencia, tipoMovimiento: 'transferencia_entrada', descripcion: 'Transferencia desde ' + (t.cuentaOrigen?.nombreBanco || '') + ' - ' + (t.cuentaOrigen?.numeroCuenta || ''), montoOriginal: Number(t.montoDestino), monedaOriginal: t.monedaDestino || 'CUP', tasaCambio: t.tasaCambio ? Number(t.tasaCambio) : null, montoConvertido: Number(t.montoDestino), observaciones: t.descripcion ?? undefined })),
      iC.map((i): HistorialTransaccion => ({ transaccionId: i.id, fecha: i.createdAt, tipoMovimiento: 'inyeccion_capital', descripcion: i.descripcion || i.tipo, montoOriginal: Number(i.montoRecibido), monedaOriginal: i.moneda || 'CUP', tasaCambio: null, montoConvertido: normalizeCurrency(i.moneda) === normalizeCurrency(cuenta.moneda) ? Number(i.montoRecibido) : null })),
      pD.map((p): HistorialTransaccion => ({ transaccionId: p.id, fecha: p.fechaPago, tipoMovimiento: 'pago_deuda', descripcion: 'Pago de deuda: ' + (p.comprobante || p.id), montoOriginal: -Math.abs(Number(p.montoPagado)), monedaOriginal: cuenta.moneda || 'CUP', tasaCambio: null, montoConvertido: Number(p.montoPagado), observaciones: p.observaciones ?? undefined })),
    );

    transacciones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    if (tipoMovimiento) {
      transacciones = transacciones.filter((transaccion) => transaccion.tipoMovimiento === tipoMovimiento);
    }

    const total = transacciones.length;
    const offset = (page - 1) * limit;
    const paginated = transacciones.slice(offset, offset + limit);
    const accountCurrency = normalizeCurrency(cuenta.moneda);
    const summary = summarizeTransactions(transacciones, accountCurrency);

    return {
      transacciones: paginated,
      resumen: {
        saldoActual: Number(cuenta.saldo),
        ...summary,
        totalMovimientos: transacciones.length,
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
