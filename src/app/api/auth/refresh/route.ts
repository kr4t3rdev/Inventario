import { refreshSessionAction } from '@/features/auth/actions';

export const dynamic = 'force-dynamic';

/**
 * @description Route Handler wrapper para /api/auth/refresh.
 * Delega a refreshSessionAction Server Action.
 */
export async function POST() {
  try {
    const result = await refreshSessionAction(undefined);

    return Response.json({
      success: true,
      token: result.token,
      refreshToken: result.refreshToken,
    });
  } catch (error: any) {
    console.error('Error en refresh route:', error);
    const code = error?.code as string | undefined;
    const status = code === 'USER_INACTIVE' ? 403 : 401;
    return Response.json(
      { error: error?.message ?? 'Sesión expirada' },
      { status },
    );
  }
}
