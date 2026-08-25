import { ZodError } from 'zod';
import { ActionError } from '@/lib/server-actions';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { almacenUpdateSchema } from '@/features/almacenes/schemas';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ALMACEN_SELECT = {
  almacenId: true,
  nombre: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile warehouse detail endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with warehouse id.
 * @returns {Promise<Response>} Warehouse detail response.
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
    const almacen = await prisma.almacen.findFirst({
      where: { almacenId: id, tenantId },
      select: ALMACEN_SELECT,
    });

    if (!almacen) {
      throw new ActionError('Almacen no encontrado', 'NOT_FOUND');
    }

    return successResponse(almacen);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, error.code === 'NOT_FOUND' ? 404 : 400, error.code);
    }
    console.error('Error en mobile warehouse detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Mobile warehouse update endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request with update data.
 * @param {RouteContext} context - Route params with warehouse id.
 * @returns {Promise<Response>} Updated warehouse response.
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
    const body = await request.json();
    const parsed = almacenUpdateSchema.parse({ ...body, almacenId: id });

    const existing = await prisma.almacen.findFirst({
      where: { almacenId: id, tenantId },
    });

    if (!existing) {
      throw new ActionError('Almacen no encontrado', 'NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.nombre !== undefined) updateData.nombre = parsed.nombre;

    const almacen = await prisma.almacen.update({
      where: { almacenId: id },
      data: updateData,
      select: ALMACEN_SELECT,
    });

    return successResponse(almacen);
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse('Datos invalidos', 400, 'VALIDATION_ERROR', error.flatten().fieldErrors);
    }
    if (error instanceof ActionError) {
      return errorResponse(error.message, error.code === 'NOT_FOUND' ? 404 : 400, error.code);
    }
    console.error('Error en mobile warehouse update route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Mobile warehouse delete endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with warehouse id.
 * @returns {Promise<Response>} Deletion confirmation response.
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

    const existing = await prisma.almacen.findFirst({
      where: { almacenId: id, tenantId },
    });

    if (!existing) {
      throw new ActionError('Almacen no encontrado', 'NOT_FOUND');
    }

    await prisma.almacen.delete({ where: { almacenId: id } });

    return successResponse({ id, eliminado: true });
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, error.code === 'NOT_FOUND' ? 404 : 400, error.code);
    }
    console.error('Error en mobile warehouse delete route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
