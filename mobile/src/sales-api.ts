import {
  Configuration,
  SalesApi,
  type GetSalesIdResponse,
  type GetSalesResponse,
  type PatchSalesIdUpdateResponse,
  type PostSalesCreateResponse,
  type PostSalesIdCancelResponse,
  type SaleCancelRequest,
  type SaleCreateRequest,
  type SaleUpdateRequest,
} from '../../sdks/mobile-v1/typescript/src';
import type { FetchAPI } from '../../sdks/mobile-v1/typescript/src/runtime';
import type {
  MobilePatchSalesByIdUpdateRequest,
  MobileGetSalesByIdRequest,
  MobilePostSalesByIdCancelRequest,
  MobilePostSalesCreateRequest,
} from '../../sdks/mobile-v1/typescript/src/apis/SalesApi';
import { normalizeBasePath } from './sdk-client';
import { isUnauthorizedResponse, type UnauthorizedHandler } from './business-api';

export interface SalesApiClient {
  list(): Promise<GetSalesResponse>;
  get(id: string): Promise<GetSalesIdResponse>;
  create(input: SaleCreateRequest): Promise<PostSalesCreateResponse>;
  update(id: string, input: SaleUpdateRequest): Promise<PatchSalesIdUpdateResponse>;
  cancel(id: string, input: SaleCancelRequest): Promise<PostSalesIdCancelResponse>;
}

/**
 * @description Creates a typed sales adapter for existing mobile sales routes.
 * @param {string} baseUrl - API origin or mobile v1 base path.
 * @param {() => string | null} getAccessToken - In-memory access-token provider.
 * @param {FetchAPI} fetchApi - Optional fetch implementation for tests or platform adapters.
 * @param {UnauthorizedHandler} onUnauthorized - Called for generated 401/403 responses.
 * @returns {SalesApiClient} Authenticated sales operations.
 */
export function createGeneratedSalesApi(
  baseUrl: string,
  getAccessToken: () => string | null,
  fetchApi?: FetchAPI,
  onUnauthorized?: UnauthorizedHandler,
): SalesApiClient {
  const salesApi = new SalesApi(new Configuration({
    basePath: normalizeBasePath(baseUrl),
    accessToken: () => getAccessToken() ?? '',
    fetchApi,
  }));

  const safelyCall = async <T>(request: Promise<T>): Promise<T> => {
    try {
      return await request;
    } catch (error) {
      if (isUnauthorizedResponse(error)) await onUnauthorized?.();
      throw error;
    }
  };

  return {
    list: () => safelyCall(salesApi.mobileGetSales()),
    get: (id) => safelyCall(salesApi.mobileGetSalesById({ id } satisfies MobileGetSalesByIdRequest)),
    create: (input) => safelyCall(salesApi.mobilePostSalesCreate({
      saleCreateRequest: input,
    } satisfies MobilePostSalesCreateRequest)),
    update: (id, input) => safelyCall(salesApi.mobilePatchSalesByIdUpdate({
      id,
      saleUpdateRequest: input,
    } satisfies MobilePatchSalesByIdUpdateRequest)),
    cancel: (id, input) => safelyCall(salesApi.mobilePostSalesByIdCancel({
      id,
      saleCancelRequest: input,
    } satisfies MobilePostSalesByIdCancelRequest)),
  };
}
