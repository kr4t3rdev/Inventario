import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { verifyOnboardingToken, validateCSRF } from '@/lib/auth/onboarding'

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return null
  return authorization.replace('Bearer ', '').trim() || null
}

export async function POST(request: NextRequest) {
  try {
    const csrf = validateCSRF(request.headers.get('x-request-id'))
    if (!csrf.valid) {
      return NextResponse.json({ error: csrf.error }, { status: 400 })
    }

    const token = getBearerToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 401 })
    }

    const payload = verifyOnboardingToken(token)
    const { tenantId } = await request.json()

    if (!tenantId || typeof tenantId !== 'string') {
      return NextResponse.json({ error: 'Tenant inválido' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { userId: payload.userId },
      select: { userId: true, name: true, onboardingType: true, onboardingStatus: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { tenantId },
      select: { tenantId: true },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    }

    const existingMembershipCount = await prisma.tenantMembership.count({
      where: { userId: payload.userId, isActive: true },
    })

    if (existingMembershipCount >= 1) {
      return NextResponse.json(
        {
          error: 'La multimembresía requiere aprobación del admin global',
          requiresAdminApproval: true,
        },
        { status: 403 },
      )
    }

    const membership = await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId, userId: payload.userId } },
      create: {
        tenantId,
        userId: payload.userId,
        tenantRole: 'dependiente',
        isActive: false,
      },
      update: {
        isActive: false,
        tenantRole: 'dependiente',
      },
    })

    await prisma.user.update({
      where: { userId: payload.userId },
      data: {
        onboardingStatus: 'awaiting_manager_approval',
      },
    })

    const managers = await prisma.tenantMembership.findMany({
      where: {
        tenantId,
        isActive: true,
        tenantRole: { in: ['manager', 'admin'] },
      },
      select: { userId: true },
    })

    const notificationPromises = managers.map((manager) =>
      prisma.notification.create({
        data: {
          userId: manager.userId,
          title: 'Nuevo miembro esperando aprobación',
          message: `${user.name} solicita acceso a la empresa como dependiente. Revisá las solicitudes pendientes.`,
          type: 'info',
          prioridad: 'media',
        },
      }),
    )

    await Promise.all(notificationPromises)

    return NextResponse.json({ success: true, membershipId: membership.membershipId })
  } catch (error) {
    console.error('Error asignando tenant al onboarding:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
