import { type NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import { userMetricsQuerySchema } from '@/lib/admin/schemas';
import { getUserMetrics } from '@/lib/admin/userMetrics';
import { isTenantAdminRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authResultGet = await authenticateUser(request)
    if ('status' in authResultGet) return authResultGet as Response
    const authUser = authResultGet.user
    const tenantId = authUser.tenantId
    // Admin global (plataforma) puede ver métricas de todos los tenants
    if (!tenantId && authUser.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    // Si tiene tenant, debe tener rol administrativo dentro del tenant
    if (tenantId && !isTenantAdminRole(authUser.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const months = searchParams.get('months') ?? undefined;
    const requestTenantId = searchParams.get('tenantId') ?? undefined;

    // Global admin puede filtrar por tenant via query param
    const effectiveTenantId = requestTenantId && authUser.role === 'admin'
      ? requestTenantId
      : tenantId;

    const parsedQuery = userMetricsQuerySchema.safeParse({ months });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsedQuery.error.flatten() },
        { status: 400 },
      );
    }

    const metrics = await getUserMetrics(prisma, parsedQuery.data.months, effectiveTenantId);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error obteniendo métricas temporales:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
