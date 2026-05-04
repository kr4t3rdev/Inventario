import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { signOnboardingToken, verifyOnboardingToken } from '@/lib/auth/onboarding'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const path = '/api/auth/verify-email'

    const rate = checkRateLimit(ip, path)
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Demasiados intentos. Intentalo de nuevo en unos segundos.' }, { status: 429 })
    }

    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    const payload = verifyOnboardingToken(token)
    if (payload.purpose !== 'email-verification') {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { userId: payload.userId },
      select: { userId: true, email: true, isActive: true, onboardingStatus: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const onboardingToken = signOnboardingToken(
      {
        userId: user.userId,
        email: user.email,
        purpose: 'onboarding',
      },
      '48h',
    )

    await prisma.user.update({
      where: { userId: user.userId },
      data: {
        emailVerifiedAt: new Date(),
        onboardingStatus: 'selecting_user_type',
      },
    })

    const res = NextResponse.json({
      success: true,
      onboardingToken,
      user: {
        userId: user.userId,
        email: user.email,
        isActive: user.isActive,
        onboardingStatus: 'selecting_user_type',
      },
    })
    res.headers.set('X-RateLimit-Remaining', String(rate.remaining))
    return res
  } catch (error) {
    console.error('Error verificando email:', error)
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 400 })
  }
}
