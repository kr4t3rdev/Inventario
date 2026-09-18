import { authenticateUser } from '@/lib/auth-middleware';
import { AuthService } from '@/features/auth/services/auth-service';
import { errorResponse, successResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * @description Mobile current-user endpoint based on bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} User context response.
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  try {
    const result = await AuthService.me(authResult.user);
    return successResponse(result.user);
  } catch (error) {
    console.error('Error en mobile me route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
