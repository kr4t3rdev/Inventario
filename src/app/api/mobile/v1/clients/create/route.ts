import { ZodError } from 'zod';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { clienteSchema } from '@/features/clientes/schemas';

export const dynamic = 'force-dynamic';

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
 * @description Mobile client create endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request with client data.
 * @returns {Promise<Response>} Created client response.
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
    const parsed = clienteSchema.parse(body);

    const cliente = await prisma.cliente.create({
      data: {
        nombre: parsed.nombre,
        direccion: parsed.direccion ?? null,
        telefono: parsed.telefono ?? null,
        logoUrl: parsed.logoUrl ?? null,
        numeroCuentaCUP: parsed.numeroCuentaCUP ?? null,
        numeroCuentaUSD: parsed.numeroCuentaUSD ?? null,
        numeroContrato: parsed.numeroContrato ?? null,
        tenantId,
      },
      select: CLIENTE_SELECT,
    });

    return successResponse(cliente);
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse('Datos invalidos', 400, 'VALIDATION_ERROR', error.flatten().fieldErrors);
    }
    console.error('Error en mobile clients create route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
