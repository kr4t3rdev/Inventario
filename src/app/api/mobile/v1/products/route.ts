import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { ProductoService } from '@/features/productos/services/producto-service';

export const dynamic = 'force-dynamic';

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }

  return value === 'true';
}

/**
 * @description Mobile product list endpoint using bearer auth.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Product list response.
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
    const ubicacionId = searchParams.get('ubicacionId');
    const tipoUbicacion = searchParams.get('tipoUbicacion');
    const filters = {
      search: searchParams.get('search'),
      categoryId: searchParams.get('categoryId'),
      subcategoryId: searchParams.get('subcategoryId'),
    };

    const items =
      ubicacionId && (tipoUbicacion === 'almacen' || tipoUbicacion === 'punto_venta')
        ? await ProductoService.listByLocation({
            tenantId,
            ubicacionId,
            tipoUbicacion,
            includeZero: parseBooleanParam(searchParams.get('includeZero')) ?? true,
            ...filters,
          })
        : await ProductoService.list(tenantId, filters);

    return successResponse({ items });
  } catch (error) {
    console.error('Error en mobile products route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
