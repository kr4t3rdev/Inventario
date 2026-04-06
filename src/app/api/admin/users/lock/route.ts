import { type NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import { lockUserBodySchema } from '@/lib/admin/schemas';
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
    const parsed = lockUserBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { userId, reason } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { userId },
      select: { userId: true, name: true, email: true, role: true, lockedUntil: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);

    const updatedUser = await prisma.user.update({
      where: { userId },
      data: {
        lockedUntil,
        isActive: false,
      },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lockedUntil: true,
      },
    });

    await prisma.userActivityLog.create({
      data: {
        userId,
        action: 'manual_lock',
        details: JSON.stringify({
          lockedBy: authUser.userId,
          reason: reason || 'Bloqueo manual por administrador',
          lockedUntil: lockedUntil.toISOString(),
        }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
        performedBy: authUser.userId,
      },
    });

    await prisma.userSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    return NextResponse.json({ user: updatedUser, message: 'Usuario bloqueado correctamente' });
  } catch (error) {
    console.error('Error bloqueando usuario:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
