import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';

import {
  FxEvidenceService,
  FX_EVIDENCE_SOURCE_TYPES,
} from './fx-evidence-service';

const policyMock = vi.hoisted(() => ({ getRequiredTenantAccountingPolicy: vi.fn() }));
vi.mock('@/features/contabilidad/services/tenant-accounting-policy-service', () => policyMock);

describe('FxEvidenceService', () => {
  const db = {
    cuentaBancaria: { findMany: vi.fn() },
    inyeccionCapital: { findMany: vi.fn() },
    fxEvidence: { create: vi.fn(), findUnique: vi.fn() },
    tenantAccountingPolicy: { findUnique: vi.fn() },
  };
  const provider = { getRateAsOf: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    policyMock.getRequiredTenantAccountingPolicy.mockResolvedValue({
      tenantId: 'tenant-1',
      functionalCurrencyCode: 'CUP',
    });
    db.cuentaBancaria.findMany.mockResolvedValue([
      { cuentaId: 'bank-usd', saldo: 100, moneda: 'USD' },
    ]);
    db.inyeccionCapital.findMany.mockResolvedValue([
      {
        id: 'capital-usd',
        tipo: 'CAPITAL_SOCIAL',
        montoRecibido: 200,
        moneda: 'USD',
        saldoPendiente: null,
        fechaRegistro: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    provider.getRateAsOf.mockResolvedValue({
      tasaId: 'rate-24',
      tasa: 24,
      fechaVigencia: new Date('2026-01-01T00:00:00Z'),
    });
    db.fxEvidence.findUnique.mockResolvedValue(null);
    db.fxEvidence.create.mockImplementation(async ({ data }: { data: unknown }) => ({
      fxEvidenceId: 'evidence-1',
      ...data,
    }));
  });

  it('captura bancos e inyecciones con tasa elegible al corte', async () => {
    const service = new FxEvidenceService(db as never, provider as never);
    const boundaryAt = new Date('2026-03-15T12:00:00Z');

    const result = await service.captureEligible({ tenantId: 'tenant-1', boundaryAt });

    expect(provider.getRateAsOf).toHaveBeenCalledTimes(2);
    expect(provider.getRateAsOf).toHaveBeenCalledWith(expect.objectContaining({
      sourceCurrency: 'USD',
      targetCurrency: 'CUP',
      boundaryAt,
    }));
    expect(provider.getRateAsOf).toHaveBeenNthCalledWith(2, expect.objectContaining({
      sourceCurrency: 'USD',
      targetCurrency: 'CUP',
      boundaryAt: new Date('2026-01-01T00:00:00Z'),
    }));
    expect(db.fxEvidence.create).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ capturedCount: 2, idempotentCount: 0, skippedCount: 0 });
    expect(db.fxEvidence.create.mock.calls[0][0].data).toMatchObject({
      tenantId: 'tenant-1',
      sourceType: FX_EVIDENCE_SOURCE_TYPES.BANK_ACCOUNT,
      originalAmount: 100,
      originalCurrency: 'USD',
      functionalAmount: 2400,
      functionalCurrency: 'CUP',
      exchangeRate: 24,
      rateEffectiveAt: new Date('2026-01-01T00:00:00Z'),
      fxCatalogRateId: 'rate-24',
    });
  });

  it('es idempotente para la misma huella y no guarda sin tasa elegible', async () => {
    const existingEvidence = { fxEvidenceId: 'existing', evidenceFingerprint: 'same' };
    db.fxEvidence.findUnique
      .mockResolvedValueOnce(existingEvidence)
      .mockResolvedValueOnce(null);
    provider.getRateAsOf
      .mockResolvedValueOnce({
        tasaId: 'rate-24',
        tasa: 24,
        fechaVigencia: new Date('2026-01-01T00:00:00Z'),
      })
      .mockResolvedValueOnce(null);
    const service = new FxEvidenceService(db as never, provider as never);

    const result = await service.captureEligible({
      tenantId: 'tenant-1',
      boundaryAt: new Date('2026-03-15T12:00:00Z'),
    });

    expect(result.idempotentCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(db.fxEvidence.create).not.toHaveBeenCalled();
    expect(result.skipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ issue: 'MISSING_RATE' }),
    ]));
  });

  it('usa buildAppliedFxEvidence como fuente de la huella persistida', () => {
    const evidence = buildAppliedFxEvidence({
      originalAmount: 100,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: 24,
      convertedAmount: 2400,
      rateEffectiveAt: new Date('2026-01-01T00:00:00Z'),
      source: 'current-balance-fx-capture',
      fxCatalogRateId: 'rate-24',
    });

    expect(evidence.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});
