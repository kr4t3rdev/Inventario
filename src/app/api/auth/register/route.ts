import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { normalizeUserRole } from "@/lib/auth/roles"
import { sendEmailVerificationLink } from "@/lib/email"
import { signOnboardingToken, validateCSRF } from "@/lib/auth/onboarding"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const path = '/api/auth/register'

    const csrf = validateCSRF(request.headers.get('x-request-id'))
    if (!csrf.valid) {
      return NextResponse.json({ error: csrf.error }, { status: 400 })
    }

    const rate = checkRateLimit(ip, path)
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Demasiados intentos. Intentalo de nuevo en unos segundos.' }, { status: 429 })
    }

    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: "El usuario ya existe" }, { status: 409 })
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 12)

    // Crear usuario
    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: normalizeUserRole('user')!,
        isActive: false,
        onboardingStatus: 'pending_email_verification',
        emailVerifiedAt: null,
      },
    })

    const verificationToken = signOnboardingToken({
      userId: createdUser.userId,
      email,
      purpose: 'email-verification',
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const verificationUrl = `${appUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`

    await sendEmailVerificationLink(email, verificationUrl, name)

    const res = NextResponse.json({
      message: "Revisá tu correo para verificar la cuenta y continuar con el onboarding",
      success: true,
    })
    res.headers.set('X-RateLimit-Remaining', String(rate.remaining))
    return res
  } catch (error) {
    console.error("Error en registro:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
