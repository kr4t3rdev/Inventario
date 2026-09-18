import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { mapContrato } from '../route';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const SELECT = {
  contratoId: true,
  clienteId: true,
  numeroContrato: true,
  observaciones: true,
  monto: true,
  estado: true,
  fechaInicio: true,
  fechaFin: true,
  createdAt: true,
  updatedAt: true,
  cliente: { select: { nombre: true } },
} as const;

/**
 * @description Mobile contract detail endpoint (tenant-scoped).
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with contract id.
 * @returns {Promise<Response>} Mapped contract payload.
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
    const contrato = await prisma.contrato.findFirst({
      where: { contratoId: id, tenantId },
      select: SELECT,
    });
    if (!contrato) {
      return errorResponse('Contrato no encontrado', 404, 'NOT_FOUND');
    }
    return successResponse(mapContrato(contrato as any));
  } catch (error) {
    console.error('Error en mobile contract detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Deletes a contract scoped to the caller's tenant.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with contract id.
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
    const existing = await prisma.contrato.findFirst({
      where: { contratoId: id, tenantId },
      select: { contratoId: true },
    });
    if (!existing) {
      return errorResponse('Contrato no encontrado', 404, 'NOT_FOUND');
    }
    await prisma.contrato.delete({ where: { contratoId: id } });
    return successResponse({ success: true, contratoId: id });
  } catch (error) {
    console.error('Error eliminando contrato (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}