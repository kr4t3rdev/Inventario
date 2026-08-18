import {
  AccountingReconciliationApi,
  Configuration,
  type GetAccountingReconciliationExpensesHistoryResponse,
  type GetAccountingReconciliationExpensesResponse,
  type GetAccountingReconciliationSalesHistoryResponse,
  type GetAccountingReconciliationSalesResponse,
  type GetAccountingReconciliationServicesHistoryResponse,
  type GetAccountingReconciliationServicesResponse,
  type GetAccountingReconciliationStatsResponse,
} from '../../sdks/mobile-v1/typescript/src';
import type { FetchAPI } from '../../sdks/mobile-v1/typescript/src/runtime';
import type {
  MobileGetAccountingReconciliationExpensesHistoryRequest,
  MobileGetAccountingReconciliationExpensesRequest,
  MobileGetAccountingReconciliationSalesHistoryRequest,
  MobileGetAccountingReconciliationSalesRequest,
  MobileGetAccountingReconciliationServicesHistoryRequest,
  MobileGetAccountingReconciliationServicesRequest,
} from '../../sdks/mobile-v1/typescript/src/apis/AccountingReconciliationApi';
import { isUnauthorizedResponse, type UnauthorizedHandler } from './business-api';
import { normalizeBasePath } from './sdk-client';

export interface ReconciliationApiClient {
  listSales(params?: MobileGetAccountingReconciliationSalesRequest): Promise<GetAccountingReconciliationSalesResponse>;
  getSalesHistory(params?: MobileGetAccountingReconciliationSalesHistoryRequest): Promise<GetAccountingReconciliationSalesHistoryResponse>;
  listServices(params?: MobileGetAccountingReconciliationServicesRequest): Promise<GetAccountingReconciliationServicesResponse>;
  getServicesHistory(params?: MobileGetAccountingReconciliationServicesHistoryRequest): Promise<GetAccountingReconciliationServicesHistoryResponse>;
  listExpenses(params?: MobileGetAccountingReconciliationExpensesRequest): Promise<GetAccountingReconciliationExpensesResponse>;
  getExpensesHistory(params?: MobileGetAccountingReconciliationExpensesHistoryRequest): Promise<GetAccountingReconciliationExpensesHistoryResponse>;
  getStats(): Promise<GetAccountingReconciliationStatsResponse>;
}

/**
 * @description Creates an authenticated adapter for existing reconciliation read routes.
 * @param {string} baseUrl - API origin or mobile v1 base path.
 * @param {() => string | null} getAccessToken - In-memory access-token provider.
 * @param {FetchAPI} fetchApi - Optional fetch implementation for tests or platform adapters.
 * @param {UnauthorizedHandler} onUnauthorized - Called for generated 401/403 responses.
 * @returns {ReconciliationApiClient} Reconciliation read operations for mobile clients.
 */
export function createGeneratedReconciliationApi(
  baseUrl: string,
  getAccessToken: () => string | null,
  fetchApi?: FetchAPI,
  onUnauthorized?: UnauthorizedHandler,
): ReconciliationApiClient {
  const reconciliationApi = new AccountingReconciliationApi(new Configuration({
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
    listSales: (params = {}) => safelyCall(() => reconciliationApi.mobileGetAccountingReconciliationSales(params)),
    getSalesHistory: (params = {}) => safelyCall(() => reconciliationApi.mobileGetAccountingReconciliationSalesHistory(params)),
    listServices: (params = {}) => safelyCall(() => reconciliationApi.mobileGetAccountingReconciliationServices(params)),
    getServicesHistory: (params = {}) => safelyCall(() => reconciliationApi.mobileGetAccountingReconciliationServicesHistory(params)),
    listExpenses: (params = {}) => safelyCall(() => reconciliationApi.mobileGetAccountingReconciliationExpenses(params)),
    getExpensesHistory: (params = {}) => safelyCall(() => reconciliationApi.mobileGetAccountingReconciliationExpensesHistory(params)),
    getStats: () => safelyCall(() => reconciliationApi.mobileGetAccountingReconciliationStats()),
  };
}
