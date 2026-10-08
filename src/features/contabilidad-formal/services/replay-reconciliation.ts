import { Prisma } from '@/generated/prisma';
import type { ReplayPreflightDigestSnapshot } from './replay-preflight-digest';

/** Persisted evidence inspected within the owning replay transaction. */
export interface ReplayLedgerEvidence {
  tenantId: string;
  periodoId: string;
  replayRunId: string | null;
  estado: string;
  origenTipo: string;
  origenId: string;
  fecha: Date;
  descripcion: string;
  lineas: Array<{
    debe: Prisma.Decimal;
    haber: Prisma.Decimal;
    monedaOriginal: string;
    montoOriginal: Prisma.Decimal;
    tasaCambio: Prisma.Decimal | null;
    fxEvidenceFingerprint: string | null;
  }>;
}
interface ReplayDifference extends Prisma.InputJsonObject {
  sourceType: string;
  sourceId: string;
  cause: string;
  difference?: string;
}

/**
 * @description Reconciles approved source identities/valuation against persisted ledger evidence.
 * @param snapshot - Immutable approved period snapshot, not a new valuation.
 * @param entries - Ledger rows read in the same transaction after postings.
 * @param replayRunId - Lineage required for newly replayable sources.
 * @returns Scoped reconciliation diagnostics; never substitutes for the broader R4/enforce gate.
 */
export function reconcileReplaySnapshot(
  snapshot: ReplayPreflightDigestSnapshot,
  entries: ReplayLedgerEvidence[],
  replayRunId: string,
) {
  const differences: ReplayDifference[] = [];
  const expected = snapshot.sources.filter((source) =>
    source.classification === 'REPLAYABLE' || source.classification === 'YA_POSTEADO');
  let matchedCount = 0;
  for (const source of expected) {
    const { sourceType, sourceId } = source.identity;
    const rows = entries.filter((row) => row.origenTipo === sourceType && row.origenId === sourceId);
    const add = (cause: string, difference?: string): void => {
      differences.push({ sourceType, sourceId, cause, ...(difference ? { difference } : {}) });
    };
    if (rows.length !== 1) { add(rows.length ? 'DUPLICATE_ENTRY' : 'MISSING_ENTRY'); continue; }
    const row = rows[0];
    const before = differences.length;
    if (row.tenantId !== snapshot.tenantId || row.periodoId !== snapshot.period.periodId ||
      row.estado !== 'CONTABILIZADO' ||
      row.fecha.getTime() !== new Date(source.semantics.fecha).getTime() ||
      row.descripcion !== source.semantics.descripcion) add('ENTRY_SCOPE_OR_SEMANTICS_MISMATCH');
    if (source.classification === 'REPLAYABLE' && row.replayRunId !== replayRunId)
      add('REPLAY_LINEAGE_MISMATCH');
    const debit = row.lineas.reduce((sum, line) => sum.add(line.debe), new Prisma.Decimal(0));
    const credit = row.lineas.reduce((sum, line) => sum.add(line.haber), new Prisma.Decimal(0));
    if (!debit.eq(credit)) add('UNBALANCED_ENTRY', debit.sub(credit).toFixed());
    if (row.lineas.length < 2 || row.lineas.some((line) =>
      line.debe.lt(0) || line.haber.lt(0) || line.debe.gt(0) === line.haber.gt(0)))
      add('INVALID_ENTRY_LINES');
    const value = source.valuation;
    const functional = value.functionalAmount === null ? null
      : new Prisma.Decimal(value.functionalAmount).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    const original = value.originalAmount === null ? null : new Prisma.Decimal(value.originalAmount);
    const rate = value.fxRate === null ? null : new Prisma.Decimal(value.fxRate);
    const matchesValuation = original && functional && row.lineas.some((line) =>
      line.monedaOriginal === value.originalCurrency && line.montoOriginal.eq(original) &&
      (rate === null ? line.tasaCambio === null : line.tasaCambio?.eq(rate)) &&
      line.fxEvidenceFingerprint === value.fxEvidenceFingerprint &&
      (line.debe.eq(functional) || line.haber.eq(functional)));
    if (!matchesValuation) add('SOURCE_VALUATION_MISMATCH');
    if (before === differences.length) matchedCount += 1;
  }
  return {
    scope: 'APPROVED_SOURCE_SNAPSHOT' as const,
    status: differences.length ? 'NO_CONFORME' as const : 'CONFORME' as const,
    expectedCount: expected.length, matchedCount, differences,
    enforceReady: false as const,
  };
}
