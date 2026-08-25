import { ZodError } from 'zod';
import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { vendorSchema } from '@/features/vendors/schemas';

export const dynamic = 'force-dynamic';

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
 * @description Mobile provider create endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request with provider data.
 * @returns {Promise<Response>} Created provider response.
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
    const parsed = vendorSchema.parse(body);

    const vendor = await prisma.vendor.create({
      data: {
        nombre: parsed.nombre,
        contacto: parsed.contacto ?? null,
        direccion: parsed.direccion ?? null,
        telefono: parsed.telefono ?? null,
        cuentaCUP: parsed.cuentaCUP ?? null,
        cuentaUSD: parsed.cuentaUSD ?? null,
        logo: parsed.logo ?? null,
        contrato: parsed.contrato ?? null,
        tenantId,
      },
      select: VENDOR_SELECT,
    });

    return successResponse(vendor);
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse('Datos invalidos', 400, 'VALIDATION_ERROR', error.flatten().fieldErrors);
    }
    console.error('Error en mobile providers create route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
