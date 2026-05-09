import { cookies } from 'next/headers'
import { ServerActionError } from '@/lib/api/errors'

/**
 * @description Verifica que el usuario esté autenticado revisando la cookie refreshToken.
 * Las Server Actions se ejecutan en servidor y tienen acceso a cookies vía next/headers.
 * @throws {ServerActionError} con status 401 si no hay sesión activa
 */
export async function checkAuth(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get('refreshToken')

  if (!token?.value) {
    throw new ServerActionError(
      'checkAuth',
      'UNKNOWN',
      401,
      'No autenticado'
    )
  }
}
