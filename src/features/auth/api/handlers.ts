import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sendFailedLoginAttemptsNotification, sendEmailVerificationLink } from '@/lib/email'
import { getJwtSecret, getRefreshJwtSecret } from '@/lib/secrets'
import { authenticateUser, resolveTenantContext } from '@/lib/auth-middleware'
import { normalizeUserRole } from '@/lib/auth/roles'
import { signOnboardingToken, verifyOnboardingToken, validateCSRF } from '@/lib/auth/onboarding'
import { checkRateLimit } from '@/lib/rate-limit'

const MAX_LOGIN_ATTEMPTS = 5
const LOCK_TIME_MINUTES = 15

const ONBOARDING_MID_FLOW = new Set([
  'pending_email_verification',
  'selecting_user_type',
  'selecting_tenant',
  'awaiting_manager_approval',
  'awaiting_global_approval',
])

function isMidOnboarding(onboardingStatus: string | null): boolean {
  if (!onboardingStatus) return false
  return ONBOARDING_MID_FLOW.has(onboardingStatus)
}

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return null
  return authorization.replace('Bearer ', '').trim() || null
}

export async function login(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
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
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    if (user.isActive === false) {
      return NextResponse.json(
        { error: 'Su usuario está inactivo, por favor contacte con el administrador.' },
        { status: 403 },
      )
    }

    const midOnboarding = isMidOnboarding(user.onboardingStatus)

    if (!midOnboarding && user.expiresAt && new Date(user.expiresAt) < new Date() && user.role !== 'admin') {
      return NextResponse.json(
        {
          error: 'Licencia expirada o no válida',
          licenciaExpirada: true,
          diasRestantes: 0,
          plan: undefined,
        },
        { status: 403 },
      )
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMinutes = Math.ceil(
        (new Date(user.lockedUntil).getTime() - Date.now()) / (1000 * 60),
      )
      return NextResponse.json(
        { error: `Cuenta bloqueada. Intente nuevamente en ${remainingMinutes} minutos.` },
        { status: 403 },
      )
    }

    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      const newAttempts = (user.loginAttempts || 0) + 1
      const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS
      const ipAddress = request.headers.get('x-forwarded-for') || null
      const userAgent = request.headers.get('user-agent') || null

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
          action: 'login_failed',
          details: JSON.stringify({ attemptNumber: newAttempts, ipAddress, userAgent }),
          ipAddress,
          userAgent,
          performedBy: user.userId,
        },
      })

      if (newAttempts >= 3 && !shouldLock) {
        const admins = await prisma.user.findMany({
          where: { role: 'admin', isActive: true },
          select: { userId: true },
        })
        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.userId,
              title: 'Alerta: Múltiples intentos fallidos',
              message: `El usuario ${user.name} (${user.email}) ha realizado ${newAttempts} intentos fallidos de inicio de sesión. Posible ataque de fuerza bruta.`,
              type: 'warning',
              prioridad: 'alta',
            },
          })
        }
      }

      if (shouldLock) {
        const admins = await prisma.user.findMany({
          where: { role: 'admin', isActive: true },
          select: { userId: true },
        })
        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.userId,
              title: 'Usuario bloqueado por intentos fallidos',
              message: `El usuario ${user.name} (${user.email}) ha sido bloqueado tras ${MAX_LOGIN_ATTEMPTS} intentos fallidos de inicio de sesión.`,
              type: 'error',
              prioridad: 'alta',
            },
          })
        }
        await sendFailedLoginAttemptsNotification(user.name, user.email, newAttempts, ipAddress, userAgent)
        return NextResponse.json(
          { error: `Cuenta bloqueada por ${LOCK_TIME_MINUTES} minutos debido a múltiples intentos fallidos.` },
          { status: 403 },
        )
      }

      const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts
      return NextResponse.json(
        { error: `Credenciales inválidas. ${remainingAttempts} intentos restantes.` },
        { status: 401 },
      )
    }

    await prisma.user.update({
      where: { userId: user.userId },
      data: { loginAttempts: 0, lockedUntil: null, lastFailedLogin: null },
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
          { status: 403 },
        )
      }

      if (tenantContext) {
        await prisma.user.update({
          where: { userId: user.userId },
          data: { expiresAt: tenantContext.licenseExpiresAt ?? null },
        })
      } else if (user.role !== 'admin') {
        return NextResponse.json(
          {
            error: 'No tenés una empresa activa para iniciar sesión.',
            message: 'Contactá al manager de tu empresa o al admin global para completar tu acceso.',
          },
          { status: 403 },
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

    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '30d' })
    const refreshToken = jwt.sign(
      { ...tokenPayload, refreshId: Date.now() },
      getRefreshJwtSecret(),
      { expiresIn: '30d' },
    )

    await prisma.userSession.create({
      data: {
        userId: user.userId,
        token,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    const ipAddress = request.headers.get('x-forwarded-for') || null
    const userAgent = request.headers.get('user-agent') || null
    await prisma.userActivityLog.create({
      data: {
        userId: user.userId,
        action: 'login',
        details: JSON.stringify({ timestamp: new Date().toISOString() }),
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
    res.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })
    return res
  } catch (error) {
    console.error('Error en login:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function logout(request: NextRequest) {
  try {
    const authResultOpt = await authenticateUser(request)
    const auth_user = 'status' in authResultOpt ? null : authResultOpt.user
    const ipAddress = request.headers.get('x-forwarded-for') || null
    const userAgent = request.headers.get('user-agent') || null

    if (auth_user) {
      await prisma.userSession.updateMany({
        where: { userId: auth_user.userId, isActive: true },
        data: { isActive: false },
      })

      await prisma.userActivityLog.create({
        data: {
          userId: auth_user.userId,
          action: 'logout',
          details: JSON.stringify({ timestamp: new Date().toISOString() }),
          ipAddress,
          userAgent,
          performedBy: auth_user.userId,
        },
      })
    }

    const response = NextResponse.json({ message: 'Logout exitoso' })
    response.cookies.delete('token')
    return response
  } catch (error) {
    console.error('Error en logout:', error)
    const response = NextResponse.json({ message: 'Logout exitoso' })
    response.cookies.delete('token')
    return response
  }
}

export async function me(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    return NextResponse.json(user)
  } catch (error) {
    console.error('Error verificando token:', error)
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const map: Record<string, string> = {}
  if (!cookieHeader) return map
  cookieHeader.split(';').forEach((part) => {
    const [k, v] = part.trim().split('=')
    if (k) map[k] = v ?? ''
  })
  return map
}

export async function refreshToken(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const cookies = parseCookies(cookieHeader)
    const refreshTokenCookie = cookies['refreshToken']
    if (!refreshTokenCookie) {
      return NextResponse.json({ error: 'Refresh token missing' }, { status: 401 })
    }

    const payload = jwt.verify(refreshTokenCookie, getRefreshJwtSecret()) as {
      userId: string
      email: string
      tenantId?: string
      tenantRole?: string
      refreshId?: number
    }
    const { userId, email } = payload

    const user = await prisma.user.findUnique({
      where: { userId },
      select: { userId: true, isActive: true, expiresAt: true },
    })

    if (!user || !user.isActive) {
      const res = NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 })
      res.cookies.set('refreshToken', '', { maxAge: 0, path: '/' })
      return res
    }

    if (user.expiresAt && new Date() > user.expiresAt) {
      await prisma.user.update({ where: { userId: user.userId }, data: { isActive: false } })
      const res = NextResponse.json({ error: 'Usuario expirado' }, { status: 403 })
      res.cookies.set('refreshToken', '', { maxAge: 0, path: '/' })
      return res
    }

    const activeSession = await prisma.userSession.findFirst({
      where: {
        userId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    })

    if (!activeSession) {
      const res = NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
      res.cookies.set('refreshToken', '', { maxAge: 0, path: '/' })
      return res
    }

    const requestedTenantId = payload.tenantId ?? null
    const tenantContext = await resolveTenantContext(userId, requestedTenantId)

    if (requestedTenantId && !tenantContext) {
      const res = NextResponse.json({ error: 'Tenant inválido' }, { status: 403 })
      res.cookies.set('refreshToken', '', { maxAge: 0, path: '/' })
      return res
    }

    const tokenPayload: Record<string, unknown> = { userId, email }
    if (tenantContext) {
      tokenPayload.tenantId = tenantContext.tenantId
      tokenPayload.tenantRole = tenantContext.tenantRole
    }

    const newToken = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '15m' })
    const newRefreshToken = jwt.sign(
      { ...tokenPayload, refreshId: Date.now() },
      getRefreshJwtSecret(),
      { expiresIn: '30d' },
    )

    await prisma.userSession.deleteMany({ where: { userId } })

    await prisma.userSession.create({
      data: {
        userId,
        token: newRefreshToken,
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    const res = NextResponse.json({ token: newToken })
    res.cookies.set('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })
    return res
  } catch (err) {
    console.error('Refresh token error:', err)
    const res = NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
    res.cookies.set('refreshToken', '', { maxAge: 0 })
    return res
  }
}

export async function register(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const path = '/api/auth/register'

    const csrf = validateCSRF(request.headers.get('x-request-id'))
    if (!csrf.valid) {
      return NextResponse.json({ error: csrf.error }, { status: 400 })
    }

    const rate = checkRateLimit(ip, path)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Intentalo de nuevo en unos segundos.' },
        { status: 429 },
      )
    }

    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })

    if (existingUser) {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

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
      message: 'Revisá tu correo para verificar la cuenta y continuar con el onboarding',
      success: true,
    })
    res.headers.set('X-RateLimit-Remaining', String(rate.remaining))
    return res
  } catch (error) {
    console.error('Error en registro:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function verifyEmail(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const path = '/api/auth/verify-email'

    const rate = checkRateLimit(ip, path)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Intentalo de nuevo en unos segundos.' },
        { status: 429 },
      )
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
      { userId: user.userId, email: user.email, purpose: 'onboarding' },
      '48h',
    )

    await prisma.user.update({
      where: { userId: user.userId },
      data: { emailVerifiedAt: new Date(), onboardingStatus: 'selecting_user_type' },
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

export async function onboardingMe(request: NextRequest) {
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

export async function resendVerification(request: NextRequest) {
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

export async function onboardingTenant(request: NextRequest) {
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
      create: { tenantId, userId: payload.userId, tenantRole: 'dependiente', isActive: false },
      update: { isActive: false, tenantRole: 'dependiente' },
    })

    await prisma.user.update({
      where: { userId: payload.userId },
      data: { onboardingStatus: 'awaiting_manager_approval' },
    })

    const managers = await prisma.tenantMembership.findMany({
      where: { tenantId, isActive: true, tenantRole: { in: ['manager', 'admin'] } },
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

export async function onboardingType(request: NextRequest) {
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
      data: { onboardingType: userType, onboardingStatus },
    })

    return NextResponse.json({ success: true, onboardingStatus })
  } catch (error) {
    console.error('Error actualizando tipo de onboarding:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
