import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * @description Mobile referral stats: totals for the tenant's affiliate referrals.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} { total, activos, recompensas }
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const [total, activos, recompensas] = await Promise.all([
      prisma.affiliateReferral.count({ where: { referrerTenantId: tenantId } }),
      prisma.affiliateReferral.count({ where: { referrerTenantId: tenantId, status: { in: ['confirmed', 'credited'] } } }),
      prisma.affiliateReferral.count({ where: { referrerTenantId: tenantId, status: 'credited' } }),
    ]);
    return successResponse({ total, activos, recompensas });
  } catch (error) {
    console.error('Error en mobile referral stats route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
