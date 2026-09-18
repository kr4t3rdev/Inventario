import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prismaPlatform as prisma } from '@/lib/db/platform-prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getJwtSecret, getRefreshJwtSecret } from '@/lib/secrets'
import { sendEmailVerificationLink } from '@/lib/email'
import { normalizeUserRole } from '@/lib/auth/roles'
import { signOnboardingToken } from '@/lib/auth/onboarding'
import { resolveTenantContext } from '@/lib/auth-middleware'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * @description Genera una contraseña segura aleatoria
 * @param {number} length - Longitud de la contraseña
 * @returns {string} Contraseña generada
 */
function generateSecurePassword(length = 16): string {
  return crypto.randomBytes(length).toString('base64').slice(0, length)
}

/**
 * @description Callback de Google OAuth - intercambia code por tokens y autentica/crea usuario
 * @param {NextRequest} request - Request de Next.js
 * @returns {NextResponse} Redirección a auth-callback o error
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    // Si el usuario rechaza
    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/login?error=google_auth_failed`
      )
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/login?error=missing_code`
      )
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    // Intercambiamos el code por tokens
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Obtenemos info del usuario
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2',
    })

    const userInfo = await oauth2.userinfo.get()
    const { email, name } = userInfo.data

    if (!email) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/login?error=no_email`
      )
    }

     // Buscamos el usuario en BD
     let user = await prisma.user.findUnique({
       where: { email },
       select: {
         userId: true,
         email: true,
         name: true,
         googleId: true,
         isActive: true,
         expiresAt: true,
         onboardingStatus: true,
         role: true,
       },
     })

     let isNewUser = false

     // Si NO existe, lo creamos
     if (!user) {
       isNewUser = true
       const generatedPassword = generateSecurePassword()
       const hashedPassword = await bcrypt.hash(generatedPassword, 12)

       user = await prisma.user.create({
         data: {
           email,
           name: name || email.split('@')[0],
           password: hashedPassword,
           googleId: userInfo.data.id,
           role: normalizeUserRole('user')!,
           isActive: false,
           onboardingStatus: 'pending_email_verification',
           emailVerifiedAt: null,
         },
       })

       // Generamos el token de verificación de email
       const verificationToken = signOnboardingToken(
         {
           userId: user.userId,
           email: user.email,
           purpose: 'email-verification',
         },
         '24h'
       )

       const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
       const verificationUrl = `${appUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`

       // Mandamos email de verificación
       await sendEmailVerificationLink(email, verificationUrl, user.name)

       // TODO: Enviar email separado con la contraseña auto-generada
       // Por ahora, la contraseña se guarda pero no se comunica al usuario
       // Implementar un email service para enviar las credenciales
     } else {
       // Usuario ya existe, solo actualizamos googleId si no lo tiene
       if (!user.googleId) {
         await prisma.user.update({
           where: { userId: user.userId },
           data: { googleId: userInfo.data.id },
         })
       }
     }

     // Resolvemos el contexto del tenant (igual que en login normal)
     let tenantContext = null
     if (!isNewUser && user.role !== 'admin') {
       console.log('[Google OAuth] Resolviendo contexto de tenant para usuario:', user.userId)
       tenantContext = await resolveTenantContext(user.userId, null)
       console.log('[Google OAuth] Contexto de tenant resuelto:', tenantContext)
     } else if (user.role === 'admin') {
       console.log('[Google OAuth] Usuario es admin, no requiere tenant')
     }

     // Generamos tokens JWT (igual que en login normal)
     const tokenPayload: Record<string, unknown> = {
       userId: user.userId,
       email: user.email,
     }

     // Si el usuario tiene contexto de tenant, lo incluimos
     if (tenantContext?.tenantId) {
       tokenPayload.tenantId = tenantContext.tenantId
       console.log('[Google OAuth] tenantId agregado al token:', tenantContext.tenantId)
     } else {
       console.log('[Google OAuth] ⚠️ Sin tenantContext o tenantId faltante')
     }

     // Si el usuario está en proceso de onboarding, incluimos el status
     if (user.onboardingStatus && ['pending_email_verification', 'selecting_user_type', 'selecting_tenant', 'awaiting_manager_approval', 'awaiting_global_approval'].includes(user.onboardingStatus)) {
       tokenPayload.onboardingStatus = user.onboardingStatus
     }

    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '30d' })
    const refreshToken = jwt.sign(
      { ...tokenPayload, refreshId: Date.now() },
      getRefreshJwtSecret(),
      { expiresIn: '30d' }
    )

    // Guardamos la sesión
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

    // Log de actividad
    const ipAddress = request.headers.get('x-forwarded-for') || null
    const userAgent = request.headers.get('user-agent') || null
    await prisma.userActivityLog.create({
      data: {
        userId: user.userId,
        action: isNewUser ? 'google_register' : 'google_login',
        details: JSON.stringify({ 
          timestamp: new Date().toISOString(),
          googleId: userInfo.data.id 
        }),
        ipAddress,
        userAgent,
        performedBy: user.userId,
      },
    })

    // Redirigimos con los tokens en query params (frontend los toma)
    const redirectUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}/auth-callback`)
    redirectUrl.searchParams.set('token', token)
    redirectUrl.searchParams.set('refreshToken', refreshToken)
    redirectUrl.searchParams.set('isNewUser', isNewUser.toString())

    const response = NextResponse.redirect(redirectUrl)
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })

    return response
   } catch (error) {
     console.error('===== ERROR EN GOOGLE CALLBACK =====')
     console.error('Error object:', error)
     if (error instanceof Error) {
       console.error('Error message:', error.message)
       console.error('Error stack:', error.stack)
     }
     console.error('=====================================')
     return NextResponse.redirect(
       `${process.env.NEXT_PUBLIC_APP_URL}/login?error=callback_error`
     )
   }
}
