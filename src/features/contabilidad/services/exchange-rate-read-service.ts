import { exchangeRateProvider } from './exchange-rate-provider';
import type {
  ExchangeCurrentRatesResult,
  ExchangeRateHistoryFilters,
  ExchangeRateHistoryResult,
  ExchangeRateProvider,
} from './exchange-types';

export class ExchangeRateReadService {
  constructor(private readonly provider: ExchangeRateProvider = exchangeRateProvider) {}

  async getCurrentRates(): Promise<ExchangeCurrentRatesResult> {
    return this.provider.getCurrentRates();
  }

  async getHistorialTasas(
    filters: ExchangeRateHistoryFilters = {},
  ): Promise<ExchangeRateHistoryResult> {
    return this.provider.getRateHistory(filters);
  }

  async getMonedas(): Promise<Awaited<ReturnType<ExchangeRateProvider['listCurrencies']>>> {
    return this.provider.listCurrencies();
  }
}
