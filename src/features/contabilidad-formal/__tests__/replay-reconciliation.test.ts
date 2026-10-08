import { describe, expect, it } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { reconcileReplaySnapshot } from '@/features/contabilidad-formal/services/replay-reconciliation';

const snapshot = {
  tenantId: 'tenant', period: { periodId: 'period', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-30T23:59:59Z' },
  sources: [{
    identity: { sourceType: 'sale', sourceId: '1' }, classification: 'REPLAYABLE', omissionCause: null,
    semantics: { tipo: 'VENTA_CONTADO', fecha: '2026-09-15T12:00:00Z', descripcion: 'Sale', medioCobro: null, referencia: null,
      auxiliares: { costoFifo: null, intereses: null, montoPagado: null, diferenciaFx: null } },
    valuation: { originalAmount: '9007199254740993.125', originalCurrency: 'CUP',
      functionalAmount: '9007199254740993.125', functionalCurrency: 'CUP', fxRate: null, fxEvidenceFingerprint: null },
  }],
};
const line = { monedaOriginal: 'CUP', montoOriginal: new Prisma.Decimal('9007199254740993.125'),
  tasaCambio: null, fxEvidenceFingerprint: null, debe: new Prisma.Decimal('9007199254740993.125'), haber: new Prisma.Decimal(0) };
const row = { tenantId: 'tenant', periodoId: 'period', replayRunId: 'run', estado: 'CONTABILIZADO',
  origenTipo: 'sale', origenId: '1', fecha: new Date(snapshot.sources[0].semantics.fecha), descripcion: 'Sale',
  lineas: [line, { ...line, debe: new Prisma.Decimal(0), haber: line.debe }] };

describe('approved replay snapshot reconciliation', () => {
  it('reconciles source evidence and exact Decimal balance without Number conversion', () => {
    expect(reconcileReplaySnapshot(snapshot, [row], 'run')).toMatchObject({
      status: 'CONFORME', expectedCount: 1, matchedCount: 1, differences: [],
    });
  });
  it('does not mark absent ledger sources conforming', () => {
    expect(reconcileReplaySnapshot(snapshot, [], 'run')).toMatchObject({
      status: 'NO_CONFORME', differences: [expect.objectContaining({ cause: 'MISSING_ENTRY' })],
    });
  });
  it('reports exact post-write differences instead of publishing success', () => {
    const changed = { ...row, lineas: [{ ...line, debe: line.debe.plus('0.0001') }, row.lineas[1]] };
    expect(reconcileReplaySnapshot(snapshot, [changed], 'run')).toMatchObject({
      status: 'NO_CONFORME', differences: expect.arrayContaining([
        expect.objectContaining({ cause: 'UNBALANCED_ENTRY', difference: '0.0001' }),
      ]),
    });
  });
  it.each([
    { ...row, periodoId: 'other' }, { ...row, tenantId: 'other' },
    { ...row, replayRunId: 'other' }, { ...row, descripcion: 'Changed' },
    { ...row, lineas: row.lineas.map((value) => ({ ...value, montoOriginal: new Prisma.Decimal('1') })) },
  ])('rejects scope, lineage or source valuation mismatch', (changed) => {
    expect(reconcileReplaySnapshot(snapshot, [changed], 'run').status).toBe('NO_CONFORME');
  });
});
