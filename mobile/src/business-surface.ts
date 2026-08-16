import type {
  GetDashboardStatsResponse,
  GetProductsResponse,
  GetProductsStockResponse,
  MobileGetProductsStockRequest,
} from '../../sdks/mobile-v1/typescript/src';
import type { BusinessApi, RequiredStockRequest } from './business-api';

export interface BusinessSurfaceData {
  dashboard: GetDashboardStatsResponse | null;
  products: GetProductsResponse | null;
  stock: GetProductsStockResponse | null;
}

export interface BusinessSurfaceErrors {
  dashboard: Error | null;
  products: Error | null;
  stock: Error | null;
}

export interface BusinessSurfaceResult {
  data: BusinessSurfaceData;
  errors: BusinessSurfaceErrors;
}

/**
 * @description Loads independent authenticated sections without discarding successful responses.
 * @param {BusinessApi} api - Typed business API adapter.
 * @param {MobileGetProductsStockRequest} stockParams - Contract-supported stock filters.
 * @returns {Promise<BusinessSurfaceResult>} Section data and section-level errors.
 */
export async function loadBusinessSurface(
  api: BusinessApi,
  stockParams: MobileGetProductsStockRequest = {},
): Promise<BusinessSurfaceResult> {
  const stockLocation: RequiredStockRequest | null = stockParams.ubicacionId && stockParams.tipoUbicacion
    ? { ubicacionId: stockParams.ubicacionId, tipoUbicacion: stockParams.tipoUbicacion }
    : null;
  const requests = [
    api.dashboard(stockParams),
    api.products(),
    ...(stockLocation ? [api.stock({ ...stockLocation, includeZero: 'false' })] : []),
  ] as const;
  const settled = await Promise.allSettled(requests);
  const stockResult = settled[2];

  return {
    data: {
      dashboard: settled[0].status === 'fulfilled' ? settled[0].value : null,
      products: settled[1].status === 'fulfilled' ? settled[1].value : null,
      stock: stockResult?.status === 'fulfilled' ? stockResult.value : null,
    },
    errors: {
      dashboard: toError(settled[0]),
      products: toError(settled[1]),
      stock: stockResult ? toError(stockResult) : null,
    },
  };
}

/**
 * @description Converts a rejected promise result into a display-safe Error instance.
 * @param {PromiseSettledResult<unknown>} result - Settled request result.
 * @returns {Error | null} Error or null for a successful request.
 */
function toError(result: PromiseSettledResult<unknown>): Error | null {
  if (result.status === 'fulfilled') return null;
  return result.reason instanceof Error ? result.reason : new Error('Error de conexión');
}
