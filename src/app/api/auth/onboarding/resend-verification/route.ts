import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { signOnboardingToken, validateCSRF } from '@/lib/auth/onboarding'
import { sendEmailVerificationLink } from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const path = '/api/auth/onboarding/resend-verification'

    const csrf = validateCSRF(request.headers.get('x-request-id'))
    if (!csrf.valid) {
      return NextResponse.json({ error: csrf.error }, { status: 400 })
    }

    const rate = checkRateLimit(ip, path)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Intentalo de nuevo más tarde.' },
        { status: 429 },
      )
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { userId: true, name: true, email: true, onboardingStatus: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (user.onboardingStatus !== 'pending_email_verification') {
      return NextResponse.json(
        { error: 'El email ya fue verificado o el usuario no está en estado de verificación.' },
        { status: 400 },
      )
    }

    const verificationToken = signOnboardingToken({
      userId: user.userId,
      email: user.email,
      purpose: 'email-verification',
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const verificationUrl = `${appUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`

    await sendEmailVerificationLink(user.email, verificationUrl, user.name)

    const res = NextResponse.json({
      success: true,
      message: 'Email de verificación reenviado.',
    })
    res.headers.set('X-RateLimit-Remaining', String(rate.remaining))
    return res
  } catch (error) {
    console.error('Error reenviando verificación:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
