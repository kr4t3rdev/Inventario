import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    affiliateReferral: { findUnique: vi.fn() },
    salesAgentReferral: { findUnique: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import {
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
    it('usa el descuento específico del plan', () => {
      expect(getReferralPrice(30, 5)).toBe(25);
      expect(getReferralPrice(60, 10)).toBe(50);
      expect(getReferralPrice(90, 15)).toBe(75);
    });

    it('nunca devuelve un precio negativo', () => {
      expect(getReferralPrice(3, 5)).toBe(0);
      expect(getReferralPrice(0, 5)).toBe(0);
    });
  });

  describe('resolveLicensePricing', () => {
    it('usa el precio base cuando el tenant no es referido', () => {
      expect(resolveLicensePricing(30, false, 5)).toEqual({
        listPriceUsd: 30,
        finalPriceUsd: 30,
      });
    });

    it('mantiene el precio base como listPrice y descuenta solo el final cuando es referido', () => {
      expect(resolveLicensePricing(30, true, 5)).toEqual({
        listPriceUsd: 30,
        finalPriceUsd: 25,
      });
      expect(resolveLicensePricing(60, true, 10)).toEqual({
        listPriceUsd: 60,
        finalPriceUsd: 50,
      });
      expect(resolveLicensePricing(90, true, 15)).toEqual({
        listPriceUsd: 90,
        finalPriceUsd: 75,
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
      } as any);
      vi.mocked(prisma.salesAgentReferral.findUnique).mockResolvedValue(null);

      await expect(isTenantReferred('tenant-1')).resolves.toBe(true);
    });

    it('devuelve true si existe un referido de Gestor de Ventas', async () => {
      vi.mocked(prisma.affiliateReferral.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.salesAgentReferral.findUnique).mockResolvedValue({
        salesAgentReferralId: 'sales-ref-1',
      } as any);

      await expect(isTenantReferred('tenant-1')).resolves.toBe(true);
    });

    it('devuelve false si el tenant no tiene atribución', async () => {
      vi.mocked(prisma.affiliateReferral.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.salesAgentReferral.findUnique).mockResolvedValue(null);

      await expect(isTenantReferred('tenant-1')).resolves.toBe(false);
    });
  });
});
