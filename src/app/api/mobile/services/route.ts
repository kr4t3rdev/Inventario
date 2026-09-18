import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * @description Maps a Servicios row to the mobile service contract.
 * @param {Record<string, any>} s - Raw service row.
 * @returns {Record<string, unknown>} Mobile-shaped service payload.
 */
export function mapServicio(s: any) {
  return {
    servicioId: s.servicioId,
    nombre: s.nombre,
    descripcion: s.descripcion,
    precio: s.precio,
    estado: 'ACTIVO',
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

const SELECT = {
  servicioId: true,
  nombre: true,
  descripcion: true,
  precio: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile services list endpoint.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Mapped service list.
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
    const rows = await prisma.servicios.findMany({
      where: { tenantId },
      select: SELECT,
      orderBy: { nombre: 'asc' },
    });
    return successResponse({ items: rows.map(mapServicio) });
  } catch (error) {
    console.error('Error en mobile services route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Creates a service for the caller's tenant.
 * @param {Request} request - Incoming authenticated request with { nombre, precio, descripcion? }.
 * @returns {Promise<Response>} Created mapped service.
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
    const body = (await request.json()) as { nombre?: unknown; precio?: unknown; descripcion?: unknown };
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const precio = typeof body.precio === 'number' && Number.isFinite(body.precio) ? body.precio : -1;
    if (!nombre || nombre.length > 100) {
      return errorResponse('El nombre es requerido (máx. 100 caracteres)', 400, 'VALIDATION_ERROR');
    }
    if (precio < 0) {
      return errorResponse('El precio debe ser mayor o igual a 0', 400, 'VALIDATION_ERROR');
    }
    const descripcion =
      typeof body.descripcion === 'string' && body.descripcion.trim() ? body.descripcion.trim() : '';

    const created = await prisma.servicios.create({
      data: { nombre, precio: Math.round(precio), descripcion, tenantId },
      select: SELECT,
    });
    return successResponse(mapServicio(created as any), 201);
  } catch (error) {
    console.error('Error creando servicio (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}