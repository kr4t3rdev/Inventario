import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import {
  listFacturasForTenant,
  mapFacturaForMobile,
} from '@/features/facturas/services/factura-read-service';
import { authorizeInvoicingFeature } from './authorize';

export const dynamic = 'force-dynamic';

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * @description Lists existing invoices for the authenticated tenant.
 * @param {Request} request - Bearer-authenticated mobile request with optional filters.
 * @returns {Promise<Response>} Mobile invoices and pagination.
 */
export async function GET(request: Request): Promise<Response> {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) return authResult as Response;

  const tenantId = authResult.user.tenantId;
  if (!tenantId) return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  const featureError = authorizeInvoicingFeature(authResult.user);
  if (featureError) return featureError;

  try {
    const { searchParams } = new URL(request.url);
    const result = await listFacturasForTenant(tenantId, {
      search: searchParams.get('search') ?? undefined,
      estado: searchParams.get('estado') ?? undefined,
      clienteId: searchParams.get('clienteId') ?? undefined,
      serieId: searchParams.get('serieId') ?? undefined,
      fechaInicio: searchParams.get('fechaInicio') ?? undefined,
      fechaFin: searchParams.get('fechaFin') ?? undefined,
      page: positiveInteger(searchParams.get('page'), 1),
      limit: positiveInteger(searchParams.get('limit'), 50),
    });
    return successResponse({
      items: result.data.map(mapFacturaForMobile),
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error listando facturas móviles:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
