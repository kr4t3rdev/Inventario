/**
 * @description Server Actions para Cuentas Bancarias.
 * Reemplazan el uso de contabilidadApi (RTK Query) para operaciones CRUD.
 *
 * @module features/contabilidad/actions-cuentas-bancarias
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Types ─────────────────────────────────────────────────

interface HistorialTransaccion {
  transaccionId: string
  fecha: Date
  tipoMovimiento: string
  descripcion: string
  montoOriginal: number
  monedaOriginal: string
  tasaCambio: number | null
  montoConvertido: number
  observaciones?: string
}

interface HistorialResumen {
  saldoActual: number
  totalIngresos: number
  totalEgresos: number
  totalMovimientos: number
}

interface HistorialPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ─── Schemas ───────────────────────────────────────────────

const createSchema = z.object({
  nombreBanco: z.string().min(1, 'El nombre del banco es requerido'),
  numeroCuenta: z.string().min(1, 'El número de cuenta es requerido'),
  tipoCuenta: z.string().min(1, 'El tipo de cuenta es requerido'),
  saldo: z.coerce.number().default(0),
  moneda: z.string().min(1, 'La moneda es requerida'),
});

const updateSchema = z.object({
  cuentaId: z.string().min(1),
  nombreBanco: z.string().optional(),
  numeroCuenta: z.string().optional(),
  tipoCuenta: z.string().optional(),
  saldo: z.coerce.number().optional(),
  moneda: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ─── Select ────────────────────────────────────────────────

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

// ─── Server Actions ────────────────────────────────────────

export const getCuentasBancariasAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const cuentas = await prisma.cuentaBancaria.findMany({
    where: { tenantId },
    select: CUENTA_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  return { cuentas: cuentas.map(c => ({ ...c, saldo: Number(c.saldo) })) };
});

export const getCuentaBancariaByIdAction = withAction(async (cuentaId: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { cuentaId, tenantId },
    select: CUENTA_SELECT,
  });
  if (!cuenta) throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
  return { ...cuenta, saldo: Number(cuenta.saldo) };
});

export const createCuentaBancariaAction = withAction(async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
  const parsed = createSchema.parse(input);
  const tenantId = requireTenant(user);
  const cuenta = await prisma.cuentaBancaria.create({
    data: {
      nombreBanco: parsed.nombreBanco,
      numeroCuenta: parsed.numeroCuenta,
      tipoCuenta: parsed.tipoCuenta,
      saldo: parsed.saldo,
      moneda: parsed.moneda,
      isActive: true,
      tenantId,
    },
    select: CUENTA_SELECT,
  });
  revalidatePath('/busy/contabilidad/cuentas');
  return cuenta;
});

export const updateCuentaBancariaAction = withAction(async (input: z.infer<typeof updateSchema>, user: AuthenticatedUser) => {
  const parsed = updateSchema.parse(input);
  const { cuentaId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.cuentaBancaria.findFirst({
    where: { cuentaId, tenantId },
    select: { cuentaId: true },
  });
  if (!existing) throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');

  const cuenta = await prisma.cuentaBancaria.update({
    where: { cuentaId },
    data: {
      ...(data.nombreBanco !== undefined && { nombreBanco: data.nombreBanco }),
      ...(data.numeroCuenta !== undefined && { numeroCuenta: data.numeroCuenta }),
      ...(data.tipoCuenta !== undefined && { tipoCuenta: data.tipoCuenta }),
      ...(data.saldo !== undefined && { saldo: data.saldo }),
      ...(data.moneda !== undefined && { moneda: data.moneda }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    select: CUENTA_SELECT,
  });
  revalidatePath('/busy/contabilidad/cuentas');
  return cuenta;
});

export const deleteCuentaBancariaAction = withAction(async (cuentaId: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const existing = await prisma.cuentaBancaria.findFirst({
    where: { cuentaId, tenantId },
    select: { cuentaId: true },
  });
  if (!existing) throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');

  await prisma.cuentaBancaria.delete({ where: { cuentaId } });
  revalidatePath('/busy/contabilidad/cuentas');
  return { id: cuentaId, eliminado: true };
});

export const getCuentaHistorialAction = withAction(async (params: { cuentaId: string; fechaInicio?: string; fechaFin?: string; tipoMovimiento?: string; page?: number; limit?: number }, _user: AuthenticatedUser) => {
  const { cuentaId, fechaInicio: fi, fechaFin: ff, tipoMovimiento: tm, page: pg = 1, limit: lm = 50 } = params;
  const cuenta = await prisma.cuentaBancaria.findUnique({ where: { cuentaId } });
  if (!cuenta) throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');

  const dateFilter: Record<string, Date> = {};
  if (fi) dateFilter.gte = new Date(fi);
  if (ff) dateFilter.lte = new Date(ff);
  const sf = Object.keys(dateFilter).length ? { gte: dateFilter.gte!, lte: dateFilter.lte! } : {};
  const wf = Object.keys(sf).length ? { fechaReconciliacion: sf } : {};

  const [rV, rS, rG, aj, tO, tD, iC, pD] = await Promise.all([
    prisma.reconciliacionVenta.findMany({ where: { cuentaId, ...wf }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, fechaReconciliacion: true, observaciones: true, tipoReconciliacion: true } }),
    prisma.reconciliacionServicio.findMany({ where: { cuentaId, ...wf }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, fechaReconciliacion: true, observaciones: true } }),
    prisma.reconciliacionGasto.findMany({ where: { cuentaId, ...wf }, select: { reconciliacionId: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, tipoGasto: true, descripcion: true, fechaReconciliacion: true, observaciones: true } }),
    prisma.ajusteBancario.findMany({ where: { cuentaId, ...(Object.keys(sf).length ? { createdAt: sf } : {}) }, select: { ajusteId: true, tipo: true, monto: true, moneda: true, montoConvertido: true, tasaCambio: true, descripcion: true, motivo: true, createdAt: true } }),
    prisma.transferenciaBancaria.findMany({ where: { cuentaOrigenId: cuentaId, ...(Object.keys(sf).length ? { fechaTransferencia: sf } : {}) }, select: { transferenciaId: true, montoOrigen: true, monedaOrigen: true, montoDestino: true, monedaDestino: true, tasaCambio: true, motivo: true, fechaTransferencia: true, descripcion: true, cuentaDestino: { select: { nombreBanco: true, numeroCuenta: true } } } }),
    prisma.transferenciaBancaria.findMany({ where: { cuentaDestinoId: cuentaId, ...(Object.keys(sf).length ? { fechaTransferencia: sf } : {}) }, select: { transferenciaId: true, montoOrigen: true, monedaOrigen: true, montoDestino: true, monedaDestino: true, tasaCambio: true, motivo: true, fechaTransferencia: true, descripcion: true, cuentaOrigen: { select: { nombreBanco: true, numeroCuenta: true } } } }),
    prisma.inyeccionCapital.findMany({ where: { cuentaId, ...(Object.keys(sf).length ? { createdAt: sf } : {}) }, select: { id: true, tipo: true, montoRecibido: true, moneda: true, descripcion: true, createdAt: true } }),
    prisma.pagoDeuda.findMany({ where: { cuentaId, ...(Object.keys(sf).length ? { fechaPago: sf } : {}) }, select: { id: true, montoPagado: true, fechaPago: true, comprobante: true, observaciones: true } }),
  ]);

  let transacciones: HistorialTransaccion[] = [];
  transacciones = transacciones.concat(
    rV.map((r): HistorialTransaccion => ({ transaccionId: r.reconciliacionId, fecha: r.fechaReconciliacion, tipoMovimiento: ['PRESTAMO_CASH', 'PRESTAMO_CASH_DESEMBOLSO', 'DEUDA_CASH', 'DEUDA_CASH_DESEMBOLSO'].includes(r.tipoReconciliacion ?? '') ? r.tipoReconciliacion!.toLowerCase() : 'venta', descripcion: 'Venta ' + r.reconciliacionId, montoOriginal: Number(r.monto), monedaOriginal: r.moneda || 'CUP', tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null, montoConvertido: Number(r.montoConvertido || r.monto), observaciones: r.observaciones ?? undefined })),
    rS.map((r): HistorialTransaccion => ({ transaccionId: r.reconciliacionId, fecha: r.fechaReconciliacion, tipoMovimiento: 'servicio', descripcion: 'Servicio ' + r.reconciliacionId, montoOriginal: Number(r.monto), monedaOriginal: r.moneda || 'CUP', tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null, montoConvertido: Number(r.montoConvertido || r.monto), observaciones: r.observaciones ?? undefined })),
    rG.map((r): HistorialTransaccion => ({ transaccionId: r.reconciliacionId, fecha: r.fechaReconciliacion, tipoMovimiento: 'gasto', descripcion: r.descripcion || 'Gasto ' + r.reconciliacionId, montoOriginal: Number(r.monto), monedaOriginal: r.moneda || 'CUP', tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null, montoConvertido: Number(r.montoConvertido || r.monto), observaciones: r.observaciones ?? undefined })),
    aj.map((a): HistorialTransaccion => ({ transaccionId: a.ajusteId, fecha: a.createdAt, tipoMovimiento: a.tipo === 'ingreso' ? 'ajuste_ingreso' : 'ajuste_egreso', descripcion: a.descripcion ?? '', montoOriginal: Number(a.monto), monedaOriginal: a.moneda || 'CUP', tasaCambio: a.tasaCambio ? Number(a.tasaCambio) : null, montoConvertido: Number(a.montoConvertido || a.monto), observaciones: a.motivo ?? undefined })),
    tO.map((t): HistorialTransaccion => ({ transaccionId: t.transferenciaId + '-origen', fecha: t.fechaTransferencia, tipoMovimiento: 'transferencia_salida', descripcion: 'Transferencia a ' + (t.cuentaDestino?.nombreBanco || '') + ' - ' + (t.cuentaDestino?.numeroCuenta || ''), montoOriginal: Number(t.montoOrigen), monedaOriginal: t.monedaOrigen || 'CUP', tasaCambio: t.tasaCambio ? Number(t.tasaCambio) : null, montoConvertido: Number(t.montoDestino), observaciones: t.descripcion ?? undefined })),
    tD.map((t): HistorialTransaccion => ({ transaccionId: t.transferenciaId + '-destino', fecha: t.fechaTransferencia, tipoMovimiento: 'transferencia_entrada', descripcion: 'Transferencia desde ' + (t.cuentaOrigen?.nombreBanco || '') + ' - ' + (t.cuentaOrigen?.numeroCuenta || ''), montoOriginal: Number(t.montoDestino), monedaOriginal: t.monedaDestino || 'CUP', tasaCambio: t.tasaCambio ? Number(t.tasaCambio) : null, montoConvertido: Number(t.montoOrigen), observaciones: t.descripcion ?? undefined })),
    iC.map((i): HistorialTransaccion => ({ transaccionId: i.id, fecha: i.createdAt, tipoMovimiento: 'inyeccion_capital', descripcion: i.descripcion || i.tipo, montoOriginal: Number(i.montoRecibido), monedaOriginal: i.moneda || 'CUP', tasaCambio: null, montoConvertido: Number(i.montoRecibido) })),
    pD.map((p): HistorialTransaccion => ({ transaccionId: p.id, fecha: p.fechaPago, tipoMovimiento: 'pago_deuda', descripcion: 'Pago de deuda: ' + (p.comprobante || p.id), montoOriginal: Number(p.montoPagado), monedaOriginal: cuenta.moneda || 'CUP', tasaCambio: null, montoConvertido: Number(p.montoPagado), observaciones: p.observaciones ?? undefined }))
  );

  transacciones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  if (tm) transacciones = transacciones.filter(t => t.tipoMovimiento === tm);
  const total = transacciones.length;
  const offset = (pg - 1) * lm;
  const paginated = transacciones.slice(offset, offset + lm);

  const resumen: HistorialResumen = {
    saldoActual: Number(cuenta.saldo),
    totalIngresos: transacciones.filter(t => t.montoOriginal > 0).reduce((s, t) => s + t.montoOriginal, 0),
    totalEgresos: transacciones.filter(t => t.montoOriginal < 0).reduce((s, t) => s + Math.abs(t.montoOriginal), 0),
    totalMovimientos: total,
  };
  const pagination: HistorialPagination = {
    page: pg, limit: lm, total, totalPages: Math.ceil(total / lm),
  };

  return { transacciones: paginated, resumen, pagination };
});
