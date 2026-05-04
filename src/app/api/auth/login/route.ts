import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { sendFailedLoginAttemptsNotification } from "@/lib/email"
import { getJwtSecret, getRefreshJwtSecret } from "@/lib/secrets"
import { resolveTenantContext } from "@/lib/auth-middleware"
const MAX_LOGIN_ATTEMPTS = 5
const LOCK_TIME_MINUTES = 15

const ONBOARDING_MID_FLOW = new Set([
  'pending_email_verification',
  'selecting_user_type',
  'selecting_tenant',
  'awaiting_manager_approval',
  'awaiting_global_approval',
])

/**
 * @description Indica si el usuario está en un estado de onboarding que todavía no llegó a completado.
 * @param {string | null} onboardingStatus
 * @returns {boolean}
 */
function isMidOnboarding(onboardingStatus: string | null): boolean {
  if (!onboardingStatus) return false
  return ONBOARDING_MID_FLOW.has(onboardingStatus)
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        userId: true,
        name: true,
        email: true,
        password: true,
        role: true,
        isActive: true,
        expiresAt: true,
        lockedUntil: true,
        loginAttempts: true,
        onboardingStatus: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
    }

    if (user.isActive === false) {
      return NextResponse.json({ error: 'Su usuario está inactivo, por favor contacte con el administrador.' }, { status: 403 })
    }

    const midOnboarding = isMidOnboarding(user.onboardingStatus)

    if (!midOnboarding && user.expiresAt && new Date(user.expiresAt) < new Date() && user.role !== "admin") {
      const diasRestantes = 0
      return NextResponse.json({
        error: "Licencia expirada o no válida",
        licenciaExpirada: true,
        diasRestantes,
        plan: undefined,
      }, { status: 403 })
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / (1000 * 60))
      return NextResponse.json({ error: `Cuenta bloqueada. Intente nuevamente en ${remainingMinutes} minutos.` }, { status: 403 })
    }

    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      const newAttempts = (user.loginAttempts || 0) + 1
      const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS
      const ipAddress = request.headers.get("x-forwarded-for") || null
      const userAgent = request.headers.get("user-agent") || null

      await prisma.user.update({
        where: { userId: user.userId },
        data: {
          loginAttempts: newAttempts,
          lastFailedLogin: new Date(),
          lockedUntil: shouldLock ? new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000) : null,
        },
      })

      await prisma.userActivityLog.create({
        data: {
          userId: user.userId,
          action: "login_failed",
          details: JSON.stringify({
            attemptNumber: newAttempts,
            ipAddress,
            userAgent,
          }),
          ipAddress,
          userAgent,
          performedBy: user.userId,
        },
      })

      if (newAttempts >= 3 && !shouldLock) {
        const admins = await prisma.user.findMany({
          where: { role: "admin", isActive: true },
          select: { userId: true },
        })

        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.userId,
              title: "Alerta: Múltiples intentos fallidos",
              message: `El usuario ${user.name} (${user.email}) ha realizado ${newAttempts} intentos fallidos de inicio de sesión. Posible ataque de fuerza bruta.`,
              type: "warning",
              prioridad: "alta",
            },
          })
        }
      }

      if (shouldLock) {
        const admins = await prisma.user.findMany({
          where: { role: "admin", isActive: true },
          select: { userId: true },
        })

        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.userId,
              title: "Usuario bloqueado por intentos fallidos",
              message: `El usuario ${user.name} (${user.email}) ha sido bloqueado tras ${MAX_LOGIN_ATTEMPTS} intentos fallidos de inicio de sesión.`,
              type: "error",
              prioridad: "alta",
            },
          })
        }

        await sendFailedLoginAttemptsNotification(
          user.name,
          user.email,
          newAttempts,
          ipAddress,
          userAgent
        )

        return NextResponse.json({ error: `Cuenta bloqueada por ${LOCK_TIME_MINUTES} minutos debido a múltiples intentos fallidos.` }, { status: 403 })
      }

      const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts
      return NextResponse.json({ error: `Credenciales inválidas. ${remainingAttempts} intentos restantes.` }, { status: 401 })
    }

    await prisma.user.update({
      where: { userId: user.userId },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastFailedLogin: null,
      },
    })

    let tenantContext: Awaited<ReturnType<typeof resolveTenantContext>> = null

    if (!midOnboarding) {
      const requestedTenantId = request.headers.get('x-tenant-id')
      tenantContext = await resolveTenantContext(user.userId, requestedTenantId)

      if (requestedTenantId && !tenantContext) {
        return NextResponse.json(
          {
            error: 'Tenant inválido',
            message: 'El tenant solicitado no pertenece al usuario o no está activo.',
          },
          { status: 403 }
        )
      }

      if (tenantContext) {
        await prisma.user.update({
          where: { userId: user.userId },
          data: {
            expiresAt: tenantContext.licenseExpiresAt ?? null,
          },
        })
      } else if (user.role !== 'admin') {
        return NextResponse.json(
          {
            error: 'No tenés una empresa activa para iniciar sesión.',
            message: 'Contactá al manager de tu empresa o al admin global para completar tu acceso.',
          },
          { status: 403 }
        )
      }
    }

    const tokenPayload: Record<string, unknown> = { userId: user.userId, email: user.email }
    if (tenantContext) {
      tokenPayload.tenantId = tenantContext.tenantId
      tokenPayload.tenantRole = tenantContext.tenantRole
    }
    if (midOnboarding) {
      tokenPayload.onboardingStatus = user.onboardingStatus
    }

    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: "30d" })
    const refreshToken = jwt.sign(
      {
        ...tokenPayload,
        refreshId: Date.now(),
      },
      getRefreshJwtSecret(),
      { expiresIn: "30d" }
    )

    await prisma.userSession.create({
      data: {
        userId: user.userId,
        token,
        ipAddress: request.headers.get("x-forwarded-for") || null,
        userAgent: request.headers.get("user-agent") || null,
        isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    // Registrar login exitoso y devolver token + set refresh cookie
    const ipAddress = request.headers.get("x-forwarded-for") || null
    const userAgent = request.headers.get("user-agent") || null
    await prisma.userActivityLog.create({
      data: {
        userId: user.userId,
        action: "login",
        details: JSON.stringify({
          timestamp: new Date().toISOString(),
        }),
        ipAddress,
        userAgent,
        performedBy: user.userId,
      },
    })

    const { password: _, ...userWithoutPassword } = user

    const res = NextResponse.json({
      token,
      user: {
        ...userWithoutPassword,
        ...(tenantContext && {
          tenantId: tenantContext.tenantId,
          tenantRole: tenantContext.tenantRole,
        }),
      },
    })
    // Persist refresh token in HttpOnly cookie
    res.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })
    return res
  } catch (error) {
    console.error("Error en login:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
