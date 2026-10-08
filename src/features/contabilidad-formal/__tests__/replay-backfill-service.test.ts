import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';
import { computeReplayPreflightDigest, type ReplayPreflightDigestSnapshot } from '@/features/contabilidad-formal/services/replay-preflight-digest';
import {
	crearPreflightBackfill,
	aprobarPreflightBackfill,
	ejecutarBackfillAutorizado,
	recolectarCandidatos,
} from '@/features/contabilidad-formal/services/replay-backfill-service';

import { planBackfillContable, ejecutarBackfillPeriodo } from '@/features/contabilidad-formal/services/replay-backfill-service';

const db = vi.hoisted(() => ({
  reconciliacionVenta: { findMany: vi.fn() }, reconciliacionGasto: { findMany: vi.fn() },
  reconciliacionServicio: { findMany: vi.fn() }, ajusteBancario: { findMany: vi.fn() },
  transferenciaBancaria: { findMany: vi.fn() }, inyeccionCapital: { findMany: vi.fn() },
  prestamoCash: { findMany: vi.fn() }, deudaCash: { findMany: vi.fn() },
  pagosalario: { findMany: vi.fn() }, gastosDE: { findMany: vi.fn() },
  gastoCompra: { findMany: vi.fn() }, cuentaPorPagar: { findMany: vi.fn() },
  pagoDeuda: { findMany: vi.fn() }, merma: { findMany: vi.fn() },
  compraDocumento: { findMany: vi.fn() }, factura: { findMany: vi.fn() },
  anticipo: { findMany: vi.fn() }, periodoContable: { findMany: vi.fn(), findFirst: vi.fn() },
  tenantAccountingPolicy: { findUnique: vi.fn() },
  tenantMembership: { findFirst: vi.fn() },
  tenantLicense: { findFirst: vi.fn() },
  asiento: { findMany: vi.fn(), update: vi.fn() },
  replayPreflight: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  replayApproval: { create: vi.fn(), findFirst: vi.fn() },
  replayRun: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  $queryRaw: vi.fn(async () => []),
  $executeRawUnsafe: vi.fn(async () => 0),
  $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(db)),
}));
const replay = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/features/contabilidad-formal/services/posting-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/contabilidad-formal/services/posting-engine')>()),
  replayEvento: replay,
}));
const date = new Date('2026-09-15T12:00:00Z');
const period = { periodoId: 'p', codigo: '2026-09', fechaInicio: new Date('2026-09-01'), fechaFin: new Date('2026-09-30T23:59:59Z') };
const sale = (id: string, overrides: Record<string, unknown> = {}) => ({ reconciliacionId: id, fechaReconciliacion: date, venta: null, prestamoCashId: null, deudaCashId: null, tipoReconciliacion: null, monto: 10, montoConvertido: 10, moneda: 'CUP', functionalCurrency: 'CUP', tasaCambio: null, fxEvidenceFingerprint: null, ...overrides });
const adjustment = (id: string, tipo: string) => ({
  ajusteId: id, tipo, fechaOperacion: date, createdAt: date, monto: 20,
  montoConvertido: 20, moneda: 'CUP', functionalCurrency: 'CUP',
  tasaCambio: null, fxEvidenceFingerprint: null, descripcion: `Adjustment ${id}`,
});
const foreignSale = (
  id: string,
  originalValue: Prisma.Decimal | string = '10',
  rateValue: Prisma.Decimal | string = '24',
  overrides: Record<string, unknown> = {},
) => {
  const originalAmount = new Prisma.Decimal(originalValue);
  const exchangeRate = new Prisma.Decimal(rateValue);
  const convertedAmount = originalAmount.mul(exchangeRate);
  const rateEffectiveAt = new Date('2026-09-15T00:00:00.000Z');
  const source = 'manual-governed';
  const evidence = buildAppliedFxEvidenceExact({
    originalAmount,
    originalCurrency: 'USD',
    functionalCurrency: 'CUP',
    exchangeRate,
    convertedAmount,
    rateEffectiveAt,
    source,
    fxProvenanceKind: 'MANUAL_GOVERNED',
  });
  return sale(id, {
    monto: originalAmount,
    moneda: 'USD',
    montoConvertido: convertedAmount,
    functionalCurrency: 'CUP',
    tasaCambio: exchangeRate,
    rateEffectiveAt,
    fxProvenanceKind: 'MANUAL_GOVERNED',
    fxProvenanceSource: source,
    fxCatalogRateId: null,
    fxEvidenceJson: evidence.evidence,
    fxEvidenceFingerprint: evidence.evidence.fxEvidenceFingerprint,
    fxEvidenceVersion: evidence.evidence.fxEvidenceVersion,
    ...overrides,
  });
};
const sameCurrencySale = (id: string, overrides: Record<string, unknown> = {}) => {
  const amount = new Prisma.Decimal('10');
  const evidence = buildAppliedFxEvidenceExact({
    originalAmount: amount,
    originalCurrency: 'CUP',
    functionalCurrency: 'CUP',
    convertedAmount: amount,
    source: 'same-currency',
  });
  return sale(id, {
    monto: amount,
    moneda: 'CUP',
    montoConvertido: amount,
    functionalCurrency: 'CUP',
    tasaCambio: null,
    rateEffectiveAt: null,
    fxProvenanceKind: 'SAME_CURRENCY',
    fxProvenanceSource: 'same-currency',
    fxCatalogRateId: null,
    fxEvidenceJson: evidence.evidence,
    fxEvidenceFingerprint: evidence.evidence.fxEvidenceFingerprint,
    fxEvidenceVersion: evidence.evidence.fxEvidenceVersion,
    ...overrides,
  });
};

const sameCurrencyMetadata = () => ({
  moneda: 'CUP',
  montoConvertido: new Prisma.Decimal('10'),
  functionalCurrency: 'CUP',
  tasaCambio: null,
  fxEvidenceFingerprint: null,
});
const sameCurrencyValuation = () => ({
  monto: new Prisma.Decimal('10'),
  ...sameCurrencyMetadata(),
});

const verifiedForeignValuation = () => {
  const originalAmount = new Prisma.Decimal('10');
  const exchangeRate = new Prisma.Decimal('24');
  const convertedAmount = new Prisma.Decimal('240');
  const rateEffectiveAt = new Date('2026-09-15T00:00:00.000Z');
  const source = 'manual-governed';
  const evidence = buildAppliedFxEvidenceExact({
    originalAmount,
    originalCurrency: 'USD',
    functionalCurrency: 'CUP',
    exchangeRate,
    convertedAmount,
    rateEffectiveAt,
    source,
    fxProvenanceKind: 'MANUAL_GOVERNED',
  });
  return {
    moneda: 'USD',
    montoConvertido: convertedAmount,
    functionalCurrency: 'CUP',
    tasaCambio: exchangeRate,
    rateEffectiveAt,
    fxProvenanceKind: 'MANUAL_GOVERNED',
    fxProvenanceSource: source,
    fxCatalogRateId: null,
    fxEvidenceJson: evidence.evidence,
    fxEvidenceFingerprint: evidence.evidence.fxEvidenceFingerprint,
    fxEvidenceVersion: evidence.evidence.fxEvidenceVersion,
  };
};

/** @description Builds explicit balanced sale ledger evidence for service mock fixtures. */
function ledgerEvidence(snapshot: ReplayPreflightDigestSnapshot) {
  return snapshot.sources.filter((source) => source.classification !== 'OMITIDO').map((source) => {
    const line = {
      monedaOriginal: source.valuation.originalCurrency,
      montoOriginal: new Prisma.Decimal(source.valuation.originalAmount!),
      tasaCambio: source.valuation.fxRate === null ? null : new Prisma.Decimal(source.valuation.fxRate),
      fxEvidenceFingerprint: source.valuation.fxEvidenceFingerprint,
      debe: new Prisma.Decimal(source.valuation.functionalAmount!), haber: new Prisma.Decimal(0),
    };
    return {
      tenantId: snapshot.tenantId, periodoId: snapshot.period.periodId,
      replayRunId: source.classification === 'REPLAYABLE' ? 'run-1' : null,
      estado: 'CONTABILIZADO', origenTipo: source.identity.sourceType, origenId: source.identity.sourceId,
      fecha: new Date(source.semantics.fecha), descripcion: source.semantics.descripcion,
      lineas: [line, { ...line, debe: line.haber, haber: line.debe }],
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ['reconciliacionVenta', 'reconciliacionGasto', 'reconciliacionServicio', 'ajusteBancario', 'transferenciaBancaria', 'inyeccionCapital', 'prestamoCash', 'deudaCash', 'pagosalario', 'gastosDE', 'gastoCompra', 'cuentaPorPagar', 'pagoDeuda', 'merma', 'compraDocumento', 'factura', 'anticipo'] as const) db[key].findMany.mockResolvedValue([]);
  db.periodoContable.findMany.mockResolvedValue([period]); db.periodoContable.findFirst.mockResolvedValue(period);
  db.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
  db.asiento.findMany.mockResolvedValue([]); replay.mockResolvedValue({ estado: 'CONTABILIZADO' });
  db.replayPreflight.create.mockImplementation(async ({ data }) => ({ replayPreflightId: 'preflight-1', ...data }));
  db.replayPreflight.findFirst.mockImplementation(async () => ({
    replayPreflightId: 'preflight-1', tenantId: 'tenant', periodoId: 'p', requestedByUserId: 'requester',
    generatedAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 86_399_000),
    digestVersion: 2, digest: 'digest', snapshot: {}, status: 'READY',
  }));
  db.replayApproval.create.mockImplementation(async ({ data }) => ({ replayApprovalId: 'approval-1', ...data }));
  db.replayApproval.findFirst.mockImplementation(async () => ({
    replayApprovalId: 'approval-1', tenantId: 'tenant', replayPreflightId: 'preflight-1',
    requestedByUserId: 'requester', approvedByUserId: 'approver', digestVersion: 2,
    digest: 'digest', status: 'APPROVED',
  }));
  db.replayRun.create.mockImplementation(async ({ data }) => ({ replayRunId: 'run-1', ...data }));
  db.replayRun.findFirst.mockResolvedValue(null);
  db.replayRun.findUnique.mockImplementation(async () => ({
    replayRunId: 'run-1', ...db.replayRun.create.mock.calls.at(-1)![0].data,
    preflight: await db.replayPreflight.findFirst(),
    approval: await db.replayApproval.findFirst(),
  }));
  db.replayRun.update.mockImplementation(async ({ data }) => data);
  db.tenantMembership.findFirst.mockResolvedValue({
    userId: 'approver', tenantRole: 'manager', isActive: true, user: { isActive: true }, customRole: null,
  });
  db.tenantLicense.findFirst.mockResolvedValue({
    plan: { features: { 'contabilidad-formal': true } }, featureOverrides: null, features: null,
  });
});

