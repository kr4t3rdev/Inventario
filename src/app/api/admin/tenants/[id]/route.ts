import { type NextRequest, NextResponse } from 'next/server';

import { withAuthGet, type AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

/**
 * @description GET /api/admin/tenants/[id] - Detalle de un tenant específico.
 * Solo accesible para admin global (role === 'admin').
 */
export const GET = withAuthGet(async (_request: NextRequest, context: { params: Promise<{ id: string }> }, user: AuthenticatedUser) => {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores globales' }, { status: 403 });
    }

    const { id } = await context.params;

    const tenant = await prisma.tenant.findUnique({
      where: { tenantId: id },
      include: {
        _count: {
          select: {
            memberships: true,
            productos: true,
            almacenes: true,
            ventas: true,
            clientes: true,
            proveedores: true,
            empleados: true,
          },
        },
        licencias: {
          orderBy: { inicio: 'desc' },
          take: 1,
          include: { plan: { select: { nombre: true, descripcion: true, precio: true } } },
        },
        memberships: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                userId: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        empresa: {
          select: {
            nombre: true,
            propietario: true,
            email: true,
            telefono: true,
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
    }

    const activeLicense = tenant.licencias[0] ?? null;

    return NextResponse.json({
      tenantId: tenant.tenantId,
      nombre: tenant.nombre,
      slug: tenant.slug,
      createdAt: tenant.createdAt,
      empresa: tenant.empresa,
      stats: {
        totalUsers: tenant._count.memberships,
        activeUsers: tenant.memberships.length,
        totalProductos: tenant._count.productos,
        totalAlmacenes: tenant._count.almacenes,
        totalVentas: tenant._count.ventas,
        totalClientes: tenant._count.clientes,
        totalProveedores: tenant._count.proveedores,
        totalEmpleados: tenant._count.empleados,
      },
      license: activeLicense
        ? {
            plan: activeLicense.plan?.nombre ?? null,
            planPrecio: activeLicense.plan?.precio ?? null,
            activa: activeLicense.activa,
            inicio: activeLicense.inicio,
            expiracion: activeLicense.expiracion,
            maxUsuarios: activeLicense.maxUsuarios,
            maxAlmacenes: activeLicense.maxAlmacenes,
            maxProductos: activeLicense.maxProductos,
          }
        : null,
      users: tenant.memberships.map((m) => ({
        userId: m.user.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.user.role,
        tenantRole: m.tenantRole,
        isActive: m.user.isActive,
        createdAt: m.user.createdAt,
      })),
    });
  } catch (error) {
    console.error('[Admin/Tenant Detail] Error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
