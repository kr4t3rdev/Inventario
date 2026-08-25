import { ZodError } from 'zod';
import { ActionError } from '@/lib/server-actions';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { vendorUpdateSchema } from '@/features/vendors/schemas';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VENDOR_SELECT = {
  vendorId: true,
  nombre: true,
  contacto: true,
  direccion: true,
  telefono: true,
  cuentaCUP: true,
  cuentaUSD: true,
  logo: true,
  contrato: true,
  vendorCode: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile provider detail endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with provider id.
 * @returns {Promise<Response>} Provider detail response.
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
    const vendor = await prisma.vendor.findFirst({
      where: { vendorId: id, tenantId },
      select: VENDOR_SELECT,
    });

    if (!vendor) {
      throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');
    }

    return successResponse(vendor);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, error.code === 'NOT_FOUND' ? 404 : 400, error.code);
    }
    console.error('Error en mobile provider detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Mobile provider update endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request with update data.
 * @param {RouteContext} context - Route params with provider id.
 * @returns {Promise<Response>} Updated provider response.
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
    const parsed = vendorUpdateSchema.parse({ ...body, vendorId: id });

    const existing = await prisma.vendor.findFirst({
      where: { vendorId: id, tenantId },
    });

    if (!existing) {
      throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.nombre !== undefined) updateData.nombre = parsed.nombre;
    if (parsed.contacto !== undefined) updateData.contacto = parsed.contacto;
    if (parsed.direccion !== undefined) updateData.direccion = parsed.direccion;
    if (parsed.telefono !== undefined) updateData.telefono = parsed.telefono;
    if (parsed.cuentaCUP !== undefined) updateData.cuentaCUP = parsed.cuentaCUP;
    if (parsed.cuentaUSD !== undefined) updateData.cuentaUSD = parsed.cuentaUSD;
    if (parsed.logo !== undefined) updateData.logo = parsed.logo;
    if (parsed.contrato !== undefined) updateData.contrato = parsed.contrato;

    const vendor = await prisma.vendor.update({
      where: { vendorId: id },
      data: updateData,
      select: VENDOR_SELECT,
    });

    return successResponse(vendor);
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse('Datos invalidos', 400, 'VALIDATION_ERROR', error.flatten().fieldErrors);
    }
    if (error instanceof ActionError) {
      return errorResponse(error.message, error.code === 'NOT_FOUND' ? 404 : 400, error.code);
    }
    console.error('Error en mobile provider update route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Mobile provider delete endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with provider id.
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

    const existing = await prisma.vendor.findFirst({
      where: { vendorId: id, tenantId },
    });

    if (!existing) {
      throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');
    }

    await prisma.vendor.delete({ where: { vendorId: id } });

    return successResponse({ id, eliminado: true });
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, error.code === 'NOT_FOUND' ? 404 : 400, error.code);
    }
    console.error('Error en mobile provider delete route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
