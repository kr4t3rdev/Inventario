/**
 * @description Server Actions para Reconciliación (ventas, servicios, gastos).
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Stats Hub ────────────────────────────────────────────

export const getReconciliacionStatsAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);

  const [vp, sp, gp, vh, sh, gh, montoHoy, act] = await Promise.all([
    // Pendientes: registros fuente sin reconciliación asignada
    prisma.venta.count({ where: { tenantId, reconciliaciones: { none: {} } } }),
    prisma.ventaServicios.count({ where: { tenantId, NOT: { reconciliado: true } } }),
    prisma.gastosDE.count({ where: { tenantId, reconciliaciones: { none: {} } } }),
    prisma.reconciliacionVenta.count({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId } }),
    prisma.reconciliacionServicio.count({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId } }),
    prisma.reconciliacionGasto.count({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId } }),
    prisma.reconciliacionVenta.aggregate({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId }, _sum: { monto: true } }),
    prisma.reconciliacionVenta.findMany({ where: { tenantId }, orderBy: { fechaReconciliacion: 'desc' }, take: 10, select: { reconciliacionId: true, monto: true, moneda: true, fechaReconciliacion: true, observaciones: true, cuentaBancaria: { select: { nombreBanco: true } } } }),
  ]);

  const totalHoy = Math.max(vh+vp, sh+sp, gh+gp, 1);
  return {
    modules: {
      ventas: { pending: vp, completedToday: vh, totalToday: vh+vp },
      servicios: { pending: sp, completedToday: sh, totalToday: sh+sp },
      gastos: { pending: gp, completedToday: gh, totalToday: gh+gp },
    },
    stats: { totalPending: vp+sp+gp, completedToday: vh+sh+gh, reconciledAmount: Number(montoHoy._sum.monto??0), efficiency: Math.round(((vh+sh+gh)/totalHoy)*100) },
    recentActivity: act.map((a:any) => ({ id: a.reconciliacionId, type: 'venta', reference: a.reconciliacionId.slice(0,8), description: a.observaciones||'Venta reconciliada', accountName: a.cuentaBancaria?.nombreBanco||'Sin cuenta', amount: Number(a.monto), date: a.fechaReconciliacion.toISOString() })),
  };
});

// ─── Ventas ────────────────────────────────────────────────

export const getVentasPendientesAction = withAction(async (params: {
  fechaInicio?: string; fechaFin?: string; page?: number; limit?: number;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (params.fechaInicio || params.fechaFin) {
    where.fechaVenta = {};
    if (params.fechaInicio) where.fechaVenta.gte = new Date(params.fechaInicio);
    if (params.fechaFin) where.fechaVenta.lte = new Date(params.fechaFin);
  }
  const page = params.page || 1;
  const limit = params.limit || 50;
  const [ventas, total] = await Promise.all([
    prisma.venta.findMany({
      where, orderBy: {
  // @ts-expect-error
      fechaVenta: 'desc'
      },
      skip: (page-1)*limit, take: limit,
      include: {
  // @ts-expect-error
      cliente: { select: { nombre: true } }, puntoDeVenta: { select: { nombre: true } }, moneda: true
      },
    }),
    prisma.venta.count({ where }),
  ]);
  return { ventas, pagination: { page, limit, total, totalPages: Math.ceil(total/limit) } };
});

export const getHistorialReconciliacionVentasAction = withAction(async (params: {
  fechaInicio?: string; fechaFin?: string; cuentaId?: string;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (params.cuentaId) where.cuentaId = params.cuentaId;
  if (params.fechaInicio || params.fechaFin) {
    where.fechaReconciliacion = {};
    if (params.fechaInicio) where.fechaReconciliacion.gte = new Date(params.fechaInicio);
    if (params.fechaFin) where.fechaReconciliacion.lte = new Date(params.fechaFin);
  }
  const reconciliaciones = await prisma.reconciliacionVenta.findMany({
    where, orderBy: { fechaReconciliacion: 'desc' }, take: 100,
    include: { venta: { select: { ventaId: true, total: true } }, cuentaBancaria: { select: { nombreBanco: true } }, tipoPago: { select: { nombre: true } } },
  });
  const porMoneda = await prisma.reconciliacionVenta.groupBy({ by: ['moneda'], where, _sum: { monto: true } });
  const porTipoDePago = await prisma.reconciliacionVenta.groupBy({ by: ['tipoPagoId'], where, _sum: { monto: true } });
  return {
    reconciliaciones,
    estadisticas: {
      montoTotal: reconciliaciones.reduce((s:number, r:any) => s+Number(r.monto), 0),
      montoConvertidoTotal: reconciliaciones.reduce((s:number, r:any) => s+Number(r.montoConvertido??0), 0),
      porMoneda, porTipoDePago,
    },
    pagination: {},
  };
});

export const reconciliarVentaAction = withAction(async (input: {
  ventaId: string; cuentaId: string; tipoPagoId: string; monto: number; moneda?: string;
  fechaReconciliacion?: string; observaciones?: string;
}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const reconciliacion = await prisma.reconciliacionVenta.create({
  // @ts-expect-error
    data: {
      ventaId: input.ventaId, cuentaId: input.cuentaId, tipoPagoId: input.tipoPagoId,
      monto: input.monto, moneda: input.moneda||'CUP',
      fechaReconciliacion: input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date(),
      observaciones: input.observaciones, tenantId,
    },
  });
  revalidatePath('/busy/contabilidad/reconciliacion');
  return reconciliacion;
});

// ─── Servicios ─────────────────────────────────────────────

export const getServiciosPendientesAction = withAction(async (params: {
  fechaDesde?: string; fechaHasta?: string; page?: number; limit?: number;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (params.fechaDesde || params.fechaHasta) {
    where.fechaServicio = {};
    if (params.fechaDesde) where.fechaServicio.gte = new Date(params.fechaDesde);
    if (params.fechaHasta) where.fechaServicio.lte = new Date(params.fechaHasta);
  }
  const page = params.page || 1; const limit = params.limit || 50;
  const [ventaServicios, total] = await Promise.all([
  // @ts-expect-error
    prisma.ventaServicio.findMany({
      where, orderBy: { fechaServicio: 'desc' },
      skip: (page-1)*limit, take: limit,
      include: { cliente: { select: { nombre: true } }, servicio: { select: { nombre: true } } },
    }),
  // @ts-expect-error
    prisma.ventaServicio.count({
    where
    }),
  ]);
  return { ventaServicios, pagination: { page, limit, total, totalPages: Math.ceil(total/limit) } };
});

export const getHistorialReconciliacionServiciosAction = withAction(async (params: {
  fechaDesde?: string; fechaHasta?: string; cuentaId?: string;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (params.cuentaId) where.cuentaId = params.cuentaId;
  if (params.fechaDesde || params.fechaHasta) {
    where.fechaReconciliacion = {};
    if (params.fechaDesde) where.fechaReconciliacion.gte = new Date(params.fechaDesde);
    if (params.fechaHasta) where.fechaReconciliacion.lte = new Date(params.fechaHasta);
  }
  const reconciliaciones = await prisma.reconciliacionServicio.findMany({
    where, orderBy: { fechaReconciliacion: 'desc' }, take: 100,
    include: {
  // @ts-expect-error
    ventaServicio: { select: { ventaServicioId: true } }, cuentaBancaria: { select: { nombreBanco: true } }, tipoPago: { select: { nombre: true } }
    },
  });
  return { reconciliaciones, estadisticas: {}, pagination: {} };
});

export const reconciliarServicioAction = withAction(async (input: {
  ventaServicioId: string; cuentaId: string; tipoPagoId: string; monto: number; moneda?: string;
  fechaReconciliacion?: string; observaciones?: string;
}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const reconciliacion = await prisma.reconciliacionServicio.create({
  // @ts-expect-error
    data: {
      ventaServicioId: input.ventaServicioId, cuentaId: input.cuentaId, tipoPagoId: input.tipoPagoId,
      monto: input.monto, moneda: input.moneda||'CUP',
      fechaReconciliacion: input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date(),
      observaciones: input.observaciones, tenantId,
    },
  });
  revalidatePath('/busy/contabilidad/reconciliacion');
  return reconciliacion;
});

// ─── Gastos ────────────────────────────────────────────────

export const getGastosPendientesAction = withAction(async (params: {
  fechaDesde?: string; fechaHasta?: string; tipoGasto?: string; soloNoReconciliados?: boolean;
  page?: number; limit?: number;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (params.fechaDesde || params.fechaHasta) {
    where.createdAt = {};
    if (params.fechaDesde) where.createdAt.gte = new Date(params.fechaDesde);
    if (params.fechaHasta) where.createdAt.lte = new Date(params.fechaHasta);
  }
  if (params.tipoGasto) where.tipo = params.tipoGasto;
  const page = params.page || 1; const limit = params.limit || 50;
  const [gastos, total] = await Promise.all([
    prisma.gastosDE.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page-1)*limit, take: limit,
      include: { reconciliaciones: { select: { reconciliacionId: true } } },
    }),
    prisma.gastosDE.count({ where }),
  ]);
  return { gastos, pagination: { page, limit, total, totalPages: Math.ceil(total/limit) } };
});

export const getHistorialReconciliacionGastosAction = withAction(async (params: {
  fechaInicio?: string; fechaFin?: string; cuentaId?: string; tipoGasto?: string;
} = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (params.cuentaId) where.cuentaId = params.cuentaId;
  if (params.tipoGasto) where.tipoGasto = params.tipoGasto;
  if (params.fechaInicio || params.fechaFin) {
    where.fechaReconciliacion = {};
    if (params.fechaInicio) where.fechaReconciliacion.gte = new Date(params.fechaInicio);
    if (params.fechaFin) where.fechaReconciliacion.lte = new Date(params.fechaFin);
  }
  const reconciliaciones = await prisma.reconciliacionGasto.findMany({
    where, orderBy: { fechaReconciliacion: 'desc' }, take: 100,
    include: { cuentaBancaria: { select: { nombreBanco: true } }, tipoPago: { select: { nombre: true } } },
  });
  return { reconciliaciones, estadisticas: {}, pagination: {} };
});

export const reconciliarGastoAction = withAction(async (input: {
  gastoId: string; cuentaId: string; tipoPagoId: string; monto: number; moneda?: string;
  fechaReconciliacion?: string; descripcion?: string;
}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const reconciliacion = await prisma.reconciliacionGasto.create({
    data: {
      gastoId: input.gastoId, cuentaId: input.cuentaId, tipoPagoId: input.tipoPagoId,
      monto: input.monto, moneda: input.moneda||'CUP',
      fechaReconciliacion: input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date(),
  // @ts-expect-error
      descripcion: input.descripcion, tenantId,
    },
  });
  revalidatePath('/busy/contabilidad/reconciliacion');
  return reconciliacion;
});
