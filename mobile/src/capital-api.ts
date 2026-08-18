import {
  AccountingCapitalApi,
  Configuration,
  type CapitalInjectionCreateRequest,
  type CapitalPaymentRequest,
  type GetAccountingCapitalInjectionsResponse,
  type PostAccountingCapitalInjectionsIdPaymentsResponse,
  type PostAccountingCapitalInjectionsResponse,
} from '../../sdks/mobile-v1/typescript/src';
import type { FetchAPI } from '../../sdks/mobile-v1/typescript/src/runtime';
import type { MobileGetAccountingCapitalInjectionsRequest } from '../../sdks/mobile-v1/typescript/src/apis/AccountingCapitalApi';
import { isUnauthorizedResponse, type UnauthorizedHandler } from './business-api';
import { normalizeBasePath } from './sdk-client';

export interface CapitalApiClient {
  listCapitalInjections(params?: MobileGetAccountingCapitalInjectionsRequest): Promise<GetAccountingCapitalInjectionsResponse>;
  createCapitalInjection(input: CapitalInjectionCreateRequest): Promise<PostAccountingCapitalInjectionsResponse>;
  registerCapitalPayment(id: string, input: CapitalPaymentRequest): Promise<PostAccountingCapitalInjectionsIdPaymentsResponse>;
}

/**
 * @description Creates an authenticated adapter for existing capital-injection routes.
 * @param {string} baseUrl - API origin or mobile v1 base path.
 * @param {() => string | null} getAccessToken - In-memory access-token provider.
 * @param {FetchAPI} fetchApi - Optional fetch implementation for tests or platform adapters.
 * @param {UnauthorizedHandler} onUnauthorized - Called for generated 401/403 responses.
 * @returns {CapitalApiClient} Capital-injection operations for mobile clients.
 */
export function createGeneratedCapitalApi(
  baseUrl: string,
  getAccessToken: () => string | null,
  fetchApi?: FetchAPI,
  onUnauthorized?: UnauthorizedHandler,
): CapitalApiClient {
  const capitalApi = new AccountingCapitalApi(new Configuration({
    basePath: normalizeBasePath(baseUrl),
    accessToken: () => getAccessToken() ?? '',
    fetchApi,
  }));

  const safelyCall = async <T>(request: () => Promise<T>): Promise<T> => {
    try {
      return await request();
    } catch (error) {
      if (isUnauthorizedResponse(error)) await onUnauthorized?.();
      throw error;
    }
  };

  return {
    listCapitalInjections: (params = {}) => safelyCall(() => capitalApi.mobileGetAccountingCapitalInjections(params)),
    createCapitalInjection: (input) => safelyCall(() => capitalApi.mobilePostAccountingCapitalInjections({
      capitalInjectionCreateRequest: input,
    })),
    registerCapitalPayment: (id, input) => safelyCall(() => capitalApi.mobilePostAccountingCapitalInjectionsByIdPayments({
      id,
      capitalPaymentRequest: input,
    })),
  };
}
