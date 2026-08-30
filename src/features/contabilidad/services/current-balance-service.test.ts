import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  cuentaBancaria: { findMany: vi.fn() },
  stockUbicacion: { findMany: vi.fn() },
  compraDocumentoItem: { findMany: vi.fn() },
  cuentaPorCobrar: { findMany: vi.fn() },
  cuentaPorPagar: { findMany: vi.fn() },
  inyeccionCapital: { findMany: vi.fn() },
  cierreContable: { findMany: vi.fn() },
  periodoContable: { findMany: vi.fn() },
  fxEvidence: { findMany: vi.fn() },
}));

const tenantPolicyMock = vi.hoisted(() => ({
  getRequiredTenantAccountingPolicy: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/features/contabilidad/services/tenant-accounting-policy-service', () => tenantPolicyMock);

describe('getCurrentBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantPolicyMock.getRequiredTenantAccountingPolicy.mockResolvedValue({
      tenantId: 'tenant-1',
      functionalCurrencyCode: 'CUP',
    });
    prismaMock.cuentaBancaria.findMany.mockResolvedValue([
      { cuentaId: 'cup-bank', saldo: 1000, moneda: 'CUP' },
      { cuentaId: 'usd-bank', saldo: 100, moneda: 'USD' },
    ]);
    prismaMock.stockUbicacion.findMany.mockResolvedValue([{
      productoId: 'product-1',
      cantidad: 5,
      producto: { precioCosto: 10 },
    }]);
    prismaMock.compraDocumentoItem.findMany.mockResolvedValue([{
      compraDocumentoItemId: 'layer-1',
      productoId: 'product-1',
      cantidad: 3,
      precioUnitario: 7,
      allocations: [{ cantidad: 1 }],
    }]);
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([{
      id: 'ar-1',
      montoDeuda: 500,
      montoPagado: 200,
      estado: 'PARCIAL',
    }]);
    prismaMock.cuentaPorPagar.findMany.mockResolvedValue([
      {
        cuentaPorPagarId: 'ap-cup', saldoPendiente: 70, moneda: 'CUP',
        estado: 'PENDIENTE', deletedAt: null,
      },
      {
        cuentaPorPagarId: 'ap-usd', saldoPendiente: 20, moneda: 'USD',
        estado: 'PENDIENTE', deletedAt: null,
      },
    ]);
    prismaMock.inyeccionCapital.findMany.mockResolvedValue([
      {
        id: 'capital-cup', tipo: 'CAPITAL_SOCIAL', montoRecibido: 500,
        moneda: 'CUP', fechaRegistro: new Date('2026-01-01T00:00:00Z'),
        estado: null, saldoPendiente: null,
      },
      {
        id: 'capital-usd', tipo: 'CAPITAL_SOCIAL', montoRecibido: 200,
        moneda: 'USD', fechaRegistro: new Date('2026-01-01T00:00:00Z'),
        estado: null, saldoPendiente: null,
      },
      {
        id: 'debt-cup', tipo: 'DEUDA_EXTERNA', montoRecibido: 500,
        moneda: 'CUP', fechaRegistro: new Date('2026-01-01T00:00:00Z'),
        estado: 'ACTIVA', saldoPendiente: 300,
      },
    ]);
    prismaMock.cierreContable.findMany.mockResolvedValue([{
      cierreId: 'closure-1',
      tipo: 'anual',
      estado: 'aprobado',
      aprobadoPor: 'user-1',
      fechaFin: new Date('2025-12-31T23:59:59Z'),
      ganancias: 100,
      perdidas: 20,
    }]);
    prismaMock.periodoContable.findMany.mockResolvedValue([]);
    prismaMock.fxEvidence.findMany.mockResolvedValue([]);
  });

  it('construye el balance con costos remanentes y cobertura explícita', async () => {
    const { getCurrentBalance } = await import(
      '@/features/contabilidad/services/current-balance-service'
    );
    const result = await getCurrentBalance({
      tenantId: 'tenant-1',
      asOf: new Date('2026-08-20T12:00:00Z'),
      currentResult: 394,
      currentResultYear: 2026,
    });

    expect(result.assets).toEqual({
      cashAndBanks: 1000,
      inventory: { historical: 14, estimated: 30, total: 44 },
      receivables: 300,
      total: 1344,
    });
    expect(result.liabilities).toEqual({ payables: 70, externalDebt: 300, total: 370 });
    expect(result.equity).toEqual({
      capital: 500,
      retainedEarnings: 80,
      currentResult: 394,
      total: 974,
    });
    expect(result.equation).toEqual({
      assets: 1344,
      liabilitiesAndEquity: 1344,
      difference: 0,
      status: 'INCOMPLETO',
    });
    expect(result.coverage.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'bank', itemId: 'usd-bank' }),
      expect.objectContaining({ source: 'payable', itemId: 'ap-usd' }),
      expect.objectContaining({ source: 'capital', itemId: 'capital-usd' }),
    ]));
  });

  it('comparte filtros activos y respeta tenant y fecha de corte', async () => {
    const { getCurrentBalance } = await import(
      '@/features/contabilidad/services/current-balance-service'
    );
    const asOf = new Date('2026-08-20T12:00:00Z');
    await getCurrentBalance({
      tenantId: 'tenant-1',
      asOf,
      currentResult: 0,
      currentResultYear: 2026,
    });

    expect(prismaMock.cuentaPorCobrar.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', estado: { in: ['PENDIENTE', 'PARCIAL'] } },
    }));
    expect(prismaMock.cuentaPorPagar.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId: 'tenant-1',
        deletedAt: null,
        estado: { in: ['PENDIENTE', 'PARCIAL'] },
      },
    }));
    expect(prismaMock.inyeccionCapital.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cuentaBancaria: { tenantId: 'tenant-1' }, fechaRegistro: { lte: asOf } },
    }));
  });

  it('no mezcla CxC extranjera ni duplica un año ya cerrado', async () => {
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([{
      id: 'foreign-loan',
      montoDeuda: 100,
      montoPagado: 20,
      estado: 'PARCIAL',
      prestamoCash: { moneda: 'USD' },
    }]);
    prismaMock.cierreContable.findMany.mockResolvedValue([{
      cierreId: 'closure-2025',
      tipo: 'anual',
      estado: 'aprobado',
      aprobadoPor: 'user-1',
      fechaFin: new Date('2025-12-31T23:59:59Z'),
      ganancias: 300,
      perdidas: 100,
    }]);

    const { getCurrentBalance } = await import(
      '@/features/contabilidad/services/current-balance-service'
    );
    const result = await getCurrentBalance({
      tenantId: 'tenant-1',
      asOf: new Date('2026-08-20T12:00:00Z'),
      currentResult: 200,
      currentResultYear: 2025,
    });

    expect(result.assets.receivables).toBe(0);
    expect(result.equity.retainedEarnings).toBe(200);
    expect(result.equity.currentResult).toBe(0);
    expect(result.coverage.parts).toContainEqual({
      source: 'receivable',
      itemId: 'foreign-loan',
      issue: 'MISSING_CONVERSION',
      affectedAmount: 80,
    });
  });

  it('usa la última evidencia FX válida del corte para bancos y capital extranjero', async () => {
    prismaMock.fxEvidence.findMany.mockResolvedValue([
      {
        fxEvidenceId: 'evidence-capital',
        tenantId: 'tenant-1',
        sourceType: 'CAPITAL_INJECTION',
        sourceId: 'capital-usd',
        originalAmount: 200,
        originalCurrency: 'USD',
        functionalAmount: 4800,
        functionalCurrency: 'CUP',
        exchangeRate: 24,
        rateEffectiveAt: new Date('2026-01-01T00:00:00Z'),
        fxCatalogRateId: 'rate-24',
        provenance: 'MANUAL_GOVERNED',
        source: 'current-balance-fx-capture',
        evidence: {},
        evidenceFingerprint: 'fingerprint-capital',
        evidenceVersion: 1,
        capturedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        fxEvidenceId: 'evidence-bank',
        tenantId: 'tenant-1',
        sourceType: 'BANK_ACCOUNT',
        sourceId: 'usd-bank',
        originalAmount: 100,
        originalCurrency: 'USD',
        functionalAmount: 2400,
        functionalCurrency: 'CUP',
        exchangeRate: 24,
        rateEffectiveAt: new Date('2026-01-01T00:00:00Z'),
        fxCatalogRateId: 'rate-24',
        provenance: 'MANUAL_GOVERNED',
        source: 'current-balance-fx-capture',
        evidence: {},
        evidenceFingerprint: 'fingerprint-bank',
        evidenceVersion: 1,
        capturedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);

    const { getCurrentBalance } = await import(
      '@/features/contabilidad/services/current-balance-service'
    );
    const result = await getCurrentBalance({
      tenantId: 'tenant-1',
      asOf: new Date('2026-08-20T12:00:00Z'),
      currentResult: 394,
      currentResultYear: 2026,
    });

    expect(result.assets.cashAndBanks).toBe(3400);
    expect(result.equity.capital).toBe(5300);
    expect(result.coverage.parts).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: 'usd-bank' }),
      expect.objectContaining({ itemId: 'capital-usd' }),
    ]));
    expect(prismaMock.fxEvidence.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1', cutoffAt: { lte: expect.any(Date) } }),
    }));
  });

  it('conserva unresolvedParts cuando la evidencia no coincide con el saldo actual', async () => {
    prismaMock.fxEvidence.findMany.mockResolvedValue([{
      fxEvidenceId: 'stale-bank-evidence',
      tenantId: 'tenant-1',
      sourceType: 'BANK_ACCOUNT',
      sourceId: 'usd-bank',
      originalAmount: 99,
      originalCurrency: 'USD',
      functionalAmount: 2376,
      functionalCurrency: 'CUP',
      exchangeRate: 24,
      rateEffectiveAt: new Date('2026-01-01T00:00:00Z'),
      fxCatalogRateId: 'rate-24',
      provenance: 'MANUAL_GOVERNED',
      source: 'current-balance-fx-capture',
      evidence: {},
      evidenceFingerprint: 'stale-bank',
      evidenceVersion: 1,
      capturedAt: new Date('2026-01-01T00:00:00Z'),
    }]);

    const { getCurrentBalance } = await import(
      '@/features/contabilidad/services/current-balance-service'
    );
    const result = await getCurrentBalance({
      tenantId: 'tenant-1',
      asOf: new Date('2026-08-20T12:00:00Z'),
      currentResult: 0,
      currentResultYear: 2026,
    });

    expect(result.coverage.parts).toContainEqual(expect.objectContaining({
      source: 'bank',
      itemId: 'usd-bank',
      issue: 'INCONSISTENT_CONVERSION_EVIDENCE',
    }));
    expect(result.assets.cashAndBanks).toBe(1000);
  });

  it('usa el resultado anual del snapshot aprobado como utilidad retenida', async () => {
    const { hashFinancialSnapshot } = await import(
      '@/features/contabilidad/services/historical-financial-report-service'
    );
    const snapshotPayload = {
      version: 2,
      cutoffAt: '2026-01-02T12:00:00.000Z',
      resultThrough: '2025-12-31T23:59:59.000Z',
      capturedAt: '2026-01-02T12:00:00.000Z',
      functionalCurrency: 'CUP',
      balance: {},
      result: { annual: { reconciledResult: 125 } },
      coverage: {
        balanceComplete: true,
        balanceUnresolvedCount: 0,
        resultIncidentCount: 0,
        resultEstimateCount: 0,
      },
      sources: {},
    };
    const snapshotHash = hashFinancialSnapshot(snapshotPayload);
    prismaMock.cierreContable.findMany.mockResolvedValue([]);
    prismaMock.periodoContable.findMany.mockResolvedValue([{
      periodoId: 'period-2025',
      fechaFin: new Date('2025-12-31T23:59:59Z'),
      resumenJson: snapshotPayload,
      hashIntegridad: snapshotHash,
      snapshotPeriodos: [{
        version: 1,
        resumenJson: snapshotPayload,
        hashIntegridad: snapshotHash,
      }],
    }]);

    const { getCurrentBalance } = await import(
      '@/features/contabilidad/services/current-balance-service'
    );
    const result = await getCurrentBalance({
      tenantId: 'tenant-1',
      asOf: new Date('2026-08-20T12:00:00Z'),
      currentResult: 200,
      currentResultYear: 2026,
    });

    expect(result.equity.retainedEarnings).toBe(125);
  });

  it('no usa un cierre legacy cuando existe evidencia v2 aprobada inválida', async () => {
    prismaMock.cierreContable.findMany.mockResolvedValue([{
      cierreId: 'legacy-2025',
      tipo: 'anual',
      estado: 'aprobado',
      aprobadoPor: 'user-1',
      fechaFin: new Date('2025-12-31T23:59:59Z'),
      ganancias: 300,
      perdidas: 0,
    }]);
    prismaMock.periodoContable.findMany.mockResolvedValue([{
      periodoId: 'period-2025',
      fechaFin: new Date('2025-12-31T23:59:59Z'),
      resumenJson: { version: 2 },
      hashIntegridad: 'parent-hash',
      snapshotPeriodos: [{
        version: 1,
        resumenJson: { version: 2 },
        hashIntegridad: 'invalid-hash',
      }],
    }]);

    const { getCurrentBalance } = await import(
      '@/features/contabilidad/services/current-balance-service'
    );
    const result = await getCurrentBalance({
      tenantId: 'tenant-1',
      asOf: new Date('2026-08-20T12:00:00Z'),
      currentResult: 200,
      currentResultYear: 2026,
    });

    expect(result.equity.retainedEarnings).toBe(0);
  });
});
