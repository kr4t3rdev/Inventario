import { type NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import { isAdminRole } from '@/lib/auth/roles';
import { userMetricsQuerySchema } from '@/lib/admin/schemas';
import { getUserMetrics } from '@/lib/admin/userMetrics';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateUser(request);
    if ('status' in auth) return auth as Response;

    if (!isAdminRole(auth.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const months = searchParams.get('months') ?? undefined;
    const tenantId = searchParams.get('tenantId') ?? undefined;

    const parsed = userMetricsQuerySchema.safeParse({ months });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const metrics = await getUserMetrics(prisma, parsed.data.months, tenantId);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error obteniendo métricas globales de usuarios:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
