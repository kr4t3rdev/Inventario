import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { verifyOnboardingToken, validateCSRF } from '@/lib/auth/onboarding'

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return null
  return authorization.replace('Bearer ', '').trim() || null
}

export async function GET(request: NextRequest) {
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
    if (payload.purpose !== 'onboarding') {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { userId: payload.userId },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        onboardingType: true,
        onboardingStatus: true,
        emailVerifiedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const tenants = await prisma.tenant.findMany({
      select: { tenantId: true, nombre: true, slug: true },
      orderBy: { nombre: 'asc' },
    })

    return NextResponse.json({ user, tenants })
  } catch (error) {
    console.error('Error obteniendo onboarding:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
