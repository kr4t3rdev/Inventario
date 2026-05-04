import { type NextRequest, NextResponse } from 'next/server'

import { withAuthGet, type AuthenticatedUser } from '@/lib/auth-middleware'
import { isTenantAdminRole } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'

export const GET = withAuthGet(async (_request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json([]);
    }

    const tenantId = user.tenantId;

    if (!isTenantAdminRole(user.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId, isActive: false },
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            email: true,
            onboardingType: true,
            onboardingStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(memberships)
  } catch (error) {
    console.error('Error listando membresías pendientes:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
