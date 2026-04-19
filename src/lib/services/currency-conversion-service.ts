import prisma from '@/lib/prisma'

/**
 * @description Servicio para conversión de monedas
 */
export class CurrencyConversionService {
  /**
   * @description Obtiene la tasa de cambio más reciente para una moneda
   * @param {string} monedaOrigen - Código de la moneda origen
   * @param {string} monedaDestino - Código de la moneda destino
   * @returns {Promise<number>} Tasa de cambio
   */
  static async getExchangeRate(
    monedaOrigen: string,
    monedaDestino: string
  ): Promise<number> {
    // Si son la misma moneda, retornar 1
    if (monedaOrigen === monedaDestino) {
      return 1
    }

    // Obtener la tasa de cambio más reciente
    const tasaCambio = await prisma.tasaCambio.findFirst({
      where: {
        monedaOrigenId: monedaOrigen,
        monedaDestino: monedaDestino
      },
      orderBy: { fechaVigencia: 'desc' }
    })

    if (!tasaCambio) {
      throw new Error(
        `No se encontró tasa de cambio para ${monedaOrigen} → ${monedaDestino}`
      )
    }

    return Number(tasaCambio.tasa)
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
    monedaDestino: string
  ): Promise<number> {
    const tasa = await this.getExchangeRate(monedaOrigen, monedaDestino)
    return monto * tasa
  }

  /**
   * @description Obtiene la moneda principal del sistema
   * @returns {Promise<{codigo: string}>} Moneda principal
   */
  static async getMainCurrency() {
    const monedaPrincipal = await prisma.moneda.findFirst({
      where: { esPrincipal: true }
    })

    if (!monedaPrincipal) {
      throw new Error('No se ha configurado una moneda principal')
    }

    return monedaPrincipal
  }

  /**
   * @description Convierte un monto a la moneda principal
   * @param {number} monto - Monto a convertir
   * @param {string} monedaOrigen - Código de la moneda origen
   * @returns {Promise<{montoEnPrincipal: number, tasa: number}>} Monto convertido y tasa aplicada
   */
  static async convertToMainCurrency(
    monto: number,
    monedaOrigen: string
  ): Promise<{ montoEnPrincipal: number; tasa: number }> {
    const monedaPrincipal = await this.getMainCurrency()

    if (monedaOrigen === monedaPrincipal.codigo) {
      return { montoEnPrincipal: monto, tasa: 1 }
    }

    const tasa = await this.getExchangeRate(monedaOrigen, monedaPrincipal.codigo)
    const montoEnPrincipal = monto * tasa

    return { montoEnPrincipal, tasa }
  }
}
