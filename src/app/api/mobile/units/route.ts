import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface UnidadRecord {
  unidadId: string;
  tenantId: string;
  nombre: string;
  simbolo: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @description Maps a Unidad row to the mobile unit contract.
 * @param {UnidadRecord} unidad - Raw unit row.
 * @returns {Record<string, unknown>} Mobile-shaped unit payload (simbolo → abreviatura).
 */
export function mapUnidad(unidad: UnidadRecord) {
  return {
    unitId: unidad.unidadId,
    nombre: unidad.nombre,
    abreviatura: unidad.simbolo,
    createdAt: unidad.createdAt.toISOString(),
    updatedAt: unidad.updatedAt.toISOString(),
  };
}

/**
 * @description Resolves which unique field a Prisma P2002 conflict refers to.
 * @param {unknown} error - Caught create/update error.
 * @returns {'nombre' | 'simbolo' | null} Conflicting field, if any.
 */
function conflictTarget(error: unknown): 'nombre' | 'simbolo' | null {
  const err = error as { code?: string; meta?: { target?: unknown } };
  if (err?.code !== 'P2002') return null;
  const target = err.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : typeof target === 'string' ? [target] : [];
  if (fields.includes('nombre')) return 'nombre';
  if (fields.includes('simbolo')) return 'simbolo';
  return null;
}

const UNIDAD_SELECT = {
  unidadId: true,
  nombre: true,
  simbolo: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile units list endpoint.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Mapped unit list.
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
    const unidades = (await prisma.unidad.findMany({
      where: { tenantId },
      select: UNIDAD_SELECT,
      orderBy: { nombre: 'asc' },
    })) as unknown as UnidadRecord[];
    return successResponse({ items: unidades.map(mapUnidad) });
  } catch (error) {
    console.error('Error en mobile units route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Creates a unit of measure for the caller's tenant.
 * @param {Request} request - Incoming authenticated request with { nombre, abreviatura }.
 * @returns {Promise<Response>} Created mapped unit.
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
    const body = (await request.json()) as { nombre?: unknown; abreviatura?: unknown };
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const simbolo = typeof body.abreviatura === 'string' ? body.abreviatura.trim() : '';
    if (!nombre || nombre.length > 100) {
      return errorResponse('El nombre es requerido (máx. 100 caracteres)', 400, 'VALIDATION_ERROR');
    }
    if (!simbolo || simbolo.length > 20) {
      return errorResponse('La abreviatura es requerida (máx. 20 caracteres)', 400, 'VALIDATION_ERROR');
    }

    const created = (await prisma.unidad.create({
      data: { nombre, simbolo, tenantId },
      select: UNIDAD_SELECT,
    })) as unknown as UnidadRecord;
    return successResponse(mapUnidad(created), 201);
  } catch (error) {
    const conflict = conflictTarget(error);
    if (conflict === 'nombre') return errorResponse('Ya existe una unidad con ese nombre', 409, 'CONFLICT');
    if (conflict === 'simbolo') return errorResponse('Ya existe una unidad con esa abreviatura', 409, 'CONFLICT');
    console.error('Error creando unidad (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}