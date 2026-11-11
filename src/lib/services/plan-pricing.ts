import { prisma } from '@/lib/prisma';

const REFERRAL_DISCOUNT_BY_PLAN_NAME: Record<string, number> = {
  'básico': 5,
  basico: 5,
  profesional: 10,
  empresarial: 15,
  enterprise: 15,
};

/**
 * @description Devuelve el descuento de referido definido para un plan comercial.
 * @param {string} planName - Nombre del plan.
 * @returns {number} Descuento en USD o cero para planes no reconocidos.
 */
export function getPlanReferralDiscountUsd(planName: string): number {
  return REFERRAL_DISCOUNT_BY_PLAN_NAME[planName.trim().toLowerCase()] ?? 0;
}

/**
 * @description Redondea un monto a 2 decimales.
 * @param {number} value - Monto a redondear.
 * @returns {number} Monto redondeado.
 */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * @description Calcula el precio con el descuento específico del plan.
 * @param {number} planPrecio - Precio base del plan en USD.
 * @param {number} referralDiscountUsd - Descuento por referido del plan.
 * @returns {number} Precio referido (nunca negativo).
 */
export function getReferralPrice(planPrecio: number, referralDiscountUsd: number): number {
  return roundCurrency(Math.max(0, planPrecio - referralDiscountUsd));
}

/**
 * @description Resuelve el precio de lista y final que debe registrarse en una
 * licencia según si el tenant es referido o no. El precio de lista es siempre
 * el precio base del plan (la comisión se calcula sobre este); el precio final
 * aplica el descuento por referido.
 * @param {number} planPrecio - Precio base del plan en USD.
 * @param {boolean} isReferred - Indica si el tenant se registró por referido.
 * @param {number} referralDiscountUsd - Descuento por referido del plan.
 * @returns {{ listPriceUsd: number; finalPriceUsd: number }} Precios para la licencia.
 */
export function resolveLicensePricing(
  planPrecio: number,
  isReferred: boolean,
  referralDiscountUsd: number,
): { listPriceUsd: number; finalPriceUsd: number } {
  return {
    listPriceUsd: roundCurrency(planPrecio),
    finalPriceUsd: isReferred
      ? getReferralPrice(planPrecio, referralDiscountUsd)
      : roundCurrency(planPrecio),
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
