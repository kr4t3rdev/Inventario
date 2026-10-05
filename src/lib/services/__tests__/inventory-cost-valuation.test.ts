import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveInventoryCostValuation,
  resolveTenantInventoryCostValuation,
} from '@/lib/services/inventory-cost-valuation';

const rateProvider = vi.hoisted(() => ({ getRateAsOfExact: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
  exchangeRateProvider: rateProvider,
}));

describe('resolveInventoryCostValuation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preserves the amount when the purchase and functional currencies match', () => {
    const result = resolveInventoryCostValuation({
      amount: '75.25',
      sourceCurrency: 'USD',
      functionalCurrency: 'USD',
      effectiveAt: null,
    });

    expect(result.amount.toString()).toBe('75.25');
    expect(result.exchangeRate.toString()).toBe('1');
    expect(result.evidence.fxProvenanceKind).toBe('SAME_CURRENCY');
  });

  it('converts source currency to the tenant functional currency through CUP rates', () => {
    const result = resolveInventoryCostValuation({
      amount: '24',
      sourceCurrency: 'EUR',
      functionalCurrency: 'USD',
      sourceToCupRate: '25',
      functionalToCupRate: '24',
      effectiveAt: new Date('2026-10-01T00:00:00.000Z'),
    });

    expect(result.amount.toString()).toBe('25');
    expect(result.exchangeRate.toString()).toBe('1.0416666666666666667');
    expect(result.evidence.functionalCurrency).toBe('USD');
  });

  it('produce evidencia v2 (no v1) para triangulación extranjera con cociente no terminante', () => {
    const result = resolveInventoryCostValuation({
      amount: '100',
      sourceCurrency: 'EUR',
      functionalCurrency: 'USD',
      sourceToCupRate: '26',
      functionalToCupRate: '24',
      effectiveAt: new Date('2026-10-01T00:00:00.000Z'),
    });

    expect(result.evidence.fxEvidenceVersion).toBe(2);
    expect(result.amount.toString()).toBe('108.3333');
    expect(result.evidence.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects a cross-currency cost without historical rate evidence', () => {
    expect(() => resolveInventoryCostValuation({
      amount: 100,
      sourceCurrency: 'CUP',
      functionalCurrency: 'USD',
      effectiveAt: new Date('2026-10-01T00:00:00.000Z'),
    })).toThrow('COST_FX_RATE_MISSING');
  });

  it('resolves CUP purchase cost into a non-CUP functional currency using historical FX', async () => {
    rateProvider.getRateAsOfExact.mockResolvedValueOnce({
      tasa: '24', tasaId: 'usd-cup-2026-10',
    });
    const result = await resolveTenantInventoryCostValuation({} as never, {
      amount: 240,
      sourceCurrency: 'CUP',
      functionalCurrency: 'USD',
      effectiveAt: new Date('2026-10-01T00:00:00.000Z'),
    });

    expect(result.amount.toString()).toBe('10');
    expect(rateProvider.getRateAsOfExact).toHaveBeenCalledWith(expect.objectContaining({
      sourceCurrency: 'USD', targetCurrency: 'CUP', client: expect.anything(),
    }));
  });

  it('uses the entered source-to-CUP rate and historical functional-to-CUP rate', async () => {
    rateProvider.getRateAsOfExact.mockResolvedValueOnce({
      tasa: '24', tasaId: 'usd-cup-2026-10',
    });
    const result = await resolveTenantInventoryCostValuation({} as never, {
      amount: 24,
      sourceCurrency: 'EUR',
      functionalCurrency: 'USD',
      exchangeRateToCup: 25,
      effectiveAt: new Date('2026-10-01T00:00:00.000Z'),
    });

    expect(result.amount.toString()).toBe('25');
    expect(rateProvider.getRateAsOfExact).toHaveBeenCalledTimes(1);
  });
});
