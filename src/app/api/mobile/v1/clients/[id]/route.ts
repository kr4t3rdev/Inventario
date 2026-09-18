import { ZodError } from 'zod';
import { ActionError } from '@/lib/server-actions';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { clienteUpdateSchema } from '@/features/clientes/schemas';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const CLIENTE_SELECT = {
  clienteId: true,
  nombre: true,
  direccion: true,
  telefono: true,
  logoUrl: true,
  numeroCuentaCUP: true,
  numeroCuentaUSD: true,
  numeroContrato: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile client detail endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with client id.
 * @returns {Promise<Response>} Client detail response.
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
    const cliente = await prisma.cliente.findFirst({
      where: { clienteId: id, tenantId },
      select: CLIENTE_SELECT,
    });

    if (!cliente) {
      throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
    }

    return successResponse(cliente);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, error.code === 'NOT_FOUND' ? 404 : 400, error.code);
    }
    console.error('Error en mobile client detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Mobile client update endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request with update data.
 * @param {RouteContext} context - Route params with client id.
 * @returns {Promise<Response>} Updated client response.
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
    const parsed = clienteUpdateSchema.parse({ ...body, clienteId: id });

    const existing = await prisma.cliente.findFirst({
      where: { clienteId: id, tenantId },
    });

    if (!existing) {
      throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.nombre !== undefined) updateData.nombre = parsed.nombre;
    if (parsed.direccion !== undefined) updateData.direccion = parsed.direccion;
    if (parsed.telefono !== undefined) updateData.telefono = parsed.telefono;
    if (parsed.logoUrl !== undefined) updateData.logoUrl = parsed.logoUrl;
    if (parsed.numeroCuentaCUP !== undefined) updateData.numeroCuentaCUP = parsed.numeroCuentaCUP;
    if (parsed.numeroCuentaUSD !== undefined) updateData.numeroCuentaUSD = parsed.numeroCuentaUSD;
    if (parsed.numeroContrato !== undefined) updateData.numeroContrato = parsed.numeroContrato;

    const cliente = await prisma.cliente.update({
      where: { clienteId: id },
      data: updateData,
      select: CLIENTE_SELECT,
    });

    return successResponse(cliente);
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse('Datos invalidos', 400, 'VALIDATION_ERROR', error.flatten().fieldErrors);
    }
    if (error instanceof ActionError) {
      return errorResponse(error.message, error.code === 'NOT_FOUND' ? 404 : 400, error.code);
    }
    console.error('Error en mobile client update route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Mobile client delete endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with client id.
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

    const existing = await prisma.cliente.findFirst({
      where: { clienteId: id, tenantId },
    });

    if (!existing) {
      throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
    }

    await prisma.cliente.delete({ where: { clienteId: id } });

    return successResponse({ id, eliminado: true });
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, error.code === 'NOT_FOUND' ? 404 : 400, error.code);
    }
    console.error('Error en mobile client delete route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
