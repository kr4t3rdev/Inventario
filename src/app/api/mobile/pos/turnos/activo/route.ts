import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { requireFeature } from '@/lib/services/tenant-scope';
import { mapTurno, TURNOS_INCLUDE } from '../route';

export const dynamic = 'force-dynamic';

/**
 * @description Mobile active-shift endpoint. Mirrors getTurnoActivoAction.
 * @param {Request} request - Incoming authenticated request with ?puntoDeVentaId=.
 * @returns {Promise<Response>} Active turno or null payload.
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
    requireFeature(authResult.user, 'turnos-pos', 'gestionar turnos POS');
    const puntoDeVentaId = new URL(request.url).searchParams.get('puntoDeVentaId');
    if (!puntoDeVentaId) {
      return errorResponse('El punto de venta es requerido', 400, 'VALIDATION_ERROR');
    }

    const turno = await prisma.turnoPuntoVenta.findFirst({
      where: { puntoDeVentaId, tenantId, estado: 'ABIERTO' },
      include: TURNOS_INCLUDE,
    });

    return successResponse({ turno: turno ? mapTurno(turno) : null });
  } catch (error) {
    console.error('Error al consultar turno activo (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}