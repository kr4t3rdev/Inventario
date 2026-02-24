import bcrypt from 'bcryptjs';
import { type NextRequest, NextResponse } from 'next/server';

import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { createUserBodySchema } from '@/lib/admin/schemas';
import { sendNewUserNotification } from '@/lib/email';
import { isAdminRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

export const GET = withAuthGet(async (_request: NextRequest, _context: unknown, user: unknown) => {
  try {
    const userRole = (user as { role?: string })?.role;
    if (!isAdminRole(userRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error obteniendo users:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
});

export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: unknown) => {
  try {
    const authUser = user as { role?: string; userId?: string; email?: string };
    if (!isAdminRole(authUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const parseResult = createUserBodySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const { name, email, password, role, daysToExpire } = parseResult.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date();
    const expiresAt = daysToExpire
      ? new Date(now.getTime() + daysToExpire * 24 * 60 * 60 * 1000)
      : null;

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        isActive: false,
        activatedAt: now,
        expiresAt,
        lastModifiedBy: authUser.userId,
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
        activatedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        lastModifiedBy: true,
      },
    });

    await prisma.userActivityLog.create({
      data: {
        userId: newUser.userId,
        action: 'create_user',
        details: JSON.stringify({ role, email }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
        performedBy: authUser.userId,
      },
    });

    await sendNewUserNotification(newUser.name, newUser.email, newUser.role, authUser.email ?? '');

    return NextResponse.json(newUser);
  } catch (error) {
    console.error('Error creando usuario:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
});
