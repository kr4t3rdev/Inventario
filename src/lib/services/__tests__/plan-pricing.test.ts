import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    affiliateReferral: { findUnique: vi.fn() },
    salesAgentReferral: { findUnique: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  REFERRAL_DISCOUNT_USD,
  getReferralPrice,
  isTenantReferred,
  resolveLicensePricing,
  roundCurrency,
} from '@/lib/services/plan-pricing';

describe('plan-pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getReferralPrice', () => {
    it('aplica $5 USD de descuento al precio base', () => {
      expect(getReferralPrice(40)).toBe(35);
      expect(getReferralPrice(80)).toBe(75);
      expect(getReferralPrice(110)).toBe(105);
    });

    it('nunca devuelve un precio negativo', () => {
      expect(getReferralPrice(3)).toBe(0);
      expect(getReferralPrice(0)).toBe(0);
    });

    it('respeta el descuento configurado', () => {
      expect(REFERRAL_DISCOUNT_USD).toBe(5);
    });
  });

  describe('resolveLicensePricing', () => {
    it('usa el precio base cuando el tenant no es referido', () => {
      expect(resolveLicensePricing(40, false)).toEqual({
        listPriceUsd: 40,
        finalPriceUsd: 40,
      });
    });

    it('mantiene el precio base como listPrice y descuenta solo el final cuando es referido', () => {
      expect(resolveLicensePricing(40, true)).toEqual({
        listPriceUsd: 40,
        finalPriceUsd: 35,
      });
      expect(resolveLicensePricing(110, true)).toEqual({
        listPriceUsd: 110,
        finalPriceUsd: 105,
      });
    });
  });

  describe('roundCurrency', () => {
    it('redondea a 2 decimales', () => {
      expect(roundCurrency(35.005)).toBe(35.01);
      expect(roundCurrency(39.999)).toBe(40);
    });
  });

  describe('isTenantReferred', () => {
    it('devuelve true si existe un referido de afiliado', async () => {
      vi.mocked(prisma.affiliateReferral.findUnique).mockResolvedValue({
        referralId: 'ref-1',
      });
      vi.mocked(prisma.salesAgentReferral.findUnique).mockResolvedValue(null);

      await expect(isTenantReferred('tenant-1')).resolves.toBe(true);
    });

    it('devuelve true si existe un referido de Gestor de Ventas', async () => {
      vi.mocked(prisma.affiliateReferral.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.salesAgentReferral.findUnique).mockResolvedValue({
        salesAgentReferralId: 'sales-ref-1',
      });

      await expect(isTenantReferred('tenant-1')).resolves.toBe(true);
    });

    it('devuelve false si el tenant no tiene atribución', async () => {
      vi.mocked(prisma.affiliateReferral.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.salesAgentReferral.findUnique).mockResolvedValue(null);

      await expect(isTenantReferred('tenant-1')).resolves.toBe(false);
    });
  });
});
