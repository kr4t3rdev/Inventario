import { type NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import { activityLogBodySchema, activityLogQuerySchema } from '@/lib/admin/schemas';
import { isAdminRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const authResultAuthUser1 = await authenticateUser(request);
    if ('status' in authResultAuthUser1) return authResultAuthUser1 as Response;
    const authUser = authResultAuthUser1.user;
    if (!isAdminRole(authUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = activityLogBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const activityLog = await prisma.userActivityLog.create({
      data: {
        userId: parsed.data.userId,
        action: parsed.data.action,
        details: parsed.data.details || null,
        ipAddress: parsed.data.ipAddress || request.headers.get('x-forwarded-for') || null,
        userAgent: parsed.data.userAgent || request.headers.get('user-agent') || null,
        performedBy: authUser.userId,
      },
    });

    return NextResponse.json(activityLog, { status: 201 });
  } catch (error) {
    console.error('Error creando registro de actividad:', error);
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
    const parsed = activityLogQuerySchema.safeParse({
      userId: searchParams.get('userId') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const where = parsed.data.userId ? { userId: parsed.data.userId } : {};

    const logs = await prisma.userActivityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parsed.data.limit,
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error obteniendo registros de actividad:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
