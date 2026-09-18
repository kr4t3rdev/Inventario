import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { mapConcepto } from '../route';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Mobile expense concept detail endpoint.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with concept id.
 * @returns {Promise<Response>} Mapped concept payload.
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
    const concepto = (await prisma.gastoConcepto.findUnique({ where: { conceptoId: id } })) as unknown as Parameters<typeof mapConcepto>[0] | null;
    if (!concepto || concepto.tenantId !== tenantId) {
      return errorResponse('Concepto no encontrado', 404, 'NOT_FOUND');
    }
    return successResponse(mapConcepto(concepto));
  } catch (error) {
    console.error('Error en mobile expense-concept detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Updates an expense concept; estado maps to isActive.
 * @param {Request} request - Incoming authenticated request with {nombre?,estado?,descripcion?}.
 * @param {RouteContext} context - Route params with concept id.
 * @returns {Promise<Response>} Updated mapped concept.
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
    const existing = await prisma.gastoConcepto.findUnique({ where: { conceptoId: id }, select: { tenantId: true } });
    if (!existing || existing.tenantId !== tenantId) {
      return errorResponse('Concepto no encontrado', 404, 'NOT_FOUND');
    }

    const body = (await request.json()) as { nombre?: string; descripcion?: string; estado?: string };
    const data: Record<string, unknown> = {};
    if (body.nombre !== undefined) data.nombre = body.nombre.trim();
    if (body.descripcion !== undefined) data.descripcion = body.descripcion;
    if (body.estado !== undefined) data.isActive = body.estado === 'ACTIVO';

    const updated = (await prisma.gastoConcepto.update({
      where: { conceptoId: id },
      data,
    })) as unknown as Parameters<typeof mapConcepto>[0];
    return successResponse(mapConcepto(updated));
  } catch (error) {
    console.error('Error actualizando concepto (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Deletes a concept; soft-deletes when expenses reference it.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with concept id.
 * @returns {Promise<Response>} Deletion confirmation with modo soft/hard.
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
    const existing = await prisma.gastoConcepto.findUnique({ where: { conceptoId: id }, select: { tenantId: true } });
    if (!existing || existing.tenantId !== tenantId) {
      return errorResponse('Concepto no encontrado', 404, 'NOT_FOUND');
    }

    const gastosCount = await prisma.gastosDE.count({ where: { conceptoId: id } });
    if (gastosCount > 0) {
      await prisma.gastoConcepto.update({ where: { conceptoId: id }, data: { isActive: false } });
      return successResponse({ success: true, conceptoId: id, modo: 'desactivado' });
    }
    await prisma.gastoConcepto.delete({ where: { conceptoId: id } });
    return successResponse({ success: true, conceptoId: id, modo: 'eliminado' });
  } catch (error) {
    console.error('Error eliminando concepto (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
