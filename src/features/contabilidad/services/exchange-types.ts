export type ExchangeRoute = 'same_currency' | 'direct' | 'via_principal';

export type ExchangeServiceErrorCode =
  | 'INVALID_AMOUNT'
  | 'CURRENCY_NOT_FOUND'
  | 'CURRENCY_INACTIVE'
  | 'NO_MAIN_CURRENCY'
  | 'EXCHANGE_RATE_NOT_FOUND';

export interface ExchangeCurrencyRecord {
  codigo: string;
  nombre: string;
  simbolo: string;
  esPrincipal: boolean;
  isActive: boolean;
}

export interface ExchangeRateRecord {
  tasaId: string;
  monedaOrigenId: string;
  monedaDestino: string;
  tasa: number;
  fechaVigencia: string;
  createdAt?: string;
}

export interface ExchangeCurrentRate extends ExchangeRateRecord {
  ruta: ExchangeRoute;
  effectiveAt: string;
  proveedor?: string;
}

export interface ExchangeQuote {
  montoOriginal: number;
  montoConvertido: number;
  tasaAplicada: number;
  monedaOrigen: string;
  monedaDestino: string;
  ruta: ExchangeRoute;
  tasaId?: string;
  proveedor?: string;
  effectiveAt?: string;
}

export interface ExchangeRateHistoryFilters {
  monedaOrigen?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  busqueda?: string;
  pagina?: number;
  limite?: number;
}

export interface ExchangeRateHistoryRow extends ExchangeRateRecord {
  creadoPor?: string | null;
  provenance?: string | null;
}

export interface ExchangeCurrentRatesResult {
  monedaPrincipal: ExchangeCurrencyRecord | null;
  tasas: ExchangeCurrentRate[];
}

export interface ExchangeRateHistoryResult {
  tasas: ExchangeRateHistoryRow[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ExchangeRateProvider {
  getCurrency(codigo: string): Promise<ExchangeCurrencyRecord | null>;
  /**
   * Returns the most recent exchange rate effective on or before the boundary.
   */
  getRateAsOf(params: {
    sourceCurrency: string;
    targetCurrency?: string;
    boundaryAt: Date;
    client?: Prisma.TransactionClient;
  }): Promise<{ tasaId: string; tasa: number; fechaVigencia: Date } | null>;
  getPrincipalCurrency(
    client?: Prisma.TransactionClient,
  ): Promise<ExchangeCurrencyRecord | null>;
  listCurrencies(): Promise<ExchangeCurrencyRecord[]>;
  getLatestRate(
    monedaOrigenId: string,
    monedaDestino: string,
  ): Promise<ExchangeRateRecord | null>;
  getCurrentRates(): Promise<ExchangeCurrentRatesResult>;
  getRateHistory(
    filters?: ExchangeRateHistoryFilters,
  ): Promise<ExchangeRateHistoryResult>;
  createRate(input: {
    monedaOrigenId: string;
    monedaDestino: string;
    tasa: number;
  }): Promise<ExchangeRateRecord>;
}

export class ExchangeServiceError extends Error {
  code: ExchangeServiceErrorCode;

  constructor(message: string, code: ExchangeServiceErrorCode) {
    super(message);
    this.name = 'ExchangeServiceError';
    this.code = code;
  }
}
import type { Prisma } from '@/generated/prisma';
