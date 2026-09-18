import { ExchangeServiceError, type ExchangeQuote, type ExchangeRateProvider } from '@/features/contabilidad/services/exchange-types';
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';

function toIsoDate(value: string | Date | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * @description Servicio determinista para conversión de monedas sobre la frontera compartida de exchange.
 */
export class CurrencyConversionService {
  /**
   * @description Calcula una cotización determinista para una conversión de monedas usando el provider compartido.
   * @param {object} input - Datos de conversión.
   * @param {ExchangeRateProvider} provider - Proveedor de tasas.
   * @returns {Promise<ExchangeQuote>} Cotización con ruta, tasa y trazabilidad.
   */
  static async quoteConversion(
    input: { monto: number; monedaOrigen: string; monedaDestino: string },
    provider: ExchangeRateProvider = exchangeRateProvider,
  ): Promise<ExchangeQuote> {
    const monto = Number(input.monto);

    if (!Number.isFinite(monto) || monto <= 0) {
      throw new ExchangeServiceError('El monto debe ser positivo', 'INVALID_AMOUNT');
    }

    const [origen, destino] = await Promise.all([
      provider.getCurrency(input.monedaOrigen),
      provider.getCurrency(input.monedaDestino),
    ]);

    if (!origen) {
      throw new ExchangeServiceError('Moneda origen no encontrada', 'CURRENCY_NOT_FOUND');
    }

    if (!destino) {
      throw new ExchangeServiceError('Moneda destino no encontrada', 'CURRENCY_NOT_FOUND');
    }

    if (!origen.isActive || !destino.isActive) {
      throw new ExchangeServiceError('Una o ambas monedas no están activas', 'CURRENCY_INACTIVE');
    }

    if (origen.codigo === destino.codigo) {
      return {
        montoOriginal: monto,
        montoConvertido: monto,
        tasaAplicada: 1,
        monedaOrigen: origen.codigo,
        monedaDestino: destino.codigo,
        ruta: 'same_currency',
      };
    }

    const directRate = await provider.getLatestRate(origen.codigo, destino.codigo);
    if (directRate) {
      return {
        montoOriginal: monto,
        montoConvertido: Number((monto * directRate.tasa).toFixed(4)),
        tasaAplicada: directRate.tasa,
        monedaOrigen: origen.codigo,
        monedaDestino: destino.codigo,
        ruta: 'direct',
        tasaId: directRate.tasaId,
        effectiveAt: toIsoDate(directRate.fechaVigencia),
      };
    }

    const principal = await provider.getPrincipalCurrency();
    if (!principal) {
      throw new ExchangeServiceError(
        'No se ha configurado una moneda principal',
        'NO_MAIN_CURRENCY',
      );
    }

    const [origenPrincipalRate, destinoPrincipalRate] = await Promise.all([
      origen.codigo === principal.codigo
        ? Promise.resolve(null)
        : provider.getLatestRate(origen.codigo, principal.codigo),
      destino.codigo === principal.codigo
        ? Promise.resolve(null)
        : provider.getLatestRate(destino.codigo, principal.codigo),
    ]);

    if (origen.codigo !== principal.codigo && !origenPrincipalRate) {
      throw new ExchangeServiceError('No se encontró ruta de conversión', 'EXCHANGE_RATE_NOT_FOUND');
    }

    if (destino.codigo !== principal.codigo && !destinoPrincipalRate) {
      throw new ExchangeServiceError('No se encontró ruta de conversión', 'EXCHANGE_RATE_NOT_FOUND');
    }

    const tasaOrigen = origen.codigo === principal.codigo ? 1 : origenPrincipalRate!.tasa;
    const tasaDestino = destino.codigo === principal.codigo ? 1 : destinoPrincipalRate!.tasa;
    const tasaAplicada = Number((tasaOrigen / tasaDestino).toFixed(6));

    return {
      montoOriginal: monto,
      montoConvertido: Number((monto * tasaAplicada).toFixed(4)),
      tasaAplicada,
      monedaOrigen: origen.codigo,
      monedaDestino: destino.codigo,
      ruta: 'via_principal',
      tasaId:
        origenPrincipalRate && destinoPrincipalRate
          ? `${origenPrincipalRate.tasaId}:${destinoPrincipalRate.tasaId}`
          : origenPrincipalRate?.tasaId ?? destinoPrincipalRate?.tasaId,
        effectiveAt:
          origenPrincipalRate && destinoPrincipalRate
          ? new Date(
              Math.max(
                new Date(origenPrincipalRate.fechaVigencia).getTime(),
                new Date(destinoPrincipalRate.fechaVigencia).getTime(),
              ),
            ).toISOString()
          : toIsoDate(origenPrincipalRate?.fechaVigencia ?? destinoPrincipalRate?.fechaVigencia),
    };
  }

  /**
   * @description Convierte un monto de una moneda a otra
   * @param {number} monto - Monto a convertir
   * @param {string} monedaOrigen - Código de la moneda origen
   * @param {string} monedaDestino - Código de la moneda destino
   * @returns {Promise<number>} Monto convertido
   */
  static async convertAmount(
    monto: number,
    monedaOrigen: string,
    monedaDestino: string,
    provider: ExchangeRateProvider = exchangeRateProvider,
  ): Promise<number> {
    const quote = await this.quoteConversion(
      { monto, monedaOrigen, monedaDestino },
      provider,
    );

    return quote.montoConvertido;
  }

  /**
   * @description Obtiene la moneda principal del sistema.
   * @returns {Promise<{codigo: string}>} Moneda principal.
   */
  static async getMainCurrency(provider: ExchangeRateProvider = exchangeRateProvider) {
    const monedaPrincipal = await provider.getPrincipalCurrency();

    if (!monedaPrincipal) {
      throw new ExchangeServiceError(
        'No se ha configurado una moneda principal',
        'NO_MAIN_CURRENCY',
      );
    }

    return monedaPrincipal;
  }

  /**
   * @description Convierte un monto a la moneda principal
   * @param {number} monto - Monto a convertir
   * @param {string} monedaOrigen - Código de la moneda origen
   * @returns {Promise<{montoEnPrincipal: number, tasa: number}>} Monto convertido y tasa aplicada
   */
  static async convertToMainCurrency(
    monto: number,
    monedaOrigen: string,
    provider: ExchangeRateProvider = exchangeRateProvider,
  ): Promise<{ montoEnPrincipal: number; tasa: number }> {
    const monedaPrincipal = await this.getMainCurrency(provider)

    if (monedaOrigen === monedaPrincipal.codigo) {
      return { montoEnPrincipal: monto, tasa: 1 }
    }

    const quote = await this.quoteConversion(
      { monto, monedaOrigen, monedaDestino: monedaPrincipal.codigo },
      provider,
    );

    return { montoEnPrincipal: quote.montoConvertido, tasa: quote.tasaAplicada }
  }
}
