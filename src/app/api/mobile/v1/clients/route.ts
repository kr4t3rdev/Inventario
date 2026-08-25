import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const CLIENTE_SELECT = {
  clienteId: true,
  nombre: true,
  direccion: true,
  telefono: true,
  logoUrl: true,
  numeroCuentaCUP: true,
  numeroCuentaUSD: true,
  numeroContrato: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile client list endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Client list response.
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
    const items = await prisma.cliente.findMany({
      where: { tenantId },
      select: CLIENTE_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return successResponse({ items });
  } catch (error) {
    console.error('Error en mobile clients route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
