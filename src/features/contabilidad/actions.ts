'use server';
import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getTransferenciasBancariasAction = withAction(async (
  params: { fechaInicio?: string; fechaFin?: string; cuentaId?: string } = {},
  user: AuthenticatedUser
) => {
  const where: Record<string, any> = {};
  if (params.fechaInicio || params.fechaFin) {
    where.createdAt = {};
    if (params.fechaInicio) where.createdAt.gte = new Date(params.fechaInicio);
    if (params.fechaFin) where.createdAt.lte = new Date(params.fechaFin);
  }
  if (params.cuentaId) where.cuentaId = params.cuentaId;
  const [transferencias, total] = await Promise.all([
    prisma.transferenciaBancaria.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.transferenciaBancaria.count({ where }),
  ]);
  return { transferencias, pagination: { page: 1, limit: 50, total, totalPages: Math.ceil(total / 50) } };
});

function bdf(fi: string | null, ff: string | null): Record<string, Date> { const r: Record<string, Date> = {}; if (fi) r.gte = new Date(fi); if (ff) r.lte = new Date(ff); return r; }

export const getMovimientosReportAction = withAction(async (f: { busqueda?: string; fechaInicio?: string; fechaFin?: string; cuentaId?: string; tipoMovimiento?: string; moneda?: string; page?: number; limit?: number }, _user: AuthenticatedUser) => {
  const { busqueda: bq, fechaInicio: fi, fechaFin: ff, cuentaId: cid, tipoMovimiento: tm, moneda: mo, page: pg = 1, limit: lm = 10 } = f;
  const df = bdf(fi || null, ff || null), af = cid ? { cuentaId: cid } : {};
  const [v, s, g] = await Promise.all([
    prisma.reconciliacionVenta.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}), ...(mo ? { moneda: mo } : {}) }, select: { reconciliacionId: true, monto: true, moneda: true, fechaReconciliacion: true, observaciones: true, tipoReconciliacion: true, venta: { select: { ventaId: true, total: true } }, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } }, tipoPago: { select: { nombre: true } } } }),
    prisma.reconciliacionServicio.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}), ...(mo ? { moneda: mo } : {}) }, select: { reconciliacionId: true, monto: true, moneda: true, fechaReconciliacion: true, ventasServicio: { select: { ventaServicioId: true } }, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } }, tipoPago: { select: { nombre: true } } } }),
    prisma.reconciliacionGasto.findMany({ where: { ...af, ...(Object.keys(df).length ? { fechaReconciliacion: df } : {}), ...(mo ? { moneda: mo } : {}) }, select: { reconciliacionId: true, monto: true, moneda: true, tipoGasto: true, descripcion: true, fechaReconciliacion: true, cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } }, tipoPago: { select: { nombre: true } } } }),
  ]);
  const mvs = [].concat(
    v.map((m: any) => ({ id: m.reconciliacionId, tipo: m.tipoReconciliacion === 'PRESTAMO_CASH' ? 'prestamo_cash_pago' : 'venta', fecha: m.fechaReconciliacion, monto: Number(m.monto), moneda: m.moneda||'CUP', descripcion: m.venta ? 'Venta '+m.venta.ventaId : 'Cobro', cuenta: m.cuentaBancaria.nombreBanco, observaciones: m.observaciones })),
    s.map((m: any) => ({ id: m.reconciliacionId, tipo: 'servicio', fecha: m.fechaReconciliacion, monto: Number(m.monto), moneda: m.moneda||'CUP', descripcion: 'Servicio '+m.ventasServicio.ventaServicioId, cuenta: m.cuentaBancaria.nombreBanco })),
    g.map((m: any) => ({ id: m.reconciliacionId, tipo: m.tipoGasto||'gasto', fecha: m.fechaReconciliacion, monto: -Number(m.monto), moneda: m.moneda||'CUP', descripcion: m.descripcion, cuenta: m.cuentaBancaria.nombreBanco }))
  );
  let mf = tm && tm !== 'all' ? mvs.filter((x: any) => x.tipo === tm) : mvs;
  if (bq) mf = mf.filter((x: any) => (x.descripcion||'').toLowerCase().includes(bq.toLowerCase()));
  mf.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  const off = (pg-1)*lm, mp = mf.slice(off, off+lm);
  return { data: mp, pagination: { page: pg, limit: lm, total: mf.length, totalPages: Math.ceil(mf.length/lm) } };
});
