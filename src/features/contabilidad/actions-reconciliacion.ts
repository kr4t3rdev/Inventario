/**
 * @description Server Actions para Reconciliación.
 */
'use server';

import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getReconciliacionStatsAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const [ventasPendientes, serviciosPendientes, gastosPendientes,
    ventasHoy, serviciosHoy, gastosHoy,
    totalReconciliadoHoy, actividadReciente] = await Promise.all([
    // Pendientes
    prisma.reconciliacionVenta.count({ where: { cuentaId: null, tenantId } }),
    prisma.reconciliacionServicio.count({ where: { cuentaId: null, tenantId } }),
    // Gastos pendientes (no reconciliados con cuenta)
    prisma.reconciliacionGasto.count({ where: { cuentaId: null, tenantId } }),

    // Completados hoy
    prisma.reconciliacionVenta.count({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId } }),
    prisma.reconciliacionServicio.count({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId } }),
    prisma.reconciliacionGasto.count({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId } }),

    // Monto reconciliado hoy
    prisma.reconciliacionVenta.aggregate({ where: { fechaReconciliacion: { gte: hoy, lt: manana }, tenantId }, _sum: { monto: true } }),

    // Actividad reciente (últimas 10)
    prisma.reconciliacionVenta.findMany({
      where: { tenantId },
      orderBy: { fechaReconciliacion: 'desc' },
      take: 10,
      select: { reconciliacionId: true, monto: true, moneda: true, fechaReconciliacion: true, observaciones: true, cuentaBancaria: { select: { nombreBanco: true } } },
    }),
  ]);

  const totalPending = ventasPendientes + serviciosPendientes + gastosPendientes;
  const completedToday = ventasHoy + serviciosHoy + gastosHoy;
  const totalToday = Math.max(ventasHoy + ventasPendientes, serviciosHoy + serviciosPendientes, gastosHoy + gastosPendientes, 1);

  return {
    modules: {
      ventas: { pending: ventasPendientes, completedToday: ventasHoy, totalToday: ventasHoy + ventasPendientes },
      servicios: { pending: serviciosPendientes, completedToday: serviciosHoy, totalToday: serviciosHoy + serviciosPendientes },
      gastos: { pending: gastosPendientes, completedToday: gastosHoy, totalToday: gastosHoy + gastosPendientes },
    },
    stats: {
      totalPending,
      completedToday,
      reconciledAmount: Number(totalReconciliadoHoy._sum.monto ?? 0),
      efficiency: totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0,
    },
    recentActivity: actividadReciente.map((a: any) => ({
      id: a.reconciliacionId,
      type: 'venta',
      reference: a.reconciliacionId.slice(0, 8),
      description: a.observaciones || 'Venta reconciliada',
      accountName: a.cuentaBancaria?.nombreBanco || 'Sin cuenta',
      amount: Number(a.monto),
      date: a.fechaReconciliacion.toISOString(),
    })),
  };
});
