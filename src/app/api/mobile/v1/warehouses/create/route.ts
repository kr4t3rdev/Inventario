import { ZodError } from 'zod';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { almacenSchema } from '@/features/almacenes/schemas';

export const dynamic = 'force-dynamic';

const ALMACEN_SELECT = {
  almacenId: true,
  nombre: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile warehouse create endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request with warehouse data.
 * @returns {Promise<Response>} Created warehouse response.
 */
export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }

  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const body = await request.json();
    const parsed = almacenSchema.parse(body);

    const almacen = await prisma.almacen.create({
      data: {
        nombre: parsed.nombre,
        tenantId,
      },
      select: ALMACEN_SELECT,
    });

    return successResponse(almacen);
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse('Datos invalidos', 400, 'VALIDATION_ERROR', error.flatten().fieldErrors);
    }
    console.error('Error en mobile warehouses create route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
