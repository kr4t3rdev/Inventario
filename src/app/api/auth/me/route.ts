import { meAction } from '@/features/auth/actions';

export const dynamic = 'force-dynamic';

/**
 * @description Route Handler wrapper para /api/auth/me.
 * Delega a meAction Server Action.
 */
export async function GET() {
  try {
    const result = await meAction(undefined);

    if (result.success) {
      return Response.json(result.data?.user ?? result.data);
    }

    const statusMap: Record<string, number> = {
      AUTH_REQUIRED: 401,
      NOT_FOUND: 404,
    };

    const status = statusMap[result.error?.code ?? ''] ?? 401;
    return Response.json({ error: result.error?.message }, { status });
  } catch (error) {
    console.error('Error en me route:', error);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
