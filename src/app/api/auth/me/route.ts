import { AuthService } from '@/features/auth/services/auth-service';
import { authenticateUser } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

/**
 * @description Route Handler estable para /api/auth/me.
 * Resuelve auth por request y evita depender de Server Action IDs regenerados.
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const result = await AuthService.me(authResult.user);
    return Response.json(result.user);
  } catch (error) {
    console.error('Error en me route:', error);
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
