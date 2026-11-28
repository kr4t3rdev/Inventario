import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { InvalidProductSyncCursorError } from '@/lib/mobile-sync/product-sync-cursor';
import {
  getOptionalProductSyncToken,
  InvalidProductSyncRequestError,
  parseProductSyncLimit,
} from '@/lib/mobile-sync/product-sync-route-params';
import { getProductSnapshotPage } from '@/lib/mobile-sync/product-sync-service';

export const dynamic = 'force-dynamic';

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
    const searchParams = new URL(request.url).searchParams;
    const limit = parseProductSyncLimit(searchParams);
    const pageToken = getOptionalProductSyncToken(searchParams, 'pageToken');
    const result = await getProductSnapshotPage({ tenantId, limit, pageToken });
    return successResponse(result);
  } catch (error) {
    if (error instanceof InvalidProductSyncCursorError) {
      return errorResponse(error.message, 400, 'INVALID_SYNC_CURSOR');
    }
    if (error instanceof InvalidProductSyncRequestError || error instanceof RangeError) {
      return errorResponse(error.message, 400, 'INVALID_SYNC_REQUEST');
    }

    console.error('Error en mobile product sync snapshot route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
