import { authenticateUser } from '@/lib/auth-middleware';
import { AuthService } from '@/features/auth/services/auth-service';
import { errorResponse, successResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * @description Mobile logout endpoint that deactivates the authenticated session.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Logout result.
 */
export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    await AuthService.logout(authResult.user);
    return successResponse({ success: true, message: 'Logout exitoso' });
  } catch (error) {
    console.error('Error en mobile logout route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
