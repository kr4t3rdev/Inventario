import { type NextRequest, NextResponse } from 'next/server';

import { authenticateUser, type AuthenticatedUser } from '@/lib/auth-middleware';
import { unlockUserBodySchema } from '@/lib/admin/schemas';
import { isTenantAdminRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const authResultAuthUser1 = await authenticateUser(request);
    if ('status' in authResultAuthUser1) return authResultAuthUser1 as Response;
    const authUser = authResultAuthUser1.user as AuthenticatedUser;
    const tenantId = authUser.tenantId;
    if (!tenantId || !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = unlockUserBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { userId } = parsed.data;

    const membership = await prisma.tenantMembership.findFirst({
      where: { tenantId, userId, isActive: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Usuario no encontrado en esta empresa' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { userId },
      select: { userId: true, name: true, email: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { userId },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastFailedLogin: null,
      },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        loginAttempts: true,
        lockedUntil: true,
      },
    });

    await prisma.userActivityLog.create({
      data: {
        userId,
        action: 'unlock_user',
        details: JSON.stringify({ unlockedBy: authUser.userId }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
        performedBy: authUser.userId,
      },
    });

    return NextResponse.json({ user: updatedUser, message: 'Usuario desbloqueado correctamente' });
  } catch (error) {
    console.error('Error desbloqueando usuario:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
