import { type NextRequest, NextResponse } from 'next/server';

import { verify_token } from '@/lib/auth-utils';
import { buildCsv } from '@/lib/admin/csv';
import { isAdminRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authUser = await verify_token(request);
    if (!authUser || !isAdminRole(authUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
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
    });

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
