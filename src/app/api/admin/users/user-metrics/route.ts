import { type NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import { userMetricsQuerySchema } from '@/lib/admin/schemas';
import { getUserMetrics } from '@/lib/admin/userMetrics';
import { isAdminRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authResultGet = await authenticateUser(request)
    if ('status' in authResultGet) return authResultGet as Response
    const authUser = authResultGet.user
    if (!isAdminRole(authUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = userMetricsQuerySchema.safeParse({
      months: searchParams.get('months') ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsedQuery.error.flatten() },
        { status: 400 },
      );
    }

    const metrics = await getUserMetrics(prisma, parsedQuery.data.months);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error obteniendo métricas temporales:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
