import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const VENDOR_SELECT = {
  vendorId: true,
  nombre: true,
  contacto: true,
  direccion: true,
  telefono: true,
  cuentaCUP: true,
  cuentaUSD: true,
  logo: true,
  contrato: true,
  vendorCode: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile provider list endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Provider list response.
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
    const items = await prisma.vendor.findMany({
      where: { tenantId },
      select: VENDOR_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return successResponse({ items });
  } catch (error) {
    console.error('Error en mobile providers route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
