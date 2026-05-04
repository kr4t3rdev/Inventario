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
    const { userType } = await request.json()

    if (!['worker', 'company'].includes(userType)) {
      return NextResponse.json({ error: 'Tipo de usuario inválido' }, { status: 400 })
    }

    const onboardingStatus = userType === 'worker' ? 'selecting_tenant' : 'awaiting_global_approval'

    await prisma.user.update({
      where: { userId: payload.userId },
      data: {
        onboardingType: userType,
        onboardingStatus,
      },
    })

    return NextResponse.json({ success: true, onboardingStatus })
  } catch (error) {
    console.error('Error actualizando tipo de onboarding:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
