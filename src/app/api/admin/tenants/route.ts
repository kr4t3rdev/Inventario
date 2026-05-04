import { type NextRequest, NextResponse } from 'next/server';

import { withAuthGet, type AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

/**
 * @description GET /api/admin/tenants - Lista todos los tenants del sistema con métricas.
 * Solo accesible para admin global (role === 'admin').
 */
export const GET = withAuthGet(async (_request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores globales' }, { status: 403 });
    }

    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            memberships: true,
            productos: true,
            almacenes: true,
            ventas: true,
          },
        },
        licencias: {
          where: { activa: true, expiracion: { gt: new Date() } },
          orderBy: { inicio: 'desc' },
          take: 1,
          include: { plan: { select: { nombre: true } } },
        },
        memberships: {
          where: { isActive: true },
          select: { membershipId: true },
        },
      },
    });

    const result = tenants.map((tenant) => {
      const activeLicense = tenant.licencias[0] ?? null;
      return {
        tenantId: tenant.tenantId,
        nombre: tenant.nombre,
        slug: tenant.slug,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        totalUsers: tenant._count.memberships,
        activeUsers: tenant.memberships.length,
        totalProductos: tenant._count.productos,
        totalAlmacenes: tenant._count.almacenes,
        totalVentas: tenant._count.ventas,
        plan: activeLicense?.plan?.nombre ?? 'Sin plan',
        planId: activeLicense?.planId ?? null,
        licenseActive: activeLicense !== null,
        licenseExpiresAt: activeLicense?.expiracion ?? null,
        consumption: {
          usuarios: tenant.memberships.length,
          almacenes: tenant._count.almacenes,
          productos: tenant._count.productos,
        },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Admin/Tenants] Error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
