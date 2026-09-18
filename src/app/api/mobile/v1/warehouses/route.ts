import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ALMACEN_SELECT = {
  almacenId: true,
  nombre: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile warehouse list endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Warehouse list response.
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
    const items = await prisma.almacen.findMany({
      where: { tenantId },
      select: ALMACEN_SELECT,
      orderBy: { nombre: 'asc' },
    });

    return successResponse({ items });
  } catch (error) {
    console.error('Error en mobile warehouses route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
