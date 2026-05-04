import { type NextRequest, NextResponse } from 'next/server';

import { withAuthGet, type AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

/**
 * @description GET /api/admin/finance - Consolidación financiera de todos los tenants.
 * Solo accesible para admin global (role === 'admin').
 */
export const GET = withAuthGet(async (_request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores globales' }, { status: 403 });
    }

    const [ventas, ventasServicios, gastos, cuentasPorCobrar, cuentasPorPagar, tenantCount] = await Promise.all([
      prisma.venta.aggregate({
        _sum: { total: true },
        _count: true,
      }),
      prisma.ventaServicios.aggregate({
        _sum: { total: true },
        _count: true,
      }),
      prisma.gastosDE.aggregate({
        _sum: { monto: true },
        _count: true,
      }),
      prisma.cuentaPorCobrar.aggregate({
        _sum: { montoDeuda: true, montoPagado: true },
        _count: true,
      }),
      prisma.cuentaPorPagar.aggregate({
        _sum: { saldoPendiente: true },
        _count: true,
      }),
      prisma.tenant.count(),
    ]);

    return NextResponse.json({
      tenantCount,
      revenue: {
        totalVentas: ventas._count,
        totalVentasMonto: ventas._sum.total ?? 0,
        totalVentasServicios: ventasServicios._count,
        totalServiciosMonto: ventasServicios._sum.total ?? 0,
        totalIngresos: (ventas._sum.total ?? 0) + (ventasServicios._sum.total ?? 0),
      },
      gastos: {
        totalGastos: gastos._count,
        totalMonto: gastos._sum.monto ?? 0,
      },
      cuentasPorCobrar: {
        total: cuentasPorCobrar._count,
        saldoPendiente: (cuentasPorCobrar._sum.montoDeuda ?? 0) - (cuentasPorCobrar._sum.montoPagado ?? 0),
      },
      cuentasPorPagar: {
        total: cuentasPorPagar._count,
        saldoPendiente: cuentasPorPagar._sum.saldoPendiente ?? 0,
      },
    });
  } catch (error) {
    console.error('[Admin/Finance] Error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
