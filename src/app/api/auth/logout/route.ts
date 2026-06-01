import { logoutAction } from '@/features/auth/actions';
import { getCurrentUser } from '@/lib/server-actions';

export const dynamic = 'force-dynamic';

/**
 * @description Route Handler wrapper para /api/auth/logout.
 * Delega a logoutAction Server Action manteniendo compatibilidad.
 */
export async function POST() {
  try {
    const result = await logoutAction(undefined);

    if (result.success) {
      return Response.json({ message: 'Logout exitoso' });
    }

    // Si falla por no autenticado, igual devolvemos éxito
    // (el cliente ya no tiene sesión)
    return Response.json({ message: 'Logout exitoso' });
  } catch (error) {
    console.error('Error en logout route:', error);
    return Response.json({ message: 'Logout exitoso' });
  }
}
