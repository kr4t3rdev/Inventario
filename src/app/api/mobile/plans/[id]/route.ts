import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { mapPlan } from '../route';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Mobile plan detail endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with plan id.
 * @returns {Promise<Response>} Mapped plan payload.
 */
export async function GET(request: Request, context: RouteContext) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  if (!authResult.user.tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const { id } = await context.params;
    const plan = await prisma.plan.findUnique({ where: { planId: id } });
    if (!plan) {
      return errorResponse('Plan no encontrado', 404, 'NOT_FOUND');
    }
    return successResponse(mapPlan(plan as never));
  } catch (error) {
    console.error('Error en mobile plan detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Updates a plan. Admin only.
 * @param {Request} request - Incoming authenticated request with partial plan payload.
 * @param {RouteContext} context - Route params with plan id.
 * @returns {Promise<Response>} Updated mapped plan.
 */
export async function PUT(request: Request, context: RouteContext) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  if (authResult.user.role !== 'admin') {
    return errorResponse('Acceso restringido', 403, 'FORBIDDEN');
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      nombre?: string;
      descripcion?: string;
      precio?: number;
      usuariosMax?: number;
      almacenMax?: number;
      productosMax?: number;
      features?: string[];
      estado?: string;
    };

    const data: Record<string, unknown> = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.descripcion !== undefined) data.descripcion = body.descripcion;
    if (body.precio !== undefined) data.precio = body.precio;
    if (body.usuariosMax !== undefined) data.maxUsuarios = body.usuariosMax;
    if (body.almacenMax !== undefined) data.maxAlmacenes = body.almacenMax;
    if (body.productosMax !== undefined) data.maxProductos = body.productosMax;
    if (body.features !== undefined) {
      data.features = Object.fromEntries(body.features.map((key) => [key, true]));
    }
    void body.estado;

    const updated = (await prisma.plan.update({
      where: { planId: id },
      data,
    })) as never;
    return successResponse(mapPlan(updated));
  } catch (error) {
    console.error('Error actualizando plan (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Deletes a plan. Admin only.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with plan id.
 * @returns {Promise<Response>} Deletion confirmation.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  if (authResult.user.role !== 'admin') {
    return errorResponse('Acceso restringido', 403, 'FORBIDDEN');
  }

  try {
    const { id } = await context.params;
    await prisma.plan.delete({ where: { planId: id } });
    return successResponse({ success: true, planId: id });
  } catch (error) {
    console.error('Error eliminando plan (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
