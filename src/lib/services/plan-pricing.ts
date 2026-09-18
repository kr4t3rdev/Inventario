import { prisma } from '@/lib/prisma';

/**
 * @description Descuento por referido en USD, aplicado al precio base de cada
 * plan cuando el tenant se registró por un link de referido. Precios de lista:
 * Básico $40 → $35, Profesional $80 → $75, Empresarial $110 → $105.
 */
export const REFERRAL_DISCOUNT_USD = 5;

/**
 * @description Redondea un monto a 2 decimales.
 * @param {number} value - Monto a redondear.
 * @returns {number} Monto redondeado.
 */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * @description Calcula el precio con descuento por referido.
 * @param {number} planPrecio - Precio base del plan en USD.
 * @returns {number} Precio referido (nunca negativo).
 */
export function getReferralPrice(planPrecio: number): number {
  return roundCurrency(Math.max(0, planPrecio - REFERRAL_DISCOUNT_USD));
}

/**
 * @description Resuelve el precio de lista y final que debe registrarse en una
 * licencia según si el tenant es referido o no. El precio de lista es siempre
 * el precio base del plan (la comisión se calcula sobre este); el precio final
 * aplica el descuento por referido. Ejemplo Básico: {40, 35} si es referido.
 * @param {number} planPrecio - Precio base del plan en USD.
 * @param {boolean} isReferred - Indica si el tenant se registró por referido.
 * @returns {{ listPriceUsd: number; finalPriceUsd: number }} Precios para la licencia.
 */
export function resolveLicensePricing(
  planPrecio: number,
  isReferred: boolean,
): { listPriceUsd: number; finalPriceUsd: number } {
  return {
    listPriceUsd: roundCurrency(planPrecio),
    finalPriceUsd: isReferred ? getReferralPrice(planPrecio) : roundCurrency(planPrecio),
  };
}

/**
 * @description Determina si un tenant fue atribuido por referido (afiliado o
 * Gestor de Ventas). Un tenant referido conserva el descuento en sus licencias.
 * @param {string} tenantId - ID del tenant.
 * @returns {Promise<boolean>} true si el tenant tiene una atribución activa.
 */
export async function isTenantReferred(tenantId: string): Promise<boolean> {
  const [affiliateReferral, salesAgentReferral] = await Promise.all([
    prisma.affiliateReferral.findUnique({
      where: { referredTenantId: tenantId },
      select: { referralId: true },
    }),
    prisma.salesAgentReferral.findUnique({
      where: { referredTenantId: tenantId },
      select: { salesAgentReferralId: true },
    }),
  ]);

  return Boolean(affiliateReferral || salesAgentReferral);
}