async function ejecutarBackfillAutorizadoFixture() {
  const preflight = await crearPreflightBackfill('tenant', 'p', 'requester');
  db.replayPreflight.findFirst.mockResolvedValue(preflight);
  const approval = await aprobarPreflightBackfill('tenant', preflight.replayPreflightId, 'approver');
  db.replayPreflight.findFirst.mockResolvedValue({ ...preflight, status: 'APPROVED' });
  db.replayApproval.findFirst.mockResolvedValue(approval);
  return ejecutarBackfillAutorizado({
    tenantId: 'tenant', replayPreflightId: preflight.replayPreflightId,
    replayApprovalId: approval.replayApprovalId, actorId: 'actor',
  });
}

describe('historical replay classification', () => {
  it('retries the complete transaction after PostgreSQL serialization SQLSTATE 40001', async () => {
    const preflight = await crearPreflightBackfill('tenant', 'p', 'requester');
    const persisted = db.replayPreflight.create.mock.calls.at(-1)![0].data;
    db.replayPreflight.findFirst.mockResolvedValue({ replayPreflightId: 'preflight-1', ...persisted });
    const approval = await aprobarPreflightBackfill('tenant', 'preflight-1', 'approver');
    db.replayPreflight.findFirst.mockResolvedValue({
      replayPreflightId: 'preflight-1', ...persisted, status: 'APPROVED',
    });
    db.replayApproval.findFirst.mockResolvedValue(approval);
    let attempt = 0;
    const originalTransaction = db.$transaction.getMockImplementation();
    db.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      attempt += 1;
      if (attempt === 1) throw Object.assign(new Error('serialization conflict'), { code: '40001' });
      return callback(db);
    });

    try {
      await ejecutarBackfillAutorizado({
        tenantId: 'tenant', replayPreflightId: 'preflight-1',
        replayApprovalId: approval.replayApprovalId, actorId: 'approver',
      });

      expect(attempt).toBe(2);
      expect(db.replayRun.create).toHaveBeenCalledTimes(1);
    } finally {
      db.$transaction.mockImplementation(originalTransaction!);
    }
  });

  it('retries a posting-time serialization failure without querying the aborted transaction', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([sameCurrencySale('retry-source')]);
    const preflight = await crearPreflightBackfill('tenant', 'p', 'requester');
    const persisted = db.replayPreflight.create.mock.calls.at(-1)![0].data;
    db.replayPreflight.findFirst.mockResolvedValue({ replayPreflightId: 'preflight-1', ...persisted });
    const approval = await aprobarPreflightBackfill('tenant', 'preflight-1', 'approver');
    db.replayPreflight.findFirst.mockResolvedValue({
      replayPreflightId: 'preflight-1', ...persisted, status: 'APPROVED',
    });
    db.replayApproval.findFirst.mockResolvedValue(approval);
    db.asiento.findMany.mockImplementation(async (args) => args?.include?.lineas
      ? ledgerEvidence(persisted.snapshot) : []);
    replay.mockRejectedValueOnce(Object.assign(new Error('serialization conflict'), {
      code: 'P2010', meta: { code: '40001' },
    }));
    replay.mockResolvedValue({ estado: 'OMITIDO' });
    db.$transaction.mockClear();

    await ejecutarBackfillAutorizado({
      tenantId: 'tenant', replayPreflightId: 'preflight-1',
      replayApprovalId: approval.replayApprovalId, actorId: 'approver',
    });

    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(replay).toHaveBeenCalledTimes(2);
    expect(db.$executeRawUnsafe).not.toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT replay_period_postings');
  });

  it('stops after three transaction-boundary serialization failures', async () => {
    const preflight = await crearPreflightBackfill('tenant', 'p', 'requester');
    const persisted = db.replayPreflight.create.mock.calls.at(-1)![0].data;
    db.replayPreflight.findFirst.mockResolvedValue({ replayPreflightId: 'preflight-1', ...persisted });
    const approval = await aprobarPreflightBackfill('tenant', 'preflight-1', 'approver');
    db.replayPreflight.findFirst.mockResolvedValue({
      replayPreflightId: 'preflight-1', ...persisted, status: 'APPROVED',
    });
    db.replayApproval.findFirst.mockResolvedValue(approval);
    const originalTransaction = db.$transaction.getMockImplementation()!;
    db.$transaction.mockImplementation(async () => {
      throw Object.assign(new Error('serialization conflict'), { code: 'P2034' });
    });
    db.$transaction.mockClear();
    try {
      await expect(ejecutarBackfillAutorizado({
        tenantId: 'tenant', replayPreflightId: 'preflight-1',
        replayApprovalId: approval.replayApprovalId, actorId: 'approver',
      })).rejects.toThrow('serialization conflict');

      expect(db.$transaction).toHaveBeenCalledTimes(3);
      expect(db.replayRun.create).not.toHaveBeenCalled();
    } finally {
      db.$transaction.mockImplementation(originalTransaction);
    }
  });

  it('replays cash disbursements from their canonical loan and debt sources', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      sale('loan-disbursement-row', { tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO' }),
      sale('debt-disbursement-row', { tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO' }),
      sale('unknown-reconciliation', { tipoReconciliacion: 'UNKNOWN' }),
      sale('loan-without-link', { tipoReconciliacion: 'PRESTAMO_CASH' }),
      sale('debt-without-link', { tipoReconciliacion: 'DEUDA_CASH' }),
      sale('debt-dangling-link', { tipoReconciliacion: 'DEUDA_CASH', deudaCashId: 'debt-missing' }),
    ]);
    db.prestamoCash.findMany.mockResolvedValue([
      { id: 'loan-1', tenantId: 'tenant', montoCapital: new Prisma.Decimal('100'), moneda: 'CUP', fechaOtorgamiento: date, cuentaBancariaId: 'bank-1', deletedAt: null },
      { id: 'loan-foreign-without-evidence', tenantId: 'tenant', montoCapital: new Prisma.Decimal('10'), moneda: 'USD', fechaOtorgamiento: date, cuentaBancariaId: 'bank-1', deletedAt: null },
    ]);
    db.deudaCash.findMany.mockResolvedValue([
      { id: 'debt-1', tenantId: 'tenant', montoCapital: new Prisma.Decimal('200'), moneda: 'CUP', createdAt: date, cuentaBancariaId: 'bank-2', deletedAt: null },
    ]);

    const candidates = await recolectarCandidatos('tenant');
    const byId = new Map(candidates.map((candidate) => [candidate.origenId, candidate]));
    expect(byId.get('loan-1')).toMatchObject({
      origenTipo: 'prestamo_cash',
      evento: { tipo: 'PRESTAMO_OTORGADO', monto: '100', montoFuncional: '100' },
    });
    expect(byId.get('debt-1')).toMatchObject({
      origenTipo: 'deuda_cash',
      evento: { tipo: 'DEUDA_RECIBIDA', monto: '200', montoFuncional: '200' },
    });
    expect(byId.get('loan-foreign-without-evidence')?.causaOmision).toBe('MONTO_NO_VERIFICABLE');
    expect(byId.get('loan-disbursement-row')?.causaOmision).toBe('FUENTE_CANONICA_PRESTAMO_CASH');
    expect(byId.get('debt-disbursement-row')?.causaOmision).toBe('FUENTE_CANONICA_DEUDA_CASH');
    expect(byId.get('unknown-reconciliation')?.causaOmision).toBe('TIPO_RECONCILIACION_NO_VERIFICABLE');
    expect(byId.get('loan-without-link')?.causaOmision).toBe('REFERENCIA_CASH_NO_VERIFICABLE');
    expect(byId.get('debt-without-link')?.causaOmision).toBe('REFERENCIA_CASH_NO_VERIFICABLE');
    expect(byId.get('debt-dangling-link')?.causaOmision).toBe('REFERENCIA_CASH_NO_VERIFICABLE');

    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0]?.replayables).toBe(2);
    expect(plan.omitidos).toEqual(expect.arrayContaining([
      expect.objectContaining({ origenId: 'loan-foreign-without-evidence', causa: 'MONTO_NO_VERIFICABLE' }),
      expect.objectContaining({ origenId: 'unknown-reconciliation', causa: 'TIPO_RECONCILIACION_NO_VERIFICABLE' }),
      expect.objectContaining({ origenId: 'loan-disbursement-row', causa: 'FUENTE_CANONICA_PRESTAMO_CASH' }),
      expect.objectContaining({ origenId: 'debt-disbursement-row', causa: 'FUENTE_CANONICA_DEUDA_CASH' }),
      expect.objectContaining({ origenId: 'debt-dangling-link', causa: 'REFERENCIA_CASH_NO_VERIFICABLE' }),
    ]));
    const result = await ejecutarBackfillAutorizadoFixture();
    expect(result).toMatchObject({ contabilizados: 2, omitidos: 7 });
    expect(replay).toHaveBeenCalledTimes(2);
    expect(replay.mock.calls.map((call) => call[2].origen.tipo)).toEqual(['prestamo_cash', 'deuda_cash']);
  });

  it('only maps explicitly supported sale reconciliation types and validates expense references', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      sameCurrencySale('legacy-sale-null-type'),
      sameCurrencySale('explicit-sale', { tipoReconciliacion: 'VENTA' }),
      sameCurrencySale('linked-loan-payment', { tipoReconciliacion: 'PRESTAMO_CASH', prestamoCashId: 'loan-payment-1' }),
      sameCurrencySale('linked-debt-payment', { tipoReconciliacion: 'DEUDA_CASH', deudaCashId: 'debt-payment-1' }),
      sameCurrencySale('dangling-loan-payment', { tipoReconciliacion: 'PRESTAMO_CASH', prestamoCashId: 'loan-missing' }),
      sameCurrencySale('unsupported-sale-type', { tipoReconciliacion: 'UNKNOWN' }),
      sameCurrencySale('cash-type-without-link', { tipoReconciliacion: 'PRESTAMO_CASH' }),
      sameCurrencySale('sale-with-cash-link', { prestamoCashId: 'loan-1' }),
    ]);
    db.reconciliacionGasto.findMany.mockResolvedValue([
      { ...sameCurrencyValuation(), reconciliacionId: 'valid-payroll', fechaReconciliacion: date, tipoGasto: 'salario', pgId: 'payroll-1' },
      { ...sameCurrencyValuation(), reconciliacionId: 'valid-deferred', fechaReconciliacion: date, tipoGasto: 'gastoDE', gastosDEId: 'deferred-1' },
      { ...sameCurrencyValuation(), reconciliacionId: 'valid-purchase', fechaReconciliacion: date, tipoGasto: 'compra', gastoCompraId: 'purchase-1' },
      { ...sameCurrencyValuation(), reconciliacionId: 'unknown-expense-type', fechaReconciliacion: date, tipoGasto: 'UNKNOWN' },
      { ...sameCurrencyValuation(), reconciliacionId: 'missing-expense-reference', fechaReconciliacion: date, tipoGasto: 'compra' },
      { ...sameCurrencyValuation(), reconciliacionId: 'mismatched-expense-reference', fechaReconciliacion: date, tipoGasto: 'salario', gastosDEId: 'deferred-2' },
      { ...sameCurrencyValuation(), reconciliacionId: 'conflicting-expense-references', fechaReconciliacion: date, tipoGasto: 'compra', gastoCompraId: 'purchase-2', gastosDEId: 'deferred-3' },
    ]);
    db.pagosalario.findMany.mockResolvedValue([{ pgId: 'payroll-1', tenantId: 'tenant' }]);
    db.gastosDE.findMany.mockResolvedValue([{ gastosDEId: 'deferred-1', tenantId: 'tenant' }]);
    db.gastoCompra.findMany.mockResolvedValue([{ gastoCompraId: 'purchase-1', tenantId: 'tenant', deletedAt: null }]);
    db.prestamoCash.findMany.mockResolvedValue([
      { id: 'loan-payment-1', tenantId: 'tenant', montoCapital: 10, moneda: 'CUP', fechaOtorgamiento: date, cuentaBancariaId: 'bank-1', deletedAt: null },
    ]);
    db.deudaCash.findMany.mockResolvedValue([
      { id: 'debt-payment-1', tenantId: 'tenant', montoCapital: 10, moneda: 'CUP', createdAt: date, cuentaBancariaId: 'bank-2', deletedAt: null },
    ]);

    const candidates = await recolectarCandidatos('tenant');
    const byId = new Map(candidates.map((candidate) => [candidate.origenId, candidate]));
    expect(byId.get('legacy-sale-null-type')?.evento.tipo).toBe('VENTA_CONTADO');
    expect(byId.get('explicit-sale')?.evento.tipo).toBe('VENTA_CONTADO');
    expect(byId.get('linked-loan-payment')?.evento.tipo).toBe('COBRO_PRESTAMO');
    expect(byId.get('linked-debt-payment')?.evento.tipo).toBe('PAGO_DEUDA');
    expect(byId.get('linked-loan-payment')?.causaOmision).toBeUndefined();
    expect(byId.get('linked-debt-payment')?.causaOmision).toBeUndefined();
    expect(byId.get('dangling-loan-payment')?.causaOmision).toBe('REFERENCIA_CASH_NO_VERIFICABLE');
    for (const id of ['unsupported-sale-type', 'cash-type-without-link', 'sale-with-cash-link']) {
      expect(byId.get(id)?.causaOmision).toBeDefined();
    }
    expect(byId.get('unknown-expense-type')?.causaOmision).toBeDefined();
    expect(byId.get('missing-expense-reference')?.causaOmision).toBeDefined();
    expect(byId.get('mismatched-expense-reference')?.causaOmision).toBeDefined();
    expect(byId.get('conflicting-expense-references')?.causaOmision).toBe('REFERENCIA_GASTO_AMBIGUA');

    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0]?.replayables).toBe(9);
    expect(plan.omitidos).toHaveLength(8);
    const result = await ejecutarBackfillAutorizadoFixture();
    expect(result).toMatchObject({ contabilizados: 9, omitidos: 8 });
    expect(replay).toHaveBeenCalledTimes(9);
  });

  it('omits expense references unless the active canonical parent belongs to the tenant', async () => {
    db.reconciliacionGasto.findMany.mockResolvedValue([
      { ...sameCurrencyValuation(), reconciliacionId: 'salary-valid', fechaReconciliacion: date, tipoGasto: 'salario', pgId: 'payroll-valid' },
      { ...sameCurrencyValuation(), reconciliacionId: 'salary-dangling', fechaReconciliacion: date, tipoGasto: 'salario', pgId: 'payroll-missing' },
      { ...sameCurrencyValuation(), reconciliacionId: 'deferred-valid', fechaReconciliacion: date, tipoGasto: 'gastoDE', gastosDEId: 'deferred-valid-id' },
      { ...sameCurrencyValuation(), reconciliacionId: 'deferred-dangling', fechaReconciliacion: date, tipoGasto: 'gastoDE', gastosDEId: 'deferred-missing' },
      { ...sameCurrencyValuation(), reconciliacionId: 'purchase-valid', fechaReconciliacion: date, tipoGasto: 'compra', gastoCompraId: 'purchase-valid-id' },
      { ...sameCurrencyValuation(), reconciliacionId: 'purchase-dangling', fechaReconciliacion: date, tipoGasto: 'compra', gastoCompraId: 'purchase-missing' },
      { ...sameCurrencyValuation(), reconciliacionId: 'payable-valid', fechaReconciliacion: date, tipoGasto: 'compra', cuentaPorPagarId: 'payable-valid-id' },
      { ...sameCurrencyValuation(), reconciliacionId: 'payable-dangling', fechaReconciliacion: date, tipoGasto: 'compra', cuentaPorPagarId: 'payable-missing' },
      { ...sameCurrencyValuation(), reconciliacionId: 'payable-source-mismatch', fechaReconciliacion: date, tipoGasto: 'compra', gastoCompraId: 'purchase-valid-id', cuentaPorPagarId: 'payable-mismatch-id' },
      { ...sameCurrencyValuation(), reconciliacionId: 'purchase-dangling-with-valid-payable', fechaReconciliacion: date, tipoGasto: 'compra', gastoCompraId: 'purchase-missing', cuentaPorPagarId: 'payable-valid-id' },
      { ...sameCurrencyValuation(), reconciliacionId: 'purchase-valid-with-matching-payable', fechaReconciliacion: date, tipoGasto: 'compra', gastoCompraId: 'purchase-valid-id', cuentaPorPagarId: 'payable-matching-id' },
      { ...sameCurrencyValuation(), reconciliacionId: 'payable-without-purchase-parent', fechaReconciliacion: date, tipoGasto: 'compra', cuentaPorPagarId: 'payable-no-parent-id' },
      { ...sameCurrencyValuation(), reconciliacionId: 'deferred-with-matching-payable', fechaReconciliacion: date, tipoGasto: 'gastoDE', gastosDEId: 'deferred-valid-id', cuentaPorPagarId: 'payable-deferred-valid-id' },
      { ...sameCurrencyValuation(), reconciliacionId: 'salary-with-purchase-payable', fechaReconciliacion: date, tipoGasto: 'salario', pgId: 'payroll-valid', cuentaPorPagarId: 'payable-valid-id' },
      { ...sameCurrencyValuation(), reconciliacionId: 'deferred-with-other-payable', fechaReconciliacion: date, tipoGasto: 'gastoDE', gastosDEId: 'deferred-valid-id', cuentaPorPagarId: 'payable-deferred-other-id' },
      { ...sameCurrencyValuation(), reconciliacionId: 'salary-cross-tenant', fechaReconciliacion: date, tipoGasto: 'salario', pgId: 'payroll-foreign' },
      { ...sameCurrencyValuation(), reconciliacionId: 'deferred-cross-tenant', fechaReconciliacion: date, tipoGasto: 'gastoDE', gastosDEId: 'deferred-foreign' },
      { ...sameCurrencyValuation(), reconciliacionId: 'purchase-soft-deleted', fechaReconciliacion: date, tipoGasto: 'compra', gastoCompraId: 'purchase-deleted' },
      { ...sameCurrencyValuation(), reconciliacionId: 'payable-soft-deleted', fechaReconciliacion: date, tipoGasto: 'compra', cuentaPorPagarId: 'payable-deleted' },
    ]);
    db.pagosalario.findMany.mockResolvedValue([
      { pgId: 'payroll-valid', tenantId: 'tenant' },
      { pgId: 'payroll-foreign', tenantId: 'another-tenant' },
    ]);
    db.gastosDE.findMany.mockResolvedValue([
      { gastosDEId: 'deferred-valid-id', tenantId: 'tenant' },
      { gastosDEId: 'deferred-other', tenantId: 'tenant' },
      { gastosDEId: 'deferred-foreign', tenantId: 'another-tenant' },
    ]);
    db.gastoCompra.findMany.mockResolvedValue([
      { gastoCompraId: 'purchase-valid-id', tenantId: 'tenant', deletedAt: null },
      { gastoCompraId: 'purchase-deleted', tenantId: 'tenant', deletedAt: date },
    ]);
    db.cuentaPorPagar.findMany.mockResolvedValue([
      { cuentaPorPagarId: 'payable-valid-id', tenantId: 'tenant', deletedAt: null, gastoCompraId: 'purchase-valid-id' },
      { cuentaPorPagarId: 'payable-deleted', tenantId: 'tenant', deletedAt: date },
      { cuentaPorPagarId: 'payable-mismatch-id', tenantId: 'tenant', deletedAt: null, gastoCompraId: 'purchase-other-id' },
      { cuentaPorPagarId: 'payable-matching-id', tenantId: 'tenant', deletedAt: null, gastoCompraId: 'purchase-valid-id' },
      { cuentaPorPagarId: 'payable-no-parent-id', tenantId: 'tenant', deletedAt: null, gastoCompraId: null },
      { cuentaPorPagarId: 'payable-deferred-valid-id', tenantId: 'tenant', deletedAt: null, gastosDEId: 'deferred-valid-id' },
      { cuentaPorPagarId: 'payable-deferred-other-id', tenantId: 'tenant', deletedAt: null, gastosDEId: 'deferred-other' },
    ]);

    const candidates = await recolectarCandidatos('tenant');
    const byId = new Map(candidates.map((candidate) => [candidate.origenId, candidate]));
    for (const id of [
      'salary-valid', 'deferred-valid', 'purchase-valid', 'payable-valid',
      'purchase-valid-with-matching-payable', 'deferred-with-matching-payable',
    ]) {
      expect(byId.get(id)?.causaOmision).toBeUndefined();
    }
    for (const id of [
      'salary-dangling', 'deferred-dangling', 'purchase-dangling', 'payable-dangling',
      'salary-cross-tenant', 'deferred-cross-tenant', 'purchase-soft-deleted', 'payable-soft-deleted',
      'payable-source-mismatch', 'purchase-dangling-with-valid-payable',
      'payable-without-purchase-parent',
      'salary-with-purchase-payable', 'deferred-with-other-payable',
    ]) {
      expect(byId.get(id)?.causaOmision).toBe('REFERENCIA_GASTO_NO_VERIFICABLE');
    }

    expect(db.pagosalario.findMany).toHaveBeenCalledWith({ where: { tenantId: 'tenant' } });
    expect(db.gastosDE.findMany).toHaveBeenCalledWith({ where: { tenantId: 'tenant' } });
    expect(db.gastoCompra.findMany).toHaveBeenCalledWith({ where: { tenantId: 'tenant', deletedAt: null } });
    expect(db.cuentaPorPagar.findMany).toHaveBeenCalledWith({ where: { tenantId: 'tenant', deletedAt: null } });

    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0]?.replayables).toBe(6);
    expect(plan.omitidos).toHaveLength(13);
    const result = await ejecutarBackfillAutorizadoFixture();
    expect(result).toMatchObject({ contabilizados: 6, omitidos: 13 });
    expect(replay).toHaveBeenCalledTimes(6);
  });

  it('maps each supported historical source to its canonical event without inventing valuation', async () => {
    db.reconciliacionGasto.findMany.mockResolvedValue([
      { ...sameCurrencyValuation(), reconciliacionId: 'expense-cxp', fechaReconciliacion: date, tipoGasto: 'compra', cuentaPorPagarId: 'cxp-1' },
      { ...sameCurrencyValuation(), reconciliacionId: 'expense-payroll', fechaReconciliacion: date, tipoGasto: 'salario', pgId: 'payroll-1' },
      { ...sameCurrencyValuation(), reconciliacionId: 'expense-purchase', fechaReconciliacion: date, tipoGasto: 'compra', gastoCompraId: 'purchase-1' },
      { ...sameCurrencyValuation(), reconciliacionId: 'expense-other', fechaReconciliacion: date, tipoGasto: 'gastoDE', gastosDEId: 'deferred-1' },
    ]);
    db.pagosalario.findMany.mockResolvedValue([{ pgId: 'payroll-1', tenantId: 'tenant' }]);
    db.gastosDE.findMany.mockResolvedValue([{ gastosDEId: 'deferred-1', tenantId: 'tenant' }]);
    db.gastoCompra.findMany.mockResolvedValue([{ gastoCompraId: 'purchase-1', tenantId: 'tenant', deletedAt: null }]);
    db.cuentaPorPagar.findMany.mockResolvedValue([
      { cuentaPorPagarId: 'cxp-1', tenantId: 'tenant', deletedAt: null, gastoCompraId: 'purchase-1' },
      { cuentaPorPagarId: 'cxp-2', tenantId: 'tenant', deletedAt: null },
    ]);
    db.reconciliacionServicio.findMany.mockResolvedValue([
      { ...sameCurrencyValuation(), reconciliacionId: 'service-1', fechaReconciliacion: date },
    ]);
    db.ajusteBancario.findMany.mockResolvedValue([
      { ...sameCurrencyValuation(), ajusteId: 'adjustment-income', tipo: 'ingreso', fechaOperacion: date },
      { ...sameCurrencyValuation(), ajusteId: 'adjustment-expense', tipo: 'egreso', fechaOperacion: date },
    ]);
    db.inyeccionCapital.findMany.mockResolvedValue([
      { ...sameCurrencyMetadata(), id: 'capital-1', tipo: 'CAPITAL_SOCIAL', montoRecibido: 10, fechaRegistro: date },
      { ...sameCurrencyMetadata(), id: 'external-debt-1', tipo: 'DEUDA_EXTERNA', montoRecibido: 10, fechaRegistro: date },
    ]);
    db.pagoDeuda.findMany.mockResolvedValue([
      { ...sameCurrencyMetadata(), id: 'debt-payment-1', montoPagado: 10, createdAt: date },
    ]);
    db.compraDocumento.findMany.mockResolvedValue([
      { ...sameCurrencyMetadata(), compraDocumentoId: 'credit-purchase-1', total: 10, fechaCompra: date, cuentaPorPagarId: 'cxp-2' },
    ]);
    db.factura.findMany.mockResolvedValue([
      { idFactura: 'invoice-1', tipoDocumento: 'FACTURA', total: new Prisma.Decimal('10'), fechaEmision: date },
    ]);
    db.anticipo.findMany.mockResolvedValue([
      { anticipoId: 'advance-receipt-1', tipo: 'COBRO', montoOriginal: new Prisma.Decimal('10'), moneda: 'CUP', createdAt: date },
      { anticipoId: 'advance-payment-1', tipo: 'PAGO', montoOriginal: new Prisma.Decimal('10'), moneda: 'CUP', createdAt: date },
    ]);

    const candidates = await recolectarCandidatos('tenant');
    const byId = new Map(candidates.map((candidate) => [candidate.origenId, candidate]));
    const expectedEvents: Record<string, string> = {
      'expense-cxp': 'PAGO_CXP',
      'expense-payroll': 'PAGO_NOMINA',
      'expense-purchase': 'COMPRA_CONTADO',
      'expense-other': 'GASTO_CONTADO',
      'service-1': 'COBRO_SERVICIO',
      'adjustment-income': 'AJUSTE_BANCARIO_ABONO',
      'adjustment-expense': 'AJUSTE_BANCARIO_CARGO',
      'capital-1': 'INYECCION_CAPITAL',
      'external-debt-1': 'DEUDA_RECIBIDA',
      'debt-payment-1': 'PAGO_DEUDA_CAPITAL',
      'credit-purchase-1': 'COMPRA_CREDITO',
      'invoice-1': 'VENTA_CREDITO',
      'advance-receipt-1': 'ANTICIPO_CLIENTE_RECIBIDO',
      'advance-payment-1': 'ANTICIPO_PROVEEDOR_ENTREGADO',
    };
    for (const [sourceId, eventType] of Object.entries(expectedEvents)) {
      expect(byId.get(sourceId)?.evento.tipo).toBe(eventType);
    }
    expect(byId.get('invoice-1')?.causaOmision).toBe('MONEDA_AUSENTE');
    for (const sourceId of Object.keys(expectedEvents).filter((id) => id !== 'invoice-1')) {
      expect(byId.get(sourceId)?.causaOmision).toBeUndefined();
      expect(String(byId.get(sourceId)?.evento.monto)).toBe('10');
      expect(String(byId.get(sourceId)?.evento.montoFuncional)).toBe('10');
      expect(byId.get(sourceId)?.evento.moneda).toBe('CUP');
      expect(byId.get(sourceId)?.evento.monedaFuncional).toBe('CUP');
    }

    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0]?.replayables).toBe(13);
    expect(plan.omitidos).toContainEqual(expect.objectContaining({
      origenTipo: 'factura', origenId: 'invoice-1', causa: 'MONEDA_AUSENTE',
    }));
  });

  it('requires verified FX evidence for every source adapter that persists foreign valuation', async () => {
    const fx = verifiedForeignValuation();
    const missingFx = {
      moneda: 'USD', montoConvertido: new Prisma.Decimal('240'),
      functionalCurrency: 'CUP', tasaCambio: null, fxEvidenceFingerprint: null,
    };
    db.reconciliacionGasto.findMany.mockResolvedValue([
      { ...fx, monto: 10, reconciliacionId: 'fx-expense-valid', fechaReconciliacion: date, tipoGasto: 'gastoDE', gastosDEId: 'deferred-1' },
      { ...missingFx, monto: 10, reconciliacionId: 'fx-expense-missing', fechaReconciliacion: date, tipoGasto: 'gastoDE', gastosDEId: 'deferred-2' },
    ]);
    db.gastosDE.findMany.mockResolvedValue([
      { gastosDEId: 'deferred-1', tenantId: 'tenant' },
      { gastosDEId: 'deferred-2', tenantId: 'tenant' },
    ]);
    db.reconciliacionServicio.findMany.mockResolvedValue([
      { ...fx, monto: 10, reconciliacionId: 'fx-service-valid', fechaReconciliacion: date },
      { ...missingFx, monto: 10, reconciliacionId: 'fx-service-missing', fechaReconciliacion: date },
    ]);
    db.ajusteBancario.findMany.mockResolvedValue([
      { ...fx, monto: 10, ajusteId: 'fx-adjustment-valid', tipo: 'ingreso', fechaOperacion: date },
      { ...missingFx, monto: 10, ajusteId: 'fx-adjustment-missing', tipo: 'egreso', fechaOperacion: date },
    ]);
    db.inyeccionCapital.findMany.mockResolvedValue([
      { ...fx, id: 'fx-capital-valid', tipo: 'CAPITAL_SOCIAL', montoRecibido: 10, fechaRegistro: date },
      { ...missingFx, id: 'fx-capital-missing', tipo: 'CAPITAL_SOCIAL', montoRecibido: 10, fechaRegistro: date },
    ]);
    db.pagoDeuda.findMany.mockResolvedValue([
      { ...fx, id: 'fx-debt-payment-valid', montoPagado: 10, createdAt: date },
      { ...missingFx, id: 'fx-debt-payment-missing', montoPagado: 10, createdAt: date },
    ]);
    db.compraDocumento.findMany.mockResolvedValue([
      { ...fx, compraDocumentoId: 'fx-purchase-valid', total: 10, fechaCompra: date, cuentaPorPagarId: 'cxp-1' },
      { ...missingFx, compraDocumentoId: 'fx-purchase-missing', total: 10, fechaCompra: date, cuentaPorPagarId: 'cxp-2' },
    ]);

    const candidates = await recolectarCandidatos('tenant');
    const validIds = [
      'fx-expense-valid', 'fx-service-valid', 'fx-adjustment-valid',
      'fx-capital-valid', 'fx-debt-payment-valid', 'fx-purchase-valid',
    ];
    const invalidIds = [
      'fx-expense-missing', 'fx-service-missing', 'fx-adjustment-missing',
      'fx-capital-missing', 'fx-debt-payment-missing', 'fx-purchase-missing',
    ];
    const byId = new Map(candidates.map((candidate) => [candidate.origenId, candidate]));
    for (const sourceId of validIds) {
      expect(byId.get(sourceId)?.causaOmision).toBeUndefined();
      expect(byId.get(sourceId)?.evento.fxEvidenceFingerprint).toBe(fx.fxEvidenceFingerprint);
      expect(String(byId.get(sourceId)?.evento.montoFuncional)).toBe('240');
    }
    for (const sourceId of invalidIds) {
      expect(byId.get(sourceId)?.causaOmision).toBe('FX_NO_VERIFICABLE');
    }

    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0]?.replayables).toBe(6);
    expect(plan.omitidos).toEqual(expect.arrayContaining(invalidIds.map((origenId) =>
      expect.objectContaining({ origenId, causa: 'FX_NO_VERIFICABLE' }),
    )));
  });

  it('omits null valuations and unknown capital or advance types instead of defaulting them', async () => {
    db.reconciliacionGasto.findMany.mockResolvedValue([
      { ...sameCurrencyValuation(), monto: null, reconciliacionId: 'null-expense', fechaReconciliacion: date, tipoGasto: 'gastoDE', gastosDEId: 'deferred-1' },
    ]);
    db.gastosDE.findMany.mockResolvedValue([{ gastosDEId: 'deferred-1', tenantId: 'tenant' }]);
    db.reconciliacionServicio.findMany.mockResolvedValue([
      { ...sameCurrencyValuation(), monto: null, reconciliacionId: 'null-service', fechaReconciliacion: date },
    ]);
    db.ajusteBancario.findMany.mockResolvedValue([
      { ...sameCurrencyValuation(), monto: null, ajusteId: 'null-adjustment', tipo: 'ingreso', fechaOperacion: date },
    ]);
    db.inyeccionCapital.findMany.mockResolvedValue([
      { ...sameCurrencyMetadata(), id: 'null-capital', tipo: 'CAPITAL_SOCIAL', montoRecibido: null, fechaRegistro: date },
      { ...sameCurrencyMetadata(), id: 'unknown-capital-type', tipo: 'UNKNOWN', montoRecibido: 10, fechaRegistro: date },
    ]);
    db.pagoDeuda.findMany.mockResolvedValue([
      { ...sameCurrencyMetadata(), id: 'null-debt-payment', montoPagado: null, createdAt: date },
    ]);
    db.compraDocumento.findMany.mockResolvedValue([
      { ...sameCurrencyMetadata(), compraDocumentoId: 'null-credit-purchase', total: null, fechaCompra: date, cuentaPorPagarId: 'cxp-1' },
    ]);
    db.factura.findMany.mockResolvedValue([
      { idFactura: 'missing-invoice-currency', tipoDocumento: 'FACTURA', total: 10, fechaEmision: date },
    ]);
    db.anticipo.findMany.mockResolvedValue([
      { anticipoId: 'null-advance', tipo: 'COBRO', montoOriginal: null, moneda: 'CUP', createdAt: date },
      { anticipoId: 'unknown-advance-type', tipo: 'UNKNOWN', montoOriginal: 10, moneda: 'CUP', createdAt: date },
    ]);

    const candidates = await recolectarCandidatos('tenant');
    const byId = new Map(candidates.map((candidate) => [candidate.origenId, candidate]));
    for (const sourceId of [
      'null-expense', 'null-service', 'null-adjustment', 'null-capital',
      'null-debt-payment', 'null-credit-purchase', 'null-advance',
    ]) {
      expect(byId.get(sourceId)?.causaOmision).toBe('MONTO_NO_VERIFICABLE');
    }
    expect(byId.get('missing-invoice-currency')?.causaOmision).toBe('MONEDA_AUSENTE');
    expect(byId.get('unknown-capital-type')?.causaOmision).toBe('TIPO_INYECCION_NO_VERIFICABLE');
    expect(byId.get('unknown-advance-type')?.causaOmision).toBe('TIPO_ANTICIPO_NO_VERIFICABLE');

    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0]?.replayables).toBe(0);
    expect(plan.omitidos).toHaveLength(10);
    const result = await ejecutarBackfillAutorizadoFixture();
    expect(result).toMatchObject({ contabilizados: 0, omitidos: 10 });
    expect(replay).not.toHaveBeenCalled();
  });

  it('rejects extra fields in persisted FX evidence JSON', async () => {
    const row = foreignSale('extra-evidence-field');
	const typedRow = row as unknown as { fxEvidenceJson: Record<string, unknown> };
	typedRow.fxEvidenceJson = { ...typedRow.fxEvidenceJson, unboundRateNote: 'rate=1' };
    db.reconciliacionVenta.findMany.mockResolvedValue([row]);

    const plan = await planBackfillContable('tenant');

    expect(plan.periodos[0].replayables).toBe(0);
    expect(plan.omitidos).toContainEqual(expect.objectContaining({
      origenId: 'extra-evidence-field',
      causa: 'FX_NO_VERIFICABLE',
    }));
    const result = await ejecutarBackfillAutorizadoFixture();
    expect(result).toMatchObject({ contabilizados: 0, omitidos: 1 });
    expect(replay).not.toHaveBeenCalled();
  });

  it('omits same-currency sources with stale FX provenance but preserves valid canonical evidence', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      sameCurrencySale('valid-same-currency'),
      sameCurrencySale('stale-same-currency', { fxEvidenceFingerprint: 'stale-fingerprint' }),
    ]);

    const plan = await planBackfillContable('tenant');

    expect(plan.periodos[0].replayables).toBe(1);
    expect(plan.omitidos).toContainEqual(expect.objectContaining({
      origenId: 'stale-same-currency',
      causa: 'FX_NO_VERIFICABLE',
    }));
    const result = await ejecutarBackfillAutorizadoFixture();
    expect(result).toMatchObject({ contabilizados: 1, omitidos: 1 });
    expect(replay).toHaveBeenCalledTimes(1);
    expect(replay.mock.calls[0][2].origen.id).toBe('valid-same-currency');
    expect(replay.mock.calls[0][2].fxEvidenceFingerprint).toBe(
      sameCurrencySale('expected-fingerprint').fxEvidenceFingerprint,
    );
  });

  it('omits foreign valuation when persisted FX evidence contradicts amount or fingerprint', async () => {
    const valid = foreignSale('valid-persisted-fx');
    const inconsistentConversion = foreignSale('inconsistent-persisted-fx', '10', '24', {
      montoConvertido: new Prisma.Decimal('241'),
    });
    const inconsistentFingerprint = foreignSale('inconsistent-fingerprint', '10', '24', {
      fxEvidenceFingerprint: 'tampered-fingerprint',
    });
    db.reconciliacionVenta.findMany.mockResolvedValue([
      valid,
      inconsistentConversion,
      inconsistentFingerprint,
    ]);

    const plan = await planBackfillContable('tenant');

    expect(plan.periodos[0].replayables).toBe(1);
    expect(plan.omitidos).toEqual(expect.arrayContaining([
      expect.objectContaining({ origenId: 'inconsistent-persisted-fx', causa: 'FX_NO_VERIFICABLE' }),
      expect.objectContaining({ origenId: 'inconsistent-fingerprint', causa: 'FX_NO_VERIFICABLE' }),
    ]));

    const result = await ejecutarBackfillAutorizadoFixture();

    expect(result).toMatchObject({ contabilizados: 1, omitidos: 2 });
    expect(replay).toHaveBeenCalledTimes(1);
    expect(replay.mock.calls[0][2].origen.id).toBe('valid-persisted-fx');
  });

  it('omits unsupported functional precision while continuing an exact source', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      sale('excess-scale', {
        monto: new Prisma.Decimal('10.12345'), montoConvertido: new Prisma.Decimal('10.12345'),
      }),
      sale('valid-scale', {
        monto: new Prisma.Decimal('10.1234'), montoConvertido: new Prisma.Decimal('10.1234'),
      }),
    ]);
    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0].replayables).toBe(1);
    expect(plan.omitidos).toEqual(expect.arrayContaining([
      expect.objectContaining({ origenId: 'excess-scale', causa: 'MONTO_NO_VERIFICABLE' }),
    ]));
    const result = await ejecutarBackfillAutorizadoFixture();
    expect(result).toMatchObject({ contabilizados: 1, omitidos: 1 });
    expect(replay).toHaveBeenCalledTimes(1);
    expect(replay.mock.calls[0][2].origen.id).toBe('valid-scale');
  });
  it('preserves exact original and functional Decimal values beyond IEEE-754 safe range', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      foreignSale('precise', '10.125', '24'),
      sale('unsafe', { monto: new Prisma.Decimal('9007199254740993'), montoConvertido: new Prisma.Decimal('9007199254740993') }),
    ]);
    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0].replayables).toBe(2);
    expect(plan.omitidos).toEqual([]);
    await ejecutarBackfillAutorizadoFixture();
    expect(replay).toHaveBeenCalledTimes(2);
    expect(String(replay.mock.calls[0][2].montoFuncional)).toBe('243');
    expect(String(replay.mock.calls[1][2].monto)).toBe('9007199254740993');
    expect(String(replay.mock.calls[1][2].montoFuncional)).toBe('9007199254740993');
  });

  it('preserves exact FX rate and omits nonpositive or invalid source/rate values', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      foreignSale('valid-fx', '10.125', '24'),
      sale('zero-amount', { monto: new Prisma.Decimal('0') }),
      sale('negative-amount', { monto: new Prisma.Decimal('-10') }),
      sale('invalid-rate', {
        moneda: 'USD', montoConvertido: new Prisma.Decimal('240'),
        tasaCambio: new Prisma.Decimal('0'), fxEvidenceFingerprint: 'fx-2',
      }),
      sale('blank-fingerprint', {
        moneda: 'USD', montoConvertido: new Prisma.Decimal('240'),
        tasaCambio: new Prisma.Decimal('24'), fxEvidenceFingerprint: '   ',
      }),
      sale('nonfinite-rate', {
        moneda: 'USD', montoConvertido: new Prisma.Decimal('240'),
        tasaCambio: new Prisma.Decimal('NaN'), fxEvidenceFingerprint: 'fx-3',
      }),
      sale('source-out-of-range', { monto: new Prisma.Decimal('10000000000000000') }),
      sale('functional-out-of-range', {
        monto: new Prisma.Decimal('100000000'), moneda: 'USD',
        montoConvertido: new Prisma.Decimal('10000000000000000'),
        tasaCambio: new Prisma.Decimal('100000000'), fxEvidenceFingerprint: 'fx-functional-limit',
      }),
      sale('rate-out-of-range', {
        moneda: 'USD', montoConvertido: new Prisma.Decimal('240'),
        tasaCambio: new Prisma.Decimal('10000000000'), fxEvidenceFingerprint: 'fx-4',
      }),
    ]);
    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0].replayables).toBe(1);
    expect(plan.omitidos).toEqual(expect.arrayContaining([
      expect.objectContaining({ origenId: 'zero-amount', causa: 'MONTO_NO_VERIFICABLE' }),
      expect.objectContaining({ origenId: 'negative-amount', causa: 'MONTO_NO_VERIFICABLE' }),
      expect.objectContaining({ origenId: 'invalid-rate', causa: 'FX_NO_VERIFICABLE' }),
      expect.objectContaining({ origenId: 'blank-fingerprint', causa: 'FX_NO_VERIFICABLE' }),
      expect.objectContaining({ origenId: 'nonfinite-rate', causa: 'FX_NO_VERIFICABLE' }),
      expect.objectContaining({ origenId: 'source-out-of-range', causa: 'MONTO_NO_VERIFICABLE' }),
      expect.objectContaining({ origenId: 'functional-out-of-range', causa: 'FX_NO_VERIFICABLE' }),
      expect.objectContaining({ origenId: 'rate-out-of-range', causa: 'FX_NO_VERIFICABLE' }),
    ]));
    await ejecutarBackfillAutorizadoFixture();
    expect(replay).toHaveBeenCalledTimes(1);
    expect(String(replay.mock.calls[0][2].monto)).toBe('10.125');
    expect(String(replay.mock.calls[0][2].tasaCambio)).toBe('24');
  });

  it('canonicalizes exponent-form original amount, functional amount, and FX rate', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      foreignSale('exponent-fx', '9.007199254740993125e+15', '1'),
    ]);
    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0].replayables).toBe(1);
    await ejecutarBackfillAutorizadoFixture();
    expect(replay.mock.calls[0][2]).toMatchObject({
      monto: '9007199254740993.125',
      montoFuncional: '9007199254740993.125',
      tasaCambio: '1',
    });
  });
  it('omits missing currency and amount instead of inventing CUP or zero, while continuing valid source', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      sale('bad-currency', { moneda: null }),
      sale('blank-currency', { moneda: '   ', functionalCurrency: 'CUP' }),
      sale('bad-amount', { monto: null }),
      sale('valid'),
    ]);
    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0].replayables).toBe(1);
    expect(plan.omitidos).toEqual(expect.arrayContaining([
      expect.objectContaining({ origenId: 'bad-currency', causa: 'MONEDA_AUSENTE' }),
      expect.objectContaining({ origenId: 'blank-currency', causa: 'MONEDA_AUSENTE' }),
      expect.objectContaining({ origenId: 'bad-amount', causa: 'MONTO_NO_VERIFICABLE' }),
    ]));
    const result = await ejecutarBackfillAutorizadoFixture();
    expect(result).toMatchObject({ contabilizados: 1, omitidos: 3 });
    expect(replay).toHaveBeenCalledTimes(1);
  });

  it('does not replay CUP source valuation into a tenant ledger whose functional currency is MLC', async () => {
    db.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'MLC' });
    db.reconciliacionVenta.findMany.mockResolvedValue([sale('cup-source')]);

    const plan = await planBackfillContable('tenant');

    expect(plan.periodos[0].replayables).toBe(0);
    expect(plan.omitidos).toContainEqual(expect.objectContaining({
      origenTipo: 'reconciliacion_venta',
      origenId: 'cup-source',
      causa: 'MONEDA_FUNCIONAL_INCONSISTENTE',
    }));
    await ejecutarBackfillAutorizadoFixture();
    expect(replay).not.toHaveBeenCalled();
  });

  it('omits missing FX evidence and missing merma cost without synthetic valuation', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([sale('fx', { moneda: 'USD', montoConvertido: 240, tasaCambio: null, fxEvidenceFingerprint: null })]);
    db.merma.findMany.mockResolvedValue([{ mermaId: 'm', createdAt: date, costoTotal: null }]);
    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0].replayables).toBe(0);
    expect(plan.omitidos).toEqual(expect.arrayContaining([
      expect.objectContaining({ origenId: 'fx', causa: 'FX_NO_VERIFICABLE' }),
      expect.objectContaining({ origenId: 'm', causa: 'COSTO_NO_VERIFICABLE' }),
    ]));
  });

  it('omits merma cost when its original currency and functional valuation are not persisted', async () => {
    db.merma.findMany.mockResolvedValue([{ mermaId: 'valued-but-unqualified', createdAt: date, costoTotal: 42 }]);

    const plan = await planBackfillContable('tenant');

    expect(plan.periodos[0].replayables).toBe(0);
    expect(plan.omitidos).toContainEqual(expect.objectContaining({
      origenTipo: 'merma',
      origenId: 'valued-but-unqualified',
      causa: 'VALORACION_MONETARIA_NO_VERIFICABLE',
    }));
    const result = await ejecutarBackfillAutorizadoFixture();
    expect(result).toMatchObject({ contabilizados: 0, omitidos: 1 });
    expect(replay).not.toHaveBeenCalled();
  });

  it('keeps out-of-period and already posted classification separate', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([sale('outside', { fechaReconciliacion: new Date('2026-08-01') }), sale('posted'), sale('valid')]);
    db.asiento.findMany.mockResolvedValue([{ origenTipo: 'reconciliacion_venta', origenId: 'posted' }]);
    const plan = await planBackfillContable('tenant');
    expect(plan.sinPeriodo).toBe(1);
    expect(plan.yaPosteados).toBe(1);
    expect(plan.periodos[0].replayables).toBe(1);
  });

  it('omits every row with an ambiguous replay identity and continues unambiguous rows', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      sale('duplicate-origin'),
      sale('duplicate-origin', { monto: 20, montoConvertido: 20 }),
      sale('unambiguous'),
    ]);

    const plan = await planBackfillContable('tenant');

    expect(plan.periodos[0].replayables).toBe(1);
    expect(plan.omitidos).toEqual([
      expect.objectContaining({ origenTipo: 'reconciliacion_venta', origenId: 'duplicate-origin', causa: 'IDENTIDAD_AMBIGUA' }),
      expect.objectContaining({ origenTipo: 'reconciliacion_venta', origenId: 'duplicate-origin', causa: 'IDENTIDAD_AMBIGUA' }),
    ]);
    const result = await ejecutarBackfillAutorizadoFixture();
    expect(result).toMatchObject({ contabilizados: 1, omitidos: 2 });
    expect(replay).toHaveBeenCalledTimes(1);
    expect(replay.mock.calls[0][2].origen.id).toBe('unambiguous');
  });

  it('omits unknown adjustment types but continues valid ingreso, egreso, and sale sources', async () => {
    db.ajusteBancario.findMany.mockResolvedValue([
      adjustment('adjustment-unknown', 'reverso'),
      adjustment('adjustment-income', 'ingreso'),
      adjustment('adjustment-expense', 'egreso'),
    ]);
    db.reconciliacionVenta.findMany.mockResolvedValue([sale('valid-sale')]);

    const plan = await planBackfillContable('tenant');

    expect(plan.periodos[0].replayables).toBe(3);
    expect(plan.omitidos).toEqual([
      expect.objectContaining({
        origenTipo: 'ajuste_bancario', origenId: 'adjustment-unknown',
        causa: 'TIPO_AJUSTE_BANCARIO_NO_VERIFICABLE',
      }),
    ]);

    const result = await ejecutarBackfillAutorizadoFixture();

    expect(result).toMatchObject({ contabilizados: 3, omitidos: 1 });
    expect(replay).toHaveBeenCalledTimes(3);
    expect(replay.mock.calls.map((call) => call[2].tipo)).toEqual(expect.arrayContaining([
      'AJUSTE_BANCARIO_ABONO', 'AJUSTE_BANCARIO_CARGO', 'VENTA_CONTADO',
    ]));
    expect(replay.mock.calls.map((call) => call[2].origen.id)).not.toContain('adjustment-unknown');
  });

  it('reports ambiguous identities before existing postings without hiding ambiguity', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      sale('already-posted-duplicate'),
      sale('already-posted-duplicate', { monto: 20, montoConvertido: 20 }),
      sale('already-posted-unique'),
    ]);
    db.asiento.findMany.mockImplementation(async (args) => args?.include?.lineas
      ? ledgerEvidence(db.replayPreflight.create.mock.calls.at(-1)![0].data.snapshot)
      : [
        { origenTipo: 'reconciliacion_venta', origenId: 'already-posted-duplicate' },
        { origenTipo: 'reconciliacion_venta', origenId: 'already-posted-unique' },
      ]);

    const plan = await planBackfillContable('tenant');

    expect(plan.yaPosteados).toBe(1);
    expect(plan.periodos[0].yaPosteados).toBe(1);
    expect(plan.periodos[0].replayables).toBe(0);
    expect(plan.omitidos).toEqual([
      expect.objectContaining({ origenId: 'already-posted-duplicate', causa: 'IDENTIDAD_AMBIGUA' }),
      expect.objectContaining({ origenId: 'already-posted-duplicate', causa: 'IDENTIDAD_AMBIGUA' }),
    ]);

    const result = await ejecutarBackfillAutorizadoFixture();

    expect(result).toMatchObject({ contabilizados: 0, yaPosteados: 1, omitidos: 2 });
    expect(replay).not.toHaveBeenCalled();
  });

  it('accepts explicit CUP without a converted amount, but does not infer a missing currency', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      sale('cup', { montoConvertido: null }),
      sale('unknown', { moneda: null, montoConvertido: null }),
    ]);
    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0].replayables).toBe(1);
    expect(plan.omitidos).toEqual(expect.arrayContaining([
      expect.objectContaining({ origenId: 'unknown', causa: 'MONEDA_AUSENTE' }),
    ]));
    await ejecutarBackfillAutorizadoFixture();
    expect(replay).toHaveBeenCalledTimes(1);
    expect(replay.mock.calls[0][2]).toMatchObject({ moneda: 'CUP', montoFuncional: '10' });
  });

  it('normalizes padded source and functional currencies before same-currency valuation', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      sale('padded-cup', {
        moneda: ' CUP ',
        functionalCurrency: ' cup ',
        montoConvertido: null,
        tasaCambio: null,
        fxEvidenceFingerprint: null,
      }),
    ]);

    const plan = await planBackfillContable('tenant');

    expect(plan.periodos[0].replayables).toBe(1);
    expect(plan.omitidos).toEqual([]);

    const result = await ejecutarBackfillAutorizadoFixture();

    expect(result).toMatchObject({ contabilizados: 1, omitidos: 0 });
    expect(replay.mock.calls[0][2]).toMatchObject({
      moneda: 'CUP',
      monedaFuncional: 'CUP',
      montoFuncional: '10',
    });
  });

  it('omits inconsistent converted amount for normalized same-currency source', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      sale('inconsistent-same-currency', {
        moneda: ' CUP ',
        functionalCurrency: ' cup ',
        monto: new Prisma.Decimal('10'),
        montoConvertido: new Prisma.Decimal('11'),
        tasaCambio: null,
        fxEvidenceFingerprint: null,
      }),
    ]);

    const plan = await planBackfillContable('tenant');

    expect(plan.periodos[0].replayables).toBe(0);
    expect(plan.omitidos).toContainEqual(expect.objectContaining({
      origenId: 'inconsistent-same-currency',
      causa: 'CONVERSION_MISMA_MONEDA_INCONSISTENTE',
    }));

    const result = await ejecutarBackfillAutorizadoFixture();

    expect(result).toMatchObject({ contabilizados: 0, omitidos: 1 });
    expect(replay).not.toHaveBeenCalled();
  });

  it('uses transferencia monedaOrigen and does not omit valid CUP transfer', async () => {
    db.transferenciaBancaria.findMany.mockResolvedValue([{ transferenciaId: 't', fechaTransferencia: date, monedaOrigen: 'CUP', montoOrigen: 50, montoDestino: 50, tasaCambio: null, fxEvidenceFingerprint: null }]);
    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0].replayables).toBe(1);
    await ejecutarBackfillAutorizadoFixture();
    expect(replay.mock.calls[0][2]).toMatchObject({ moneda: 'CUP', montoFuncional: '50' });
    expect(String(replay.mock.calls[0][2].monto)).toBe('50');
  });

  it('uses persisted functional amount, not foreign destination amount, for CUP to foreign transfer', async () => {
    db.transferenciaBancaria.findMany.mockResolvedValue([{
      transferenciaId: 'cup-usd', fechaTransferencia: date, monedaOrigen: 'CUP',
      monedaDestino: 'USD', montoOrigen: 240, montoDestino: 10,
      montoConvertido: 240,
    }]);
    const plan = await planBackfillContable('tenant');
    expect(plan.periodos[0].replayables).toBe(1);
    await ejecutarBackfillAutorizadoFixture();
    expect(replay.mock.calls[0][2]).toMatchObject({ moneda: 'CUP', montoFuncional: '240' });
    expect(String(replay.mock.calls[0][2].monto)).toBe('240');
  });

  it('does not execute invalid FX and merma rows while executing a valid source', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([sale('fx', { moneda: 'USD', montoConvertido: 240, tasaCambio: null, fxEvidenceFingerprint: null }), sale('valid')]);
    db.merma.findMany.mockResolvedValue([{ mermaId: 'm', createdAt: date, costoTotal: null }]);
    const result = await ejecutarBackfillAutorizadoFixture();
    expect(result).toMatchObject({ contabilizados: 1, omitidos: 2 });
    expect(replay).toHaveBeenCalledTimes(1);
    expect(replay.mock.calls[0][2].origen.id).toBe('valid');
  });
});

