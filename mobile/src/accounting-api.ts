import {
  AccountingBankingApi,
  Configuration,
  type GetAccountingBankAccountsIdResponse,
  type GetAccountingBankAccountsResponse,
} from '../../sdks/mobile-v1/typescript/src';
import type { FetchAPI } from '../../sdks/mobile-v1/typescript/src/runtime';
import { normalizeBasePath } from './sdk-client';
import { isUnauthorizedResponse, type UnauthorizedHandler } from './business-api';

export interface AccountingApiClient {
  listBankAccounts(): Promise<GetAccountingBankAccountsResponse>;
  getBankAccount(id: string): Promise<GetAccountingBankAccountsIdResponse>;
  getBankAccountHistory(id: string, params?: BankAccountHistoryQuery): Promise<BankAccountHistoryResponse>;
}

export interface BankAccountHistoryQuery {
  fechaInicio?: Date;
  fechaFin?: Date;
  tipoMovimiento?: string;
  page?: number;
  limit?: number;
}

export interface BankAccountHistoryResponse {
  transacciones: BankAccountTransaction[];
  resumen: BankAccountHistorySummary;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface BankAccountTransaction {
  transaccionId: string;
  fecha: string;
  tipoMovimiento: string;
  descripcion: string;
  montoOriginal: number;
  monedaOriginal: string;
  tasaCambio: number | null;
  montoConvertido: number;
  observaciones?: string;
}

export interface BankAccountHistorySummary {
  saldoActual: number;
  totalIngresos: number;
  totalEgresos: number;
  totalMovimientos: number;
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

  // The committed SDK models this response incorrectly; use the verified route shape
  // until the pinned OpenAPI generator is available to regenerate every SDK.
  const getHistory = async (id: string, params: BankAccountHistoryQuery = {}) => {
    const query = new URLSearchParams();
    if (params.fechaInicio) query.set('fechaInicio', params.fechaInicio.toISOString());
    if (params.fechaFin) query.set('fechaFin', params.fechaFin.toISOString());
    if (params.tipoMovimiento) query.set('tipoMovimiento', params.tipoMovimiento);
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));

    const url = `${normalizeBasePath(baseUrl)}/accounting/bank-accounts/${encodeURIComponent(id)}/history${query.size ? `?${query}` : ''}`;
    const response = await (fetchApi ?? globalThis.fetch)(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    });
    if (!response.ok) throw { response };
    return await response.json() as BankAccountHistoryResponse;
  };

  return {
    listBankAccounts: () => safelyCall(() => accountingApi.mobileGetAccountingBankAccounts()),
    getBankAccount: (id) => safelyCall(() => accountingApi.mobileGetAccountingBankAccountsById({ id })),
    getBankAccountHistory: (id, params) => safelyCall(() => getHistory(id, params)),
  };
}
