import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface PlanRecord {
  planId: string;
  nombre: string;
  descripcion?: string | null;
  precio: unknown;
  maxUsuarios: number;
  maxAlmacenes: number;
  maxProductos: number;
  features: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @description Maps a Prisma Plan record to the mobile Plan contract.
 * @param {PlanRecord} plan - Raw plan row from the database.
 * @returns {Record<string, unknown>} Mobile-shaped plan payload.
 */
export function mapPlan(plan: PlanRecord) {
  const featuresMap = (plan.features && typeof plan.features === 'object' ? plan.features : {}) as Record<string, boolean>;
  return {
    planId: plan.planId,
    nombre: plan.nombre,
    descripcion: plan.descripcion ?? undefined,
    precio: Number(plan.precio),
    moneda: 'USD',
    usuariosMax: plan.maxUsuarios,
    almacenMax: plan.maxAlmacenes,
    productosMax: plan.maxProductos,
    features: Object.keys(featuresMap).filter((key) => featuresMap[key] === true),
    estado: 'ACTIVO' as const,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

/**
 * @description Mobile plan list endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Mapped plan list response.
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  if (!authResult.user.tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const plans = await prisma.plan.findMany({ orderBy: { createdAt: 'desc' } });
    return successResponse({ items: plans.map(mapPlan) });
  } catch (error) {
    console.error('Error en mobile plans route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Creates a plan. Admin only.
 * @param {Request} request - Incoming authenticated request with plan payload.
 * @returns {Promise<Response>} Created mapped plan.
 */
export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  if (!authResult.user.tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }
  if (authResult.user.role !== 'admin') {
    return errorResponse('Acceso restringido', 403, 'FORBIDDEN');
  }

  try {
    const body = (await request.json()) as {
      nombre?: string;
      descripcion?: string;
      precio?: number;
      usuariosMax?: number;
      almacenMax?: number;
      productosMax?: number;
      features?: string[];
    };
    if (!body.nombre || typeof body.precio !== 'number' || !Number.isFinite(body.precio)) {
      return errorResponse('Datos inválidos', 400, 'VALIDATION_ERROR');
    }

    const created = (await prisma.plan.create({
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion ?? null,
        precio: body.precio,
        duracionDias: 30,
        maxUsuarios: body.usuariosMax ?? 1,
        maxAlmacenes: body.almacenMax ?? 1,
        maxProductos: body.productosMax ?? 100,
        features: Object.fromEntries((body.features ?? []).map((key) => [key, true])),
      },
    })) as unknown as PlanRecord;
    return successResponse(mapPlan(created), 201);
  } catch (error) {
    console.error('Error creando plan (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
