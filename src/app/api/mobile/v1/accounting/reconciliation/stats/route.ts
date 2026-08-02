import { endOfDay, startOfDay } from 'date-fns';

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireTenant } from '@/lib/services/tenant-scope';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const tenantId = requireTenant(authResult.user);
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const ventasPendientesCount = await prisma.venta.count({
      where: { tenantId, deletedAt: null, reconciliaciones: { none: {} } },
    });

    const ventasCompletadasHoyCount = await prisma.reconciliacionVenta.count({
      where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } },
    });

    const serviciosPendientesCount = await prisma.reconciliacionServicio.count({
      where: { tenantId, ventasServicio: { tenantId, reconciliaciones: { none: {} } } },
    });

    const serviciosCompletadosHoyCount = await prisma.reconciliacionServicio.count({
      where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } },
    });

    const [salariosPendientes, gastosDEPendientes, comprasPendientes] = await Promise.all([
      prisma.pagosalario.count({
        where: { tenantId, ReconciliacionGasto: { none: {} } },
      }),
      prisma.gastosDE.count({
        where: { tenantId, reconciliaciones: { none: {} } },
      }),
      prisma.gastoCompra.count({
        where: { tenantId, reconciliaciones: { none: {} } },
      }),
    ]);

    const gastosPendientesCount = salariosPendientes + gastosDEPendientes + comprasPendientes;

    const gastosCompletadosHoyCount = await prisma.reconciliacionGasto.count({
      where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } },
    });

    const [lastVentas, lastServicios, lastGastos] = await Promise.all([
      prisma.reconciliacionVenta.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          venta: { select: { ventaId: true } },
          cuentaBancaria: { select: { nombreBanco: true } },
        },
      }),
      prisma.reconciliacionServicio.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          ventasServicio: { select: { ventaServicioId: true } },
          cuentaBancaria: { select: { nombreBanco: true } },
        },
      }),
      prisma.reconciliacionGasto.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          cuentaBancaria: { select: { nombreBanco: true } },
        },
      }),
    ]);

    const activity = [
      ...lastVentas.map((item) => ({
        id: item.reconciliacionId,
        type: 'venta' as const,
        description: 'Venta reconciliada',
        accountName: item.cuentaBancaria.nombreBanco,
        amount: Number(item.monto),
        date: item.createdAt,
        reference: `Venta #${item.venta?.ventaId?.slice(0, 8)}...`,
      })),
      ...lastServicios.map((item) => ({
        id: item.reconciliacionId,
        type: 'servicio' as const,
        description: 'Servicio reconciliado',
        accountName: item.cuentaBancaria.nombreBanco,
        amount: Number(item.monto),
        date: item.createdAt,
        reference: `Servicio #${item.ventasServicio?.ventaServicioId?.slice(0, 8)}...`,
      })),
      ...lastGastos.map((item) => ({
        id: item.reconciliacionId,
        type: 'gasto' as const,
        description: 'Gasto reconciliado',
        accountName: item.cuentaBancaria?.nombreBanco || 'Multi-cuenta',
        amount: Number(item.monto),
        date: item.createdAt,
        reference: 'Gasto',
      })),
    ];

    activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recentActivity = activity.slice(0, 5);

    const [sumVentas, sumServicios, sumGastos] = await Promise.all([
      prisma.reconciliacionVenta.aggregate({
        _sum: { montoConvertido: true },
        where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.reconciliacionServicio.aggregate({
        _sum: { montoConvertido: true },
        where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.reconciliacionGasto.aggregate({
        _sum: { montoConvertido: true },
        where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } },
      }),
    ]);

    const totalReconciledAmount =
      (Number(sumVentas._sum.montoConvertido) || 0) +
      (Number(sumServicios._sum.montoConvertido) || 0) +
      (Number(sumGastos._sum.montoConvertido) || 0);

    const totalCompletedToday =
      ventasCompletadasHoyCount + serviciosCompletadosHoyCount + gastosCompletadosHoyCount;
    const totalPending = ventasPendientesCount + serviciosPendientesCount + gastosPendientesCount;

    return successResponse({
      modules: {
        ventas: {
          pending: ventasPendientesCount,
          completedToday: ventasCompletadasHoyCount,
          totalToday: ventasPendientesCount + ventasCompletadasHoyCount,
        },
        servicios: {
          pending: serviciosPendientesCount,
          completedToday: serviciosCompletadosHoyCount,
          totalToday: serviciosPendientesCount + serviciosCompletadosHoyCount,
        },
        gastos: {
          pending: gastosPendientesCount,
          completedToday: gastosCompletadosHoyCount,
          totalToday: gastosPendientesCount + gastosCompletadosHoyCount,
        },
      },
      stats: {
        totalPending,
        completedToday: totalCompletedToday,
        reconciledAmount: totalReconciledAmount,
        efficiency:
          totalCompletedToday + totalPending > 0
            ? Math.round((totalCompletedToday / (totalCompletedToday + totalPending)) * 100)
            : 0,
      },
      recentActivity,
    });
  } catch (error) {
    console.error('Error en mobile accounting reconciliation stats route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
