import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface ConceptoRecord {
  conceptoId: string;
  tenantId: string;
  nombre: string;
  descripcion: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @description Maps a GastoConcepto row to the mobile ConceptoGasto contract.
 * @param {ConceptoRecord} concepto - Raw concept row.
 * @returns {Record<string, unknown>} Mobile-shaped concept payload.
 */
export function mapConcepto(concepto: ConceptoRecord) {
  return {
    conceptoId: concepto.conceptoId,
    nombre: concepto.nombre,
    descripcion: concepto.descripcion ?? undefined,
    estado: concepto.isActive ? ('ACTIVO' as const) : ('INACTIVO' as const),
    createdAt: concepto.createdAt.toISOString(),
    updatedAt: concepto.updatedAt.toISOString(),
  };
}

/**
 * @description Mobile expense concepts list endpoint.
 * @param {Request} request - Incoming authenticated request; supports ?includeInactive=1.
 * @returns {Promise<Response>} Mapped concept list response.
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const { searchParams } = new URL(request.url);
    const where: Record<string, unknown> = { tenantId };
    if (searchParams.get('includeInactive') !== '1') {
      where.isActive = true;
    }
    const rows = await prisma.gastoConcepto.findMany({ where, orderBy: { nombre: 'asc' } });
    return successResponse({ items: rows.map(mapConcepto) });
  } catch (error) {
    console.error('Error en mobile expense-concepts route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Creates an expense concept scoped to the caller's tenant.
 * @param {Request} request - Incoming authenticated request with {nombre,descripcion}.
 * @returns {Promise<Response>} Created mapped concept.
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
    const body = (await request.json()) as { nombre?: string; descripcion?: string };
    if (!body.nombre || body.nombre.trim().length === 0) {
      return errorResponse('Nombre requerido', 400, 'VALIDATION_ERROR');
    }
    const created = (await prisma.gastoConcepto.create({
      data: {
        tenantId,
        nombre: body.nombre.trim(),
        descripcion: body.descripcion ?? null,
      },
    })) as unknown as ConceptoRecord;
    return successResponse(mapConcepto(created), 201);
  } catch (error) {
    console.error('Error creando concepto (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