describe('authorized replay lifecycle', () => {
  it('rejects planning when the current license disables formal accounting', async () => {
    db.tenantLicense.findFirst.mockResolvedValue({
      plan: { features: { 'contabilidad-formal': false } }, featureOverrides: null, features: null,
    });

    await expect(planBackfillContable('tenant')).rejects.toThrow();

    expect(db.periodoContable.findMany).not.toHaveBeenCalled();
  });

  it('rejects preflight creation when the current license disables formal accounting', async () => {
    db.tenantLicense.findFirst.mockResolvedValue({
      plan: { features: { 'contabilidad-formal': false } }, featureOverrides: null, features: null,
    });

    await expect(crearPreflightBackfill('tenant', 'p', 'requester')).rejects.toThrow();

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.replayPreflight.create).not.toHaveBeenCalled();
  });

  it('rejects approval when the current license disables formal accounting', async () => {
    const snapshot = {
      tenantId: 'tenant',
      period: { periodId: 'p', startsAt: period.fechaInicio, endsAt: period.fechaFin },
      sources: [],
    };
    const generatedAt = new Date(Date.now() - 1000);
    db.tenantLicense.findFirst.mockResolvedValue(null);
    db.replayPreflight.findFirst.mockResolvedValue({
      replayPreflightId: 'preflight-1', tenantId: 'tenant', periodoId: 'p', requestedByUserId: 'requester',
      generatedAt, expiresAt: new Date(generatedAt.getTime() + 86_400_000),
      digestVersion: 2, digest: computeReplayPreflightDigest(snapshot), snapshot, status: 'READY',
    });

    await expect(aprobarPreflightBackfill('tenant', 'preflight-1', 'approver')).rejects.toThrow();

    expect(db.replayPreflight.findFirst).not.toHaveBeenCalled();
    expect(db.replayApproval.create).not.toHaveBeenCalled();
  });

  it('rejects the legacy direct service path without current entitlement', async () => {
    db.tenantLicense.findFirst.mockResolvedValue(null);

    await expect(ejecutarBackfillPeriodo('tenant', 'p', 'actor')).rejects.toThrow();

    expect(db.replayPreflight.findFirst).not.toHaveBeenCalled();
    expect(replay).not.toHaveBeenCalled();
  });

  it('rejects the approved direct service path when the current license disables the feature', async () => {
    db.tenantLicense.findFirst.mockResolvedValue({
      plan: { features: { 'contabilidad-formal': false } }, featureOverrides: null, features: null,
    });

    await expect(ejecutarBackfillAutorizado({
      tenantId: 'tenant', replayPreflightId: 'preflight-1', replayApprovalId: 'approval-1', actorId: 'runner',
    })).rejects.toThrow();

    expect(db.replayPreflight.findFirst).not.toHaveBeenCalled();
    expect(replay).not.toHaveBeenCalled();
  });

  it('resolves requester defaults from the current membership role instead of manager defaults', async () => {
    db.tenantMembership.findFirst.mockResolvedValue({
      userId: 'requester', tenantRole: 'dependiente', isActive: true, user: { isActive: true }, customRole: null,
    });

    await expect(crearPreflightBackfill('tenant', 'p', 'requester')).rejects.toThrow();

    expect(db.replayPreflight.create).not.toHaveBeenCalled();
  });

  it('rejects the legacy direct executor when no persisted approval exists', async () => {
    db.replayPreflight.findFirst.mockResolvedValue(null);

    await expect(ejecutarBackfillPeriodo('tenant', 'p', 'actor')).rejects.toThrow(/preflight vigente/);

    expect(replay).not.toHaveBeenCalled();
  });

  it('persists a tenant-period snapshot digest with an exact 24-hour expiry', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([sale('preflight-source')]);

    const created = await crearPreflightBackfill('tenant', 'p', 'requester');

    const data = db.replayPreflight.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ tenantId: 'tenant', periodoId: 'p', requestedByUserId: 'requester', status: 'READY' });
    expect(data.digestVersion).toBe(2);
    expect(data.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(data.expiresAt.getTime() - data.generatedAt.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(created.replayPreflightId).toBe('preflight-1');
    expect(db.tenantLicense.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant', activa: true, expiracion: { gt: expect.any(Date) },
      }),
      include: { plan: { select: { features: true } } },
      orderBy: { inicio: 'desc' },
    }));
  });

  it('persists the preflight inside the same transaction as its authorized snapshot', async () => {
    let transactionActive = false;
    let persistedWithinTransaction = false;
    db.$transaction.mockImplementation(async (callback) => {
      transactionActive = true;
      try {
        return await callback(db);
      } finally {
        transactionActive = false;
      }
    });
    db.replayPreflight.create.mockImplementation(async ({ data }) => {
      persistedWithinTransaction = transactionActive;
      return { replayPreflightId: 'preflight-1', ...data };
    });

    await crearPreflightBackfill('tenant', 'p', 'requester');

    expect(persistedWithinTransaction).toBe(true);
    expect(db.replayPreflight.create).toHaveBeenCalledTimes(1);
  });

  it('builds and persists preflight snapshots at serializable isolation', async () => {
    await crearPreflightBackfill('tenant', 'p', 'requester');

    expect(db.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });

  it('surfaces serialization conflicts without retrying or persisting a preflight', async () => {
    const serializationFailure = Object.assign(new Error('Serialization conflict'), { code: 'P2034' });
    db.$transaction.mockRejectedValueOnce(serializationFailure);

    await expect(crearPreflightBackfill('tenant', 'p', 'requester')).rejects.toBe(serializationFailure);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.replayPreflight.create).not.toHaveBeenCalled();
  });

  it('requires a distinct active manager with current tenant permission to approve', async () => {
    const snapshot = {
      tenantId: 'tenant',
      period: { periodId: 'p', startsAt: period.fechaInicio, endsAt: period.fechaFin },
      sources: [],
    };
    const generatedAt = new Date(Date.now() - 1000);
    db.replayPreflight.findFirst.mockResolvedValue({
      replayPreflightId: 'preflight-1', tenantId: 'tenant', periodoId: 'p', requestedByUserId: 'requester',
      generatedAt, expiresAt: new Date(generatedAt.getTime() + 86_400_000),
      digestVersion: 2, digest: computeReplayPreflightDigest(snapshot), snapshot, status: 'READY',
    });
    db.tenantMembership.findFirst.mockResolvedValue({
      userId: 'approver', tenantRole: 'manager', isActive: true, user: { isActive: true }, customRole: null,
    });

    await aprobarPreflightBackfill('tenant', 'preflight-1', 'approver');
    expect(db.tenantMembership.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant', userId: 'approver', isActive: true }),
    }));
    expect(db.replayApproval.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ requestedByUserId: 'requester', approvedByUserId: 'approver' }),
    }));
  });

  it('rejects a manager whose current custom role no longer grants accounting access', async () => {
    const snapshot = {
      tenantId: 'tenant',
      period: { periodId: 'p', startsAt: period.fechaInicio, endsAt: period.fechaFin },
      sources: [],
    };
    const generatedAt = new Date(Date.now() - 1000);
    db.replayPreflight.findFirst.mockResolvedValue({
      replayPreflightId: 'preflight-1', tenantId: 'tenant', periodoId: 'p', requestedByUserId: 'requester',
      generatedAt, expiresAt: new Date(generatedAt.getTime() + 86_400_000),
      digestVersion: 2, digest: computeReplayPreflightDigest(snapshot), snapshot, status: 'READY',
    });
    db.tenantMembership.findFirst.mockResolvedValue({
      userId: 'approver', tenantRole: 'manager', isActive: true, user: { isActive: true },
      customRoleId: 'role-1', customRole: { tenantId: 'tenant', isActive: true, permissions: [] },
    });

    await expect(aprobarPreflightBackfill('tenant', 'preflight-1', 'approver')).rejects.toThrow(/Permiso contable actual/);

    expect(db.replayApproval.create).not.toHaveBeenCalled();
  });

  it('rejects requester self-approval before persisting approval', async () => {
    const snapshot = {
      tenantId: 'tenant',
      period: { periodId: 'p', startsAt: period.fechaInicio, endsAt: period.fechaFin },
      sources: [],
    };
    const generatedAt = new Date(Date.now() - 1000);
    db.replayPreflight.findFirst.mockResolvedValue({
      replayPreflightId: 'preflight-1', tenantId: 'tenant', periodoId: 'p', requestedByUserId: 'requester',
      generatedAt, expiresAt: new Date(generatedAt.getTime() + 86_400_000),
      digestVersion: 2, digest: computeReplayPreflightDigest(snapshot), snapshot, status: 'READY',
    });

    await expect(aprobarPreflightBackfill('tenant', 'preflight-1', 'requester')).rejects.toThrow(/independiente/);

    expect(db.replayApproval.create).not.toHaveBeenCalled();
  });

  it('rejects approval if current sources already drifted from the generated snapshot', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([sale('before-approval')]);
    await crearPreflightBackfill('tenant', 'p', 'requester');
    const persisted = db.replayPreflight.create.mock.calls[0][0].data;
    db.replayPreflight.findFirst.mockResolvedValue({ replayPreflightId: 'preflight-1', ...persisted });
    db.reconciliacionVenta.findMany.mockResolvedValue([sale('drift-before-approval')]);

    await expect(aprobarPreflightBackfill('tenant', 'preflight-1', 'approver')).rejects.toThrow(/cambiaron antes de aprobar/);

    expect(db.replayApproval.create).not.toHaveBeenCalled();
  });

  it('rejects execution when the persisted source snapshot has drifted', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([sale('original-source')]);
    await crearPreflightBackfill('tenant', 'p', 'requester');
    const persisted = db.replayPreflight.create.mock.calls[0][0].data;
    db.replayPreflight.findFirst.mockResolvedValue({
      replayPreflightId: 'preflight-1', ...persisted,
    });
    db.replayApproval.findFirst.mockResolvedValue({
      replayApprovalId: 'approval-1', tenantId: 'tenant', replayPreflightId: 'preflight-1',
      requestedByUserId: 'requester', approvedByUserId: 'approver', digestVersion: 2,
      digest: persisted.digest, status: 'APPROVED',
    });
    db.reconciliacionVenta.findMany.mockResolvedValue([sale('changed-source')]);

    await expect(ejecutarBackfillAutorizado({
      tenantId: 'tenant', replayPreflightId: 'preflight-1', replayApprovalId: 'approval-1', actorId: 'runner',
    })).rejects.toThrow();

    expect(replay).not.toHaveBeenCalled();
    expect(db.replayRun.create).not.toHaveBeenCalled();
  });

  it('records one-period run counts and binds every posted asiento to the run', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([
      sale('later-source', { fechaReconciliacion: new Date('2026-09-20T10:00:00Z') }),
      sale('earlier-source', { fechaReconciliacion: new Date('2026-09-05T10:00:00Z') }),
    ]);
    await crearPreflightBackfill('tenant', 'p', 'requester');
    const persisted = db.replayPreflight.create.mock.calls[0][0].data;
    db.replayPreflight.findFirst.mockResolvedValue({ replayPreflightId: 'preflight-1', ...persisted });
    const approval = await aprobarPreflightBackfill('tenant', 'preflight-1', 'approver');
    db.replayPreflight.findFirst.mockResolvedValue({ replayPreflightId: 'preflight-1', ...persisted, status: 'APPROVED' });
    db.replayApproval.findFirst.mockResolvedValue(approval);
    db.asiento.findMany.mockImplementation(async (args) => args?.include?.lineas
      ? ledgerEvidence(persisted.snapshot) : []);
    replay.mockImplementation(async (_tx, _actor, event) => ({
      estado: 'CONTABILIZADO', asientoId: `asiento-${event.origen.id}`,
    }));

    const result = await ejecutarBackfillAutorizado({
      tenantId: 'tenant', replayPreflightId: 'preflight-1', replayApprovalId: 'approval-1', actorId: 'runner',
    });

    expect(result).toMatchObject({
      replayRunId: 'run-1', status: 'COMPLETED', contabilizados: 2, yaPosteados: 0, omitidos: 0,
      reconciliation: { status: 'CONFORME', expectedCount: 2, matchedCount: 2, differences: [] },
    });
    expect(replay).toHaveBeenCalledTimes(2);
    expect(replay.mock.calls[0][3]).toBe('p');
    expect(replay.mock.calls.map((call) => call[2].origen.id)).toEqual(['earlier-source', 'later-source']);
    expect(db.asiento.update).toHaveBeenNthCalledWith(1, {
      where: { asientoId: 'asiento-earlier-source' }, data: { replayRunId: 'run-1' },
    });
    expect(db.asiento.update).toHaveBeenNthCalledWith(2, {
      where: { asientoId: 'asiento-later-source' }, data: { replayRunId: 'run-1' },
    });
    expect(db.replayRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { replayRunId: 'run-1' },
      data: expect.objectContaining({ status: 'COMPLETED', postedCount: 2 }),
    }));
  });

  it('does not claim financial success when a successful posting lacks persisted evidence', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([sale('missing-ledger')]);
    const outcome = await ejecutarBackfillAutorizadoFixture();
    expect(outcome).toMatchObject({
      status: 'NO_CONFORME', replayRunId: 'run-1', contabilizados: 1,
      reconciliation: { status: 'NO_CONFORME', differences: [
        { sourceType: 'reconciliacion_venta', sourceId: 'missing-ledger', cause: 'MISSING_ENTRY' },
      ] },
    });
    expect(db.replayRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'NO_CONFORME', diagnostic: expect.objectContaining({
        reconciliation: outcome.reconciliation,
      }) }),
    }));
  });

  it('persists FAILED after the posting transaction rolls back', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([sale('failing-source')]);
    replay.mockRejectedValueOnce(new Error('posting failure'));

    await expect(ejecutarBackfillAutorizadoFixture()).rejects.toThrow('posting failure');

    expect(db.replayRun.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { replayRunId: 'run-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        diagnostic: expect.objectContaining({
          error: 'posting failure',
          periodGuardBypass: expect.objectContaining({
            capability: 'AUTHORIZED_HISTORICAL_REPLAY', actorId: 'actor',
          }),
        }),
      }),
    }));
  });

  it('runs approval revalidation, RUNNING, postings and FAILED in one serializable transaction', async () => {
    db.reconciliacionVenta.findMany.mockResolvedValue([sale('failing-source')]);
    const preflight = await crearPreflightBackfill('tenant', 'p', 'requester');
    const persisted = db.replayPreflight.create.mock.calls.at(-1)![0].data;
    db.replayPreflight.findFirst.mockResolvedValue({ replayPreflightId: 'preflight-1', ...persisted });
    const approval = await aprobarPreflightBackfill('tenant', 'preflight-1', 'approver');
    db.replayPreflight.findFirst.mockResolvedValue({ replayPreflightId: 'preflight-1', ...persisted, status: 'APPROVED' });
    db.replayApproval.findFirst.mockResolvedValue(approval);
    db.$transaction.mockClear();
    replay.mockRejectedValueOnce(new Error('posting failure'));

    await expect(ejecutarBackfillAutorizado({
      tenantId: 'tenant', replayPreflightId: preflight.replayPreflightId,
      replayApprovalId: approval.replayApprovalId, actorId: 'actor',
    })).rejects.toThrow('posting failure');

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 },
    );
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith('SAVEPOINT replay_period_postings');
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT replay_period_postings');
    expect(db.replayRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { replayRunId: 'run-1' }, data: expect.objectContaining({ status: 'FAILED' }),
    }));
  });
});
