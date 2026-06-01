import { loginAction } from '@/features/auth/actions';

export const dynamic = 'force-dynamic';

/**
 * @description Route Handler wrapper para /api/auth/login.
 * Delega a loginAction Server Action manteniendo compatibilidad
 * con clients que usan fetch legacy.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await loginAction(body);

    if (result.success) {
      return Response.json(result.data);
    }

    const statusMap: Record<string, number> = {
      INVALID_CREDENTIALS: 401,
      USER_INACTIVE: 403,
      LICENSE_EXPIRED: 403,
      ACCOUNT_LOCKED: 403,
      NO_TENANT: 403,
    };

    const status = statusMap[result.error?.code ?? ''] ?? 401;
    return Response.json({ error: result.error?.message }, { status });
  } catch (error) {
    console.error('Error en login route:', error);
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
