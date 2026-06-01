import { refreshSessionAction } from '@/features/auth/actions';

export const dynamic = 'force-dynamic';

/**
 * @description Route Handler wrapper para /api/auth/refresh.
 * Delega a refreshSessionAction Server Action.
 */
export async function POST() {
  try {
    const result = await refreshSessionAction(undefined);

    if (result.success) {
      return Response.json({ success: true });
    }

    const statusMap: Record<string, number> = {
      SESSION_EXPIRED: 401,
      USER_INACTIVE: 403,
    };

    const status = statusMap[result.error?.code ?? ''] ?? 401;
    return Response.json({ error: result.error?.message }, { status });
  } catch (error) {
    console.error('Error en refresh route:', error);
    return Response.json({ error: 'Sesión expirada' }, { status: 401 });
  }
}
