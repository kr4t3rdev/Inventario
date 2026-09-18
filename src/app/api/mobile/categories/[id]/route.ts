import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { mapCategoria } from '../route';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const CATEGORIA_SELECT = {
  catId: true,
  nombre: true,
  descripcion: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile category detail endpoint (tenant-scoped).
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with category id.
 * @returns {Promise<Response>} Mapped category payload.
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
    const categoria = await prisma.categoria.findFirst({
      where: { catId: id, tenantId },
      select: CATEGORIA_SELECT,
    });
    if (!categoria) {
      return errorResponse('Categoría no encontrada', 404, 'NOT_FOUND');
    }
    return successResponse(mapCategoria(categoria as unknown as Parameters<typeof mapCategoria>[0]));
  } catch (error) {
    console.error('Error en mobile category detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Updates a category scoped to the caller's tenant.
 * @param {Request} request - Incoming authenticated request with { nombre?, descripcion? }.
 * @param {RouteContext} context - Route params with category id.
 * @returns {Promise<Response>} Updated mapped category.
 */
export async function PUT(request: Request, context: RouteContext) {
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
    const body = (await request.json()) as { nombre?: unknown; descripcion?: unknown };

    if (body.nombre !== undefined) {
      const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
      if (!nombre || nombre.length > 100) {
        return errorResponse('El nombre es requerido (máx. 100 caracteres)', 400, 'VALIDATION_ERROR');
      }
    }

    const existing = await prisma.categoria.findFirst({
      where: { catId: id, tenantId },
      select: { catId: true },
    });
    if (!existing) {
      return errorResponse('Categoría no encontrada', 404, 'NOT_FOUND');
    }

    const data: { nombre?: string; descripcion?: string | null } = {};
    if (typeof body.nombre === 'string') data.nombre = body.nombre.trim();
    if (body.descripcion !== undefined) {
      data.descripcion =
        typeof body.descripcion === 'string' && body.descripcion.trim() ? body.descripcion.trim() : null;
    }

    const updated = (await prisma.categoria.update({
      where: { catId: id },
      data,
      select: CATEGORIA_SELECT,
    })) as unknown as Parameters<typeof mapCategoria>[0];
    return successResponse(mapCategoria(updated));
  } catch (error) {
    console.error('Error actualizando categoría (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Deletes a category scoped to the caller's tenant.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with category id.
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
    const existing = await prisma.categoria.findFirst({
      where: { catId: id, tenantId },
      select: { catId: true },
    });
    if (!existing) {
      return errorResponse('Categoría no encontrada', 404, 'NOT_FOUND');
    }
    await prisma.categoria.delete({ where: { catId: id } });
    return successResponse({ success: true, categoryId: id });
  } catch (error) {
    console.error('Error eliminando categoría (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}