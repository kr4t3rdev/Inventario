import { type NextRequest, NextResponse } from 'next/server';

import { withAuthGet, type AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

/**
 * @description GET /api/admin/system - Métricas de salud del sistema.
 * Solo accesible para admin global (role === 'admin').
 */
export const GET = withAuthGet(async (_request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores globales' }, { status: 403 });
    }

    const [
      totalUsers,
      totalTenants,
      activeSessions,
      usersByRole,
      expiringLicenses,
      activeLicenses,
      totalLicenses,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.tenant.count(),
      prisma.userSession.count({ where: { isActive: true, expiresAt: { gt: new Date() } } }),
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
      prisma.tenantLicense.count({
        where: {
          activa: true,
          expiracion: { gt: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.tenantLicense.count({
        where: { activa: true, expiracion: { gt: new Date() } },
      }),
      prisma.tenantLicense.count(),
    ]);

    return NextResponse.json({
      users: {
        total: totalUsers,
        byRole: usersByRole.map((r) => ({ role: r.role, count: r._count })),
      },
      tenants: {
        total: totalTenants,
      },
      sessions: {
        active: activeSessions,
      },
      licenses: {
        total: totalLicenses,
        active: activeLicenses,
        expiringSoon: expiringLicenses,
      },
    });
  } catch (error) {
    console.error('[Admin/System] Error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
