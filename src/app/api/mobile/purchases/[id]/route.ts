import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { mapCompra } from '../route';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const SELECT = {
  compraProductoId: true,
  proveedorId: true,
  productoId: true,
  cantidad: true,
  precioUnitario: true,
  total: true,
  descripcion: true,
  estado: true,
  createdAt: true,
  updatedAt: true,
  proveedor: { select: { nombre: true } },
  producto: { select: { nombre: true, codigoInterno: true } },
} as const;

/**
 * @description Mobile purchase detail endpoint (tenant-scoped).
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with purchase id.
 * @returns {Promise<Response>} Mapped purchase payload.
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
    const compra = await prisma.compraProducto.findFirst({
      where: { compraProductoId: id, tenantId, deletedAt: null },
      select: SELECT,
    });
    if (!compra) {
      return errorResponse('Compra no encontrada', 404, 'NOT_FOUND');
    }
    return successResponse(mapCompra(compra as any));
  } catch (error) {
    console.error('Error en mobile purchase detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Soft-deletes a purchase scoped to the caller's tenant.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with purchase id.
 * @returns {Promise<Response>} Deletion confirmation.
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
    const existing = await prisma.compraProducto.findFirst({
      where: { compraProductoId: id, tenantId, deletedAt: null },
      select: { compraProductoId: true },
    });
    if (!existing) {
      return errorResponse('Compra no encontrada', 404, 'NOT_FOUND');
    }

    await prisma.compraProducto.update({
      where: { compraProductoId: id },
      data: { deletedAt: new Date() },
    });
    return successResponse({ success: true, compraId: id });
  } catch (error) {
    console.error('Error eliminando compra (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}