import { NextResponse } from 'next/server';
import { AuthService } from '@/features/auth/services/auth-service';
import { authenticateUser } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

function buildLogoutResponse(): NextResponse {
  const response = NextResponse.json({ message: 'Logout exitoso' });
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set('refreshToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

/**
 * @description Route Handler estable para /api/auth/logout.
 * Cierra sesión sin depender de Server Action IDs y siempre limpia cookies del cliente.
 */
export async function POST(request: Request) {
  try {
    const authResult = await authenticateUser(request as never);

    if (!('status' in authResult)) {
      await AuthService.logout(authResult.user);
    }
  } catch (error) {
    console.error('Error en logout route:', error);
  }

  return buildLogoutResponse();
}
