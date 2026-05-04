import { type NextRequest, NextResponse } from 'next/server'

import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware'
import { isTenantAdminRole, normalizeTenantRole } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'

interface MembershipAction {
  action: 'approve' | 'reject'
  tenantRole?: string
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: AuthenticatedUser,
): Promise<NextResponse> {
  try {
    if (!user.tenantId) {
      return NextResponse.json({ error: 'Se requiere una membresía de empresa activa para gestionar membresías' }, { status: 403 })
    }

    const tenantId = user.tenantId;

    if (!isTenantAdminRole(user.tenantRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id: membershipId } = await context.params

    if (!membershipId || typeof membershipId !== 'string') {
      return NextResponse.json({ error: 'ID de membresía inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { action, tenantRole: requestedRole } = body as MembershipAction

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida. Usá approve o reject.' }, { status: 400 })
    }

    const membership = await prisma.tenantMembership.findUnique({
      where: { membershipId },
      select: { membershipId: true, tenantId: true, userId: true, isActive: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Membresía no encontrada' }, { status: 404 })
    }

    if (membership.tenantId !== tenantId) {
      return NextResponse.json({ error: 'La membresía no pertenece a tu empresa' }, { status: 403 })
    }

    if (action === 'reject') {
      await prisma.tenantMembership.delete({ where: { membershipId } })

      await prisma.user.update({
        where: { userId: membership.userId },
        data: { onboardingStatus: 'selecting_tenant' },
      })

      return NextResponse.json({ success: true, action: 'rejected' })
    }

    // approve
    const role = normalizeTenantRole(requestedRole) ?? 'dependiente'

    await prisma.tenantMembership.update({
      where: { membershipId },
      data: { isActive: true, tenantRole: role },
    })

    await prisma.user.update({
      where: { userId: membership.userId },
      data: {
        role: 'dependiente',
        isActive: true,
        onboardingStatus: 'completed',
        activatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, action: 'approved', tenantRole: role })
  } catch (error) {
    console.error('Error procesando membresía:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const PATCH = withAuth(handler)
