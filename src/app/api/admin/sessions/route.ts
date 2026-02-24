import { type NextRequest, NextResponse } from 'next/server';

import { verify_token } from '@/lib/auth-utils';
import { deleteSessionQuerySchema } from '@/lib/admin/schemas';
import { isAdminRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authUser = await verify_token(request);
    if (!authUser || !isAdminRole(authUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const where = userId ? { userId } : {};

    const sessions = await prisma.userSession.findMany({
      where,
      orderBy: { lastActive: 'desc' },
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

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error obteniendo sesiones:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await verify_token(request);
    if (!authUser || !isAdminRole(authUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = deleteSessionQuerySchema.safeParse({
      sessionId: searchParams.get('sessionId'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    await prisma.userSession.update({
      where: { id: parsed.data.sessionId },
      data: { isActive: false },
    });

    return NextResponse.json({ message: 'Sesión cerrada correctamente' });
  } catch (error) {
    console.error('Error cerrando sesión:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
