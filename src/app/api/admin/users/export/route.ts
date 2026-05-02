import { type NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import { buildCsv } from '@/lib/admin/csv';
import { isTenantAdminRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authResultAuthUser1 = await authenticateUser(request);
    if ('status' in authResultAuthUser1) return authResultAuthUser1 as Response;
    const authUser = authResultAuthUser1.user;
    const tenantId = authUser.tenantId;
    if (!tenantId || !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId, isActive: true },
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            activatedAt: true,
            expiresAt: true,
            createdAt: true,
            updatedAt: true,
            lastModifiedBy: true,
            loginAttempts: true,
            lockedUntil: true,
            lastFailedLogin: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const users = memberships.map((membership) => membership.user);

    if (format === 'csv') {
      const headers = [
        'User ID',
        'Nombre',
        'Email',
        'Rol',
        'Activo',
        'Fecha Activación',
        'Fecha Expiración',
        'Fecha Creación',
        'Última Modificación',
        'Intentos Login',
        'Bloqueado Hasta',
        'Último Fallido',
      ];

      const rows = users.map((user) => [
        user.userId,
        user.name,
        user.email,
        user.role,
        user.isActive ? 'Sí' : 'No',
        user.activatedAt ? new Date(user.activatedAt).toISOString() : '',
        user.expiresAt ? new Date(user.expiresAt).toISOString() : '',
        new Date(user.createdAt).toISOString(),
        user.lastModifiedBy || '',
        user.loginAttempts.toString(),
        user.lockedUntil ? new Date(user.lockedUntil).toISOString() : '',
        user.lastFailedLogin ? new Date(user.lastFailedLogin).toISOString() : '',
      ]);

      const csvRows = buildCsv(headers, rows);

      return new NextResponse(csvRows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="usuarios_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error exportando usuarios:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
