import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { mapGasto } from '../route';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Mobile expense detail endpoint.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with expense id.
 * @returns {Promise<Response>} Mapped expense payload.
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
    const gasto = (await prisma.gastosDE.findUnique({
      where: { gastosDEId: id },
      include: { concepto: true },
    })) as unknown as Parameters<typeof mapGasto>[0] | null;
    if (!gasto || gasto.tenantId !== tenantId) {
      return errorResponse('Gasto no encontrado', 404, 'NOT_FOUND');
    }
    return successResponse(mapGasto(gasto));
  } catch (error) {
    console.error('Error en mobile expense detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Deletes an expense scoped to the caller's tenant.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with expense id.
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
    const existing = await prisma.gastosDE.findUnique({ where: { gastosDEId: id }, select: { tenantId: true } });
    if (!existing || existing.tenantId !== tenantId) {
      return errorResponse('Gasto no encontrado', 404, 'NOT_FOUND');
    }
    await prisma.gastosDE.delete({ where: { gastosDEId: id } });
    return successResponse({ success: true, gastoId: id });
  } catch (error) {
    console.error('Error eliminando gasto (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
