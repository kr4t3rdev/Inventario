import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface CategoriaRecord {
  catId: string;
  tenantId: string;
  nombre: string;
  descripcion: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @description Maps a Categoria row to the mobile category contract.
 * @param {CategoriaRecord} categoria - Raw category row.
 * @returns {Record<string, unknown>} Mobile-shaped category payload.
 */
export function mapCategoria(categoria: CategoriaRecord) {
  return {
    categoryId: categoria.catId,
    nombre: categoria.nombre,
    descripcion: categoria.descripcion ?? undefined,
    createdAt: categoria.createdAt.toISOString(),
    updatedAt: categoria.updatedAt.toISOString(),
  };
}

const CATEGORIA_SELECT = {
  catId: true,
  nombre: true,
  descripcion: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Mobile categories list endpoint.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Mapped category list.
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
    const categorias = (await prisma.categoria.findMany({
      where: { tenantId },
      select: CATEGORIA_SELECT,
      orderBy: { nombre: 'asc' },
    })) as unknown as CategoriaRecord[];
    return successResponse({ items: categorias.map(mapCategoria) });
  } catch (error) {
    console.error('Error en mobile categories route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Creates a category for the caller's tenant.
 * @param {Request} request - Incoming authenticated request with { nombre, descripcion? }.
 * @returns {Promise<Response>} Created mapped category.
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
    const body = (await request.json()) as { nombre?: unknown; descripcion?: unknown };
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    if (!nombre || nombre.length > 100) {
      return errorResponse('El nombre es requerido (máx. 100 caracteres)', 400, 'VALIDATION_ERROR');
    }
    const descripcion =
      typeof body.descripcion === 'string' && body.descripcion.trim() ? body.descripcion.trim() : null;

    const created = (await prisma.categoria.create({
      data: { nombre, descripcion, tenantId },
      select: CATEGORIA_SELECT,
    })) as unknown as CategoriaRecord;
    return successResponse(mapCategoria(created), 201);
  } catch (error) {
    console.error('Error creando categoría (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}