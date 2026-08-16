import {
  DashboardApi,
  ProductsApi,
  Configuration,
  type GetDashboardStatsResponse,
  type GetProductsResponse,
  type GetProductsStockResponse,
  type MobileGetDashboardStatsRequest,
  type MobileGetProductsStockRequest,
} from '../../sdks/mobile-v1/typescript/src';
import type { FetchAPI } from '../../sdks/mobile-v1/typescript/src/runtime';
import { normalizeBasePath } from './sdk-client';

export interface BusinessApi {
  dashboard(params?: MobileGetDashboardStatsRequest): Promise<GetDashboardStatsResponse>;
  products(): Promise<GetProductsResponse>;
  stock(params: RequiredStockRequest): Promise<GetProductsStockResponse>;
}

export type RequiredStockRequest = MobileGetProductsStockRequest & {
  ubicacionId: string;
  tipoUbicacion: NonNullable<MobileGetProductsStockRequest['tipoUbicacion']>;
};

export type UnauthorizedHandler = () => void | Promise<void>;

/**
 * @description Creates typed dashboard and product APIs backed by the generated mobile SDK.
 * @param {string} baseUrl - API origin or mobile v1 base path.
 * @param {() => string | null} getAccessToken - In-memory access-token provider.
 * @param {FetchAPI} fetchApi - Optional fetch implementation for tests or platform adapters.
 * @param {UnauthorizedHandler} onUnauthorized - Called for generated 401/403 responses.
 * @returns {BusinessApi} Typed business-surface adapter.
 */
export function createGeneratedBusinessApi(
  baseUrl: string,
  getAccessToken: () => string | null,
  fetchApi?: FetchAPI,
  onUnauthorized?: UnauthorizedHandler,
): BusinessApi {
  const configuration = new Configuration({
    basePath: normalizeBasePath(baseUrl),
    accessToken: () => getAccessToken() ?? '',
    fetchApi,
  });
  const dashboardApi = new DashboardApi(configuration);
  const productsApi = new ProductsApi(configuration);

  const safelyCall = async <T>(request: Promise<T>): Promise<T> => {
    try {
      return await request;
    } catch (error) {
      if (isUnauthorizedResponse(error)) await onUnauthorized?.();
      throw error;
    }
  };

  return {
    dashboard: (params = {}) => safelyCall(dashboardApi.mobileGetDashboardStats(params)),
    products: () => safelyCall(productsApi.mobileGetProducts()),
    stock: (params) => safelyCall(productsApi.mobileGetProductsStock(params)),
  };
}

/**
 * @description Detects generated SDK authorization failures without reading response bodies.
 * @param {unknown} error - Generated SDK failure.
 * @returns {boolean} Whether the response status requires local session expiry.
 */
export function isUnauthorizedResponse(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const response = 'response' in error ? error.response : undefined;
  if (!response || typeof response !== 'object' || !('status' in response)) return false;
  const status = response.status;
  return status === 401 || status === 403;
}
