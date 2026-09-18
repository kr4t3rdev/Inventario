import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { errorResponse } from '@/lib/api-response';
import { ActionError } from '@/lib/server-actions';
import { requireFeature } from '@/lib/services/tenant-scope';

/**
 * @description Preserves the existing facturacion entitlement for mobile HTTP routes.
 * @param {AuthenticatedUser} user - Authenticated API user.
 * @returns {Response | null} A 403 response when unavailable, otherwise null.
 */
export function authorizeInvoicingFeature(user: AuthenticatedUser): Response | null {
  try {
    requireFeature(user, 'facturacion', 'gestionar facturación');
    return null;
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, 403, error.code);
    }
    throw error;
  }
}
