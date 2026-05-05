import bcrypt from 'bcryptjs';
import { type NextRequest, NextResponse } from 'next/server';

import { withAuthGet, withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware';
import { createUserBodySchema } from '@/lib/admin/schemas';
import { sendNewUserNotification } from '@/lib/email';
import { platformRoleToTenantRole, isTenantAdminRole } from '@/lib/auth/roles';
import { validateTenantLimit } from '@/lib/services/tenant-scope';
import { prisma } from '@/lib/prisma';

/**
 * @description GET /api/admin/users - Lista usuarios del tenant autenticado.
 * Filtra por membresías activas en el tenant del usuario.
 */
export const GET = withAuthGet(async (_request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    // Admin global sin tenant: sin usuarios que listar en este contexto
    if (!user.tenantId) {
      return NextResponse.json([]);
    }

    const tenantId = user.tenantId;

    if (!isTenantAdminRole(user.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            expiresAt: true,
            lastModifiedBy: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Devolver usuarios con su tenantRole incluido
    const users = memberships.map((m) => ({
      ...m.user,
      tenantRole: m.tenantRole,
      membershipId: m.membershipId,
    }));

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error obteniendo users del tenant:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

/**
 * @description POST /api/admin/users - Crea usuario dentro del tenant autenticado.
 * Valida límite de usuarios del plan antes de crear.
 */
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json({ error: 'Se requiere una membresía de empresa activa para crear usuarios' }, { status: 403 });
    }

    const tenantId = user.tenantId;

    if (!isTenantAdminRole(user.tenantRole)) {
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

    const { name, email, password, role, tenantRole, daysToExpire } = parseResult.data;

    // 1. Validar límite de usuarios del plan
    const currentCount = await prisma.tenantMembership.count({
      where: { tenantId },
    });
    await validateTenantLimit(tenantId, 'maxUsuarios', currentCount);

    // 2. Buscar o crear usuario global
    const existingUser = await prisma.user.findUnique({ where: { email } });

    let targetUser = existingUser;

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(password, 12);
      const now = new Date();
      const expiresAt = daysToExpire
        ? new Date(now.getTime() + daysToExpire * 24 * 60 * 60 * 1000)
        : null;

      targetUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,
          isActive: false,
          activatedAt: now,
          expiresAt,
          lastModifiedBy: user.userId,
          loginAttempts: 0,
          lockedUntil: null,
          lastFailedLogin: null,
        },
      });
    } else {
      // El usuario ya existe globalmente, verificar si ya tiene membresía en este tenant
      const existingMembership = await prisma.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: existingUser.userId } },
      });
      if (existingMembership) {
        return NextResponse.json({ error: 'El usuario ya pertenece a esta empresa' }, { status: 409 });
      }
    }

    // 3. Crear membresía tenant para el usuario
    const effectiveTenantRole = tenantRole ?? platformRoleToTenantRole(role as any);
    await prisma.tenantMembership.create({
      data: {
        tenantId,
        userId: targetUser!.userId,
        tenantRole: effectiveTenantRole,
        isActive: true,
      },
    });

    // 4. Log de auditoría
    await prisma.userActivityLog.create({
      data: {
        userId: targetUser!.userId,
        action: existingUser ? 'assign_tenant' : 'create_user',
        details: JSON.stringify({ role, tenantRole: effectiveTenantRole, email, tenantId }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
        performedBy: user.userId,
      },
    });

    if (!existingUser) {
      await sendNewUserNotification(targetUser!.name, targetUser!.email, targetUser!.role, user.email ?? '');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...safeUser } = targetUser!;
    return NextResponse.json({
      ...safeUser,
      tenantRole,
    });
  } catch (error) {
    console.error('Error creando usuario en tenant:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
