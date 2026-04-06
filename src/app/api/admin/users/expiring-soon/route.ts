import { type NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import {
  expiringUsersBodySchema,
  expiringUsersQuerySchema,
} from '@/lib/admin/schemas';
import { isAdminRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

interface ExpiringUser {
  userId: string;
  name: string | null;
  email: string | null;
  expiresAt: Date | null;
  role: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResultAuthUser1 = await authenticateUser(request);
    if ('status' in authResultAuthUser1) return authResultAuthUser1 as Response;
    const authUser = authResultAuthUser1.user;
    if (!isAdminRole(authUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const parsedBody = expiringUsersBodySchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsedBody.error.flatten() },
        { status: 400 },
      );
    }

    const { days } = parsedBody.data;
    const now = new Date();

    const expiringSoon = await prisma.user.findMany({
      where: {
        expiresAt: {
          not: null,
        },
        isActive: true,
      },
      select: {
        userId: true,
        name: true,
        email: true,
        expiresAt: true,
        role: true,
      },
    });

    const usersExpiringSoon = expiringSoon.filter((user) => {
      if (!user.expiresAt) {
        return false;
      }
      const daysUntilExpiry = Math.ceil(
        (new Date(user.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return daysUntilExpiry > 0 && daysUntilExpiry <= days;
    });

    const admins = await prisma.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { userId: true, name: true },
    });

    const notificationsCreated = [];

    for (const user of usersExpiringSoon) {
      if (!user.expiresAt) {
        continue;
      }

      const daysUntilExpiry = Math.ceil(
        (new Date(user.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      for (const admin of admins) {
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: admin.userId,
            title: {
              contains: user.name ?? '',
            },
            message: {
              contains: 'expirará pronto',
            },
            createdAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            },
          },
        });

        if (!existingNotification) {
          const notification = await prisma.notification.create({
            data: {
              userId: admin.userId,
              title: 'Usuario expirará pronto',
              message: `El usuario ${user.name} (${user.email}) expirará en ${daysUntilExpiry} días (${new Date(user.expiresAt).toLocaleDateString('es-ES')}).`,
              type: 'warning',
              prioridad: 'media',
            },
          });
          notificationsCreated.push(notification);
        }
      }
    }

    return NextResponse.json({
      message: 'Notificaciones creadas exitosamente',
      usersExpiringSoon: usersExpiringSoon.length,
      notificationsCreated: notificationsCreated.length,
      users: usersExpiringSoon.map((user) => ({
        userId: user.userId,
        name: user.name,
        email: user.email,
        expiresAt: user.expiresAt,
        daysUntilExpiry: user.expiresAt
          ? Math.ceil((new Date(user.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      })),
    });
  } catch (error) {
    console.error('Error creando notificaciones de expiración:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResultAuthUser2 = await authenticateUser(request);
    if ('status' in authResultAuthUser2) return authResultAuthUser2 as Response;
    const authUser = authResultAuthUser2.user;
    if (!isAdminRole(authUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = expiringUsersQuerySchema.safeParse({
      days: searchParams.get('days') ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsedQuery.error.flatten() },
        { status: 400 },
      );
    }

    const { days } = parsedQuery.data;
    const now = new Date();
    const expiryThreshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const expiringSoon = await prisma.user.findMany({
      where: {
        expiresAt: {
          not: null,
          lte: expiryThreshold,
        },
        isActive: true,
      },
      select: {
        userId: true,
        name: true,
        email: true,
        expiresAt: true,
        role: true,
        createdAt: true,
      },
      orderBy: { expiresAt: 'asc' },
    });

    const usersWithDaysUntilExpiry = (expiringSoon as ExpiringUser[])
      .map((user) => ({
        ...user,
        daysUntilExpiry: user.expiresAt
          ? Math.ceil((new Date(user.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      }))
      .filter((user) => user.daysUntilExpiry > 0);

    return NextResponse.json({
      users: usersWithDaysUntilExpiry,
      total: usersWithDaysUntilExpiry.length,
    });
  } catch (error) {
    console.error('Error obteniendo usuarios que expiran pronto:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
