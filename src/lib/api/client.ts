import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { getRefreshJwtSecret } from '@/lib/secrets'
import { ServerActionError } from './errors'

export interface AuthenticatedContext {
  userId: string
  tenantId?: string
  tenantRole?: string
}

/**
 * @description Obtiene el contexto del usuario autenticado desde la cookie refreshToken.
 * Las Server Actions se ejecutan en servidor y leen la cookie httpOnly que se setea en login.
 * @returns {Promise<AuthenticatedContext>} Contexto con userId del usuario autenticado
 * @throws {ServerActionError} con status 401 si no hay sesión o el token es inválido
 */
export async function getAuthenticatedContext(): Promise<AuthenticatedContext> {
  const cookieStore = await cookies()
  const token = cookieStore.get('refreshToken')

  if (!token?.value) {
    throw new ServerActionError(
      'getAuthenticatedContext',
      'UNKNOWN',
      401,
      'No autenticado'
    )
  }

  try {
    interface RefreshTokenPayload {
      userId: string
      email?: string
      tenantId?: string
      tenantRole?: string
    }

    const decoded = jwt.verify(
      token.value,
      getRefreshJwtSecret()
    ) as RefreshTokenPayload

    return {
      userId: decoded.userId,
      ...(decoded.tenantId && { tenantId: decoded.tenantId }),
      ...(decoded.tenantRole && { tenantRole: decoded.tenantRole }),
    }
  } catch {
    throw new ServerActionError(
      'getAuthenticatedContext',
      'UNKNOWN',
      401,
      'Sesión inválida'
    )
  }
}
