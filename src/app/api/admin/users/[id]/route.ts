import bcrypt from 'bcryptjs';
import { type NextRequest, NextResponse } from 'next/server';

import { authenticateUser, type AuthenticatedUser } from '@/lib/auth-middleware';
import { updateUserBodySchema, userIdParamSchema } from '@/lib/admin/schemas';
import { isTenantAdminRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

type UpdateUserData = {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  isActive?: boolean;
  activatedAt?: Date;
  expiresAt?: Date;
};

/**
 * @description Obtiene la información detallada de un usuario específico para el panel de administración.
 * @param {NextRequest} request Solicitud HTTP entrante con los encabezados de autenticación.
 * @param {{ params: Promise<{ id: string }> }} context Parámetros dinámicos con el identificador del usuario.
 * @returns {Promise<NextResponse>} Respuesta JSON con el usuario o el error correspondiente.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const authResultAuthUser1 = await authenticateUser(request);
    if ('status' in authResultAuthUser1) return authResultAuthUser1 as NextResponse;
    const authUser = authResultAuthUser1.user as AuthenticatedUser;
    const tenantId = authUser.tenantId;
    if (!tenantId || !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const paramParse = userIdParamSchema.safeParse(await context.params);
    if (!paramParse.success) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
    }

    const { id } = paramParse.data;

    // Verificar que el usuario pertenece al tenant
    const membership = await prisma.tenantMembership.findFirst({
      where: { userId: id, tenantId, isActive: true },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Usuario no encontrado en esta empresa' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { userId: id },
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
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

/**
 * @description Actualiza los datos de un usuario específico garantizando permisos administrativos.
 * @param {NextRequest} request Solicitud HTTP entrante con el cuerpo de la actualización.
 * @param {{ params: Promise<{ id: string }> }} context Parámetros dinámicos con el identificador del usuario.
 * @returns {Promise<NextResponse>} Respuesta JSON con el usuario actualizado o el error generado.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const authResultAuthUser2 = await authenticateUser(request);
    if ('status' in authResultAuthUser2) return authResultAuthUser2 as NextResponse;
    const authUser = authResultAuthUser2.user as AuthenticatedUser;
    const tenantId = authUser.tenantId;
    if (!tenantId || !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const paramParse = userIdParamSchema.safeParse(await context.params);
    if (!paramParse.success) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
    }

    const body = await request.json();
    const bodyParse = updateUserBodySchema.safeParse(body);
    if (!bodyParse.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: bodyParse.error.flatten() },
        { status: 400 },
      );
    }

    const { id } = paramParse.data;
    const membership = await prisma.tenantMembership.findFirst({
      where: { userId: id, tenantId, isActive: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Usuario no encontrado en esta empresa' }, { status: 404 });
    }
    const { name, email, password, role, isActive, daysToExpire } = bodyParse.data;

    const existingUser = await prisma.user.findUnique({
      where: { userId: id },
      select: { userId: true, isActive: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const updateData: UpdateUserData = {
      name,
      email,
      role,
      isActive,
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    if (isActive === true && existingUser.isActive === false) {
      updateData.activatedAt = new Date();
    }

    if (daysToExpire && isActive !== false) {
      updateData.expiresAt = new Date(Date.now() + daysToExpire * 24 * 60 * 60 * 1000);
    }

    const updatedUser = await prisma.user.update({
      where: { userId: id },
      data: {
        ...updateData,
        lastModifiedBy: authUser.userId,
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
        userId: id,
        action: 'update_user',
        details: JSON.stringify({ fields: Object.keys(updateData) }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
        performedBy: authUser.userId,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

/**
 * @description Elimina un usuario específico tras validar permisos de administrador.
 * @param {NextRequest} request Solicitud HTTP con los encabezados de autenticación.
 * @param {{ params: Promise<{ id: string }> }} context Parámetros dinámicos con el identificador del usuario.
 * @returns {Promise<NextResponse>} Respuesta JSON que confirma la eliminación o describe el error.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const authResultAuthUser3 = await authenticateUser(request);
    if ('status' in authResultAuthUser3) return authResultAuthUser3 as NextResponse;
    const authUser = authResultAuthUser3.user as AuthenticatedUser;
    const tenantId = authUser.tenantId;
    if (!tenantId || !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const paramParse = userIdParamSchema.safeParse(await context.params);
    if (!paramParse.success) {
      return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
    }

    const { id } = paramParse.data;

    const membership = await prisma.tenantMembership.findFirst({
      where: { userId: id, tenantId, isActive: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Usuario no encontrado en esta empresa' }, { status: 404 });
    }

    const userToDelete = await prisma.user.findUnique({
      where: { userId: id },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
      },
    });

    await prisma.user.delete({
      where: { userId: id },
    });

    if (userToDelete) {
      await prisma.userActivityLog.create({
        data: {
          userId: id,
          action: 'delete_user',
          details: JSON.stringify(userToDelete),
          ipAddress: request.headers.get('x-forwarded-for') || null,
          userAgent: request.headers.get('user-agent') || null,
          performedBy: authUser.userId,
        },
      });
    }

    return NextResponse.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
