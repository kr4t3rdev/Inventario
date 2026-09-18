import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { requireFeature } from '@/lib/services/tenant-scope';

export const dynamic = 'force-dynamic';

/**
 * @description Maps a PuntoDeVenta row to the mobile POS point contract.
 * @param {Record<string, any>} pv - Raw POS point row.
 * @returns {Record<string, unknown>} Mobile-shaped point of sale payload.
 */
export function mapPuntoVenta(pv: any) {
  return {
    pvId: pv.pvId,
    nombre: pv.nombre,
    ubicacion: pv.ubicacion ?? null,
    tipoCaja: pv.tipoCaja,
    listaPrecio: pv.listaPrecio ? { nombre: pv.listaPrecio.nombre } : undefined,
  };
}

/**
 * @description Mobile points-of-sale list endpoint.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Mapped list of POS points.
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
    requireFeature(authResult.user, 'puntos-venta', 'gestionar puntos de venta');
    const puntos = await prisma.puntoDeVenta.findMany({
      where: { tenantId },
      include: { listaPrecio: { select: { nombre: true } } },
      orderBy: { nombre: 'asc' },
    });
    return successResponse({ items: puntos.map(mapPuntoVenta) });
  } catch (error) {
    console.error('Error en mobile puntos-venta route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}