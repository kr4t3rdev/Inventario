import { type NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import { isAdminRole } from '@/lib/auth/roles';
import { globalUsersQuerySchema } from '@/lib/admin/schemas';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateUser(request);
    if ('status' in auth) return auth as Response;

    if (!isAdminRole(auth.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = globalUsersQuerySchema.safeParse({
      tenantId: searchParams.get('tenantId') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      role: searchParams.get('role') ?? undefined,
      isActive: searchParams.get('isActive') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortOrder: searchParams.get('sortOrder') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { tenantId, search, role, isActive, page, limit, sortBy, sortOrder } = parsed.data;

    const where: Prisma.TenantMembershipWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(role ? { tenantRole: role } : {}),
      ...(typeof isActive !== 'undefined'
        ? { user: { isActive } }
        : {}),
      ...(search
        ? {
            user: {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };

    const orderBy: Prisma.TenantMembershipOrderByWithRelationInput = {};
    if (sortBy === 'name' || sortBy === 'email') {
      orderBy.user = { [sortBy]: sortOrder };
    } else {
      orderBy.user = { [sortBy]: sortOrder };
    }

    const [memberships, total] = await Promise.all([
      prisma.tenantMembership.findMany({
        where,
        include: {
          user: true,
          tenant: { select: { nombre: true, slug: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tenantMembership.count({ where }),
    ]);

    const users = memberships.map((m) => ({
      ...m.user,
      tenantId: m.tenantId,
      tenantSlug: m.tenant.slug,
      tenantName: m.tenant.nombre,
      tenantRole: m.tenantRole,
      membershipId: m.membershipId,
    }));

    return NextResponse.json({
      users,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    });
  } catch (error) {
    console.error('Error obteniendo usuarios globales:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
