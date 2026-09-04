import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { mapServicio } from '../route';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const SELECT = {
  servicioId: true,
  nombre: true,
  descripcion: true,
  precio: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile service detail endpoint (tenant-scoped).
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with service id.
 * @returns {Promise<Response>} Mapped service payload.
 */
export async function GET(request: Request, context: RouteContext) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const { id } = await context.params;
    const servicio = await prisma.servicios.findFirst({
      where: { servicioId: id, tenantId },
      select: SELECT,
    });
    if (!servicio) {
      return errorResponse('Servicio no encontrado', 404, 'NOT_FOUND');
    }
    return successResponse(mapServicio(servicio as any));
  } catch (error) {
    console.error('Error en mobile service detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Deletes a service unless it has active references.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with service id.
 * @returns {Promise<Response>} Deletion confirmation or conflict.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const { id } = await context.params;
    const existing = await prisma.servicios.findFirst({
      where: { servicioId: id, tenantId },
      select: { servicioId: true },
    });
    if (!existing) {
      return errorResponse('Servicio no encontrado', 404, 'NOT_FOUND');
    }

    const [ventas, compras, ofertas] = await Promise.all([
      prisma.ventaServicios.count({ where: { servicioId: id } }),
      prisma.compraServicio.count({ where: { servicioId: id } }),
      prisma.ofertaItem.count({ where: { servicioId: id } }),
    ]);
    if (ventas > 0 || compras > 0 || ofertas > 0) {
      return errorResponse(
        `No se puede eliminar el servicio: tiene ${ventas} venta(s), ${compras} compra(s), ${ofertas} oferta(s) asociadas`,
        409,
        'HAS_REFERENCES',
      );
    }

    await prisma.servicios.delete({ where: { servicioId: id } });
    return successResponse({ success: true, servicioId: id });
  } catch (error) {
    console.error('Error eliminando servicio (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}