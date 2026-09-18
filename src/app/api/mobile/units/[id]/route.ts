import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { mapUnidad } from '../route';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UNIDAD_SELECT = {
  unidadId: true,
  nombre: true,
  simbolo: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile unit detail endpoint (tenant-scoped).
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with unit id.
 * @returns {Promise<Response>} Mapped unit payload.
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
    const unidad = await prisma.unidad.findFirst({
      where: { unidadId: id, tenantId },
      select: UNIDAD_SELECT,
    });
    if (!unidad) {
      return errorResponse('Unidad no encontrada', 404, 'NOT_FOUND');
    }
    return successResponse(mapUnidad(unidad as unknown as Parameters<typeof mapUnidad>[0]));
  } catch (error) {
    console.error('Error en mobile unit detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Updates a unit scoped to the caller's tenant.
 * @param {Request} request - Incoming authenticated request with { nombre?, abreviatura? }.
 * @param {RouteContext} context - Route params with unit id.
 * @returns {Promise<Response>} Updated mapped unit.
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
    const body = (await request.json()) as { nombre?: unknown; abreviatura?: unknown };

    if (body.nombre !== undefined) {
      const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
      if (!nombre || nombre.length > 100) {
        return errorResponse('El nombre es requerido (máx. 100 caracteres)', 400, 'VALIDATION_ERROR');
      }
    }
    if (body.abreviatura !== undefined) {
      const simbolo = typeof body.abreviatura === 'string' ? body.abreviatura.trim() : '';
      if (!simbolo || simbolo.length > 20) {
        return errorResponse('La abreviatura es requerida (máx. 20 caracteres)', 400, 'VALIDATION_ERROR');
      }
    }

    const existing = await prisma.unidad.findFirst({
      where: { unidadId: id, tenantId },
      select: { unidadId: true },
    });
    if (!existing) {
      return errorResponse('Unidad no encontrada', 404, 'NOT_FOUND');
    }

    const data: { nombre?: string; simbolo?: string } = {};
    if (body.nombre !== undefined) data.nombre = (body.nombre as string).trim();
    if (body.abreviatura !== undefined) data.simbolo = (body.abreviatura as string).trim();

    const updated = (await prisma.unidad.update({
      where: { unidadId: id },
      data,
      select: UNIDAD_SELECT,
    })) as unknown as Parameters<typeof mapUnidad>[0];
    return successResponse(mapUnidad(updated));
  } catch (error) {
    const err = error as { code?: string; meta?: { target?: unknown } };
    if (err?.code === 'P2002') {
      return errorResponse('Ya existe una unidad con ese nombre o abreviatura', 409, 'CONFLICT');
    }
    console.error('Error actualizando unidad (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Deletes a unit unless it is still used by products.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with unit id.
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
    const existing = await prisma.unidad.findFirst({
      where: { unidadId: id, tenantId },
      select: { unidadId: true },
    });
    if (!existing) {
      return errorResponse('Unidad no encontrada', 404, 'NOT_FOUND');
    }

    const enUso = await prisma.producto.count({ where: { unidadId: id } });
    if (enUso > 0) {
      return errorResponse(`No se puede eliminar: está en uso por ${enUso} producto(s)`, 409, 'IN_USE');
    }

    await prisma.unidad.delete({ where: { unidadId: id } });
    return successResponse({ success: true, unitId: id });
  } catch (error) {
    console.error('Error eliminando unidad (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}