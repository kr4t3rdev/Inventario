import { type NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import { isAdminRole, isTenantAdminRole } from '@/lib/auth/roles';
import { globalUsersQuerySchema } from '@/lib/admin/schemas';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateUser(request);
    if ('status' in auth) return auth as Response;

    const isGlobalAdmin = isAdminRole(auth.user.role);
    const isTenantManager = auth.user.tenantId && isTenantAdminRole(auth.user.tenantRole);

    if (!isGlobalAdmin && !isTenantManager) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    
    // Si es manager de empresa, forzar filtro por su tenant
    const requestedTenantId = isTenantManager && !isGlobalAdmin
      ? auth.user.tenantId
      : searchParams.get('tenantId') ?? undefined;
    
    const parsed = globalUsersQuerySchema.safeParse({
      tenantId: requestedTenantId ?? undefined,
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

    const membershipWhere: Prisma.TenantMembershipWhereInput = {
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
      orderBy.user = { createdAt: sortOrder };
    }

    let usersFromMemberships: any[] = [];
    let membershipTotal = 0;

    try {
      const [memberships, count] = await Promise.all([
        prisma.tenantMembership.findMany({
          where: membershipWhere,
          include: {
            user: true,
            tenant: { select: { nombre: true, slug: true } },
          },
          orderBy,
        }),
        prisma.tenantMembership.count({ where: membershipWhere }),
      ]);

      usersFromMemberships = memberships.map((m) => ({
        ...m.user,
        tenantId: m.tenantId,
        tenantSlug: m.tenant.slug,
        tenantName: m.tenant.nombre,
        tenantRole: m.tenantRole,
        membershipId: m.membershipId,
      }));
      membershipTotal = count;
    } catch (membershipError) {
      console.error('[Admin/GlobalUsers] Error consultando memberships:', membershipError);
    }

    // Buscar usuarios pendientes de aprobación global que NO tienen membresía
    let usersFromPending: any[] = [];

    try {
      const pendingUserWhere: Prisma.UserWhereInput = {
        onboardingStatus: 'awaiting_global_approval',
        tenantMemberships: { none: {} },
        ...(typeof isActive !== 'undefined' ? { isActive } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };

      const pendingUsers = await prisma.user.findMany({
        where: pendingUserWhere,
        orderBy: sortBy === 'name' || sortBy === 'email' ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      });

      if (Array.isArray(pendingUsers)) {
        usersFromPending = pendingUsers.map((u) => ({
          ...u,
          tenantId: null,
          tenantSlug: null,
          tenantName: null,
          tenantRole: null,
          membershipId: null,
        }));
      }
    } catch (pendingError) {
      console.error('[Admin/GlobalUsers] Error consultando usuarios pendientes:', pendingError);
    }

    const allUsers = [...usersFromMemberships, ...usersFromPending];

    // Aplicar paginación manual sobre el resultado combinado
    const total = membershipTotal + usersFromPending.length;
    const startIndex = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      users: paginatedUsers,
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
