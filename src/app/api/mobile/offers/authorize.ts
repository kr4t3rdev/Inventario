import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { errorResponse } from '@/lib/api-response';
import { ActionError } from '@/lib/server-actions';
import { requireFeature } from '@/lib/services/tenant-scope';

/**
 * @description Preserves the existing ofertas plan entitlement for mobile HTTP routes.
 * @param {AuthenticatedUser} user - Authenticated API user.
 * @returns {Response | null} A 403 response when unavailable, otherwise null.
 */
export function authorizeOffersFeature(user: AuthenticatedUser): Response | null {
  try {
    requireFeature(user, 'ofertas', 'gestionar ofertas');
    return null;
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, 403, error.code);
    }
    throw error;
  }
}
