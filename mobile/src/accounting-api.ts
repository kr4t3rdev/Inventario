import {
  AccountingBankingApi,
  Configuration,
  type GetAccountingBankAccountsIdHistoryResponse,
  type GetAccountingBankAccountsIdResponse,
  type GetAccountingBankAccountsResponse,
} from '../../sdks/mobile-v1/typescript/src';
import type { FetchAPI } from '../../sdks/mobile-v1/typescript/src/runtime';
import type { MobileGetAccountingBankAccountsByIdNestedHistoryRequest } from '../../sdks/mobile-v1/typescript/src/apis/AccountingBankingApi';
import { normalizeBasePath } from './sdk-client';
import { isUnauthorizedResponse, type UnauthorizedHandler } from './business-api';

export interface AccountingApiClient {
  listBankAccounts(): Promise<GetAccountingBankAccountsResponse>;
  getBankAccount(id: string): Promise<GetAccountingBankAccountsIdResponse>;
  getBankAccountHistory(id: string, params?: Omit<MobileGetAccountingBankAccountsByIdNestedHistoryRequest, 'id'>): Promise<GetAccountingBankAccountsIdHistoryResponse>;
}

/**
 * @description Creates a typed accounting adapter for existing mobile bank-account routes.
 * @param {string} baseUrl - API origin or mobile v1 base path.
 * @param {() => string | null} getAccessToken - In-memory access-token provider.
 * @param {FetchAPI} fetchApi - Optional fetch implementation for tests or platform adapters.
 * @param {UnauthorizedHandler} onUnauthorized - Called for generated 401/403 responses.
 * @returns {AccountingApiClient} Authenticated bank-account read operations.
 */
export function createGeneratedAccountingApi(
  baseUrl: string,
  getAccessToken: () => string | null,
  fetchApi?: FetchAPI,
  onUnauthorized?: UnauthorizedHandler,
): AccountingApiClient {
  const accountingApi = new AccountingBankingApi(new Configuration({
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
    listBankAccounts: () => safelyCall(() => accountingApi.mobileGetAccountingBankAccounts()),
    getBankAccount: (id) => safelyCall(() => accountingApi.mobileGetAccountingBankAccountsById({ id })),
    getBankAccountHistory: (id, params = {}) => safelyCall(() => accountingApi.mobileGetAccountingBankAccountsByIdNestedHistory({ id, ...params })),
  };
}
