import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface ReferralRecord {
  referralId: string;
  referrerTenantId: string;
  referredTenantId: string;
  status: string;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @description Maps an AffiliateReferral row to the mobile Referido contract.
 * @param {ReferralRecord} referral - Raw affiliate referral row.
 * @returns {Record<string, unknown>} Mobile-shaped referral payload.
 */
export function mapReferral(referral: ReferralRecord) {
  return {
    referidoId: referral.referralId,
    referidoPor: referral.referrerTenantId,
    clienteId: referral.referredTenantId,
    estado: referral.status === 'registered' ? ('PENDIENTE' as const)
      : referral.status === 'confirmed' ? ('ACTIVO' as const)
      : ('COMPLETADO' as const),
    fechaRegistro: referral.createdAt.toISOString(),
    fechaActivacion: referral.confirmedAt ? referral.confirmedAt.toISOString() : undefined,
    createdAt: referral.createdAt.toISOString(),
    updatedAt: referral.updatedAt.toISOString(),
  };
}

/**
 * @description Mobile referrals list endpoint (affiliate referrals of the tenant).
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Mapped referral list response.
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
    const rows = await prisma.affiliateReferral.findMany({
      where: { referrerTenantId: tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse({ items: rows.map(mapReferral) });
  } catch (error) {
    console.error('Error en mobile referrals route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Client-referral registration is not backed by any model yet.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} 501 Not Implemented.
 */
export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  void request;
  return errorResponse('Registro de referidos de clientes no disponible', 501, 'NOT_IMPLEMENTED');
}
