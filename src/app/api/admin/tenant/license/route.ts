import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthGet, type AuthenticatedUser } from '@/lib/auth-middleware'
import { requireTenant } from '@/lib/services/tenant-scope'

/**
 * @description GET /api/admin/tenant/license
 * Devuelve la licencia activa del tenant actual y el consumo de recursos.
 * La UI usa estos datos para mostrar el estado del plan y las barras de progreso.
 */
export const GET = withAuthGet(async (_request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user)

    // Licencia activa más reciente
    const license = await prisma.tenantLicense.findFirst({
      where: { tenantId, activa: true },
      orderBy: { inicio: 'desc' },
      include: { plan: true },
    })

    // Consumo actual
    const [userCount, almacenCount, productoCount] = await Promise.all([
      prisma.tenantMembership.count({ where: { tenantId, isActive: true } }),
      prisma.almacen.count({ where: { tenantId } }),
      prisma.producto.count({ where: { tenantId } }),
    ])

    return NextResponse.json({
      license: license
        ? {
            tenantLicenseId: license.tenantLicenseId,
            activa: license.activa,
            inicio: license.inicio,
            expiracion: license.expiracion,
            plan: license.plan
              ? {
                  planId: license.plan.planId,
                  nombre: license.plan.nombre,
                }
              : null,
          }
        : null,
      limits: {
        maxUsuarios: license?.maxUsuarios ?? 0,
        maxAlmacenes: license?.maxAlmacenes ?? 0,
        maxProductos: license?.maxProductos ?? 0,
      },
      consumption: {
        usuarios: userCount,
        almacenes: almacenCount,
        productos: productoCount,
      },
      tenantId,
      tenantRole: user.tenantRole,
    })
  } catch (error) {
    console.error('[TenantLicense] Error:', error)
    const message = error instanceof Error ? error.message : 'Error obteniendo licencia del tenant'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
