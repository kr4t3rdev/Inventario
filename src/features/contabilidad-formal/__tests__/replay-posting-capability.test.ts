import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';
import type { EventoContableInput } from '@/features/contabilidad-formal/services/posting-engine';
import { computeReplayPreflightDigest } from '@/features/contabilidad-formal/services/replay-preflight-digest';
import {
  assertReplayPostingCapability,
  withReplayPostingCapability,
} from '@/features/contabilidad-formal/services/replay-posting-capability';

const event: EventoContableInput = {
  tipo: 'VENTA_CONTADO', fecha: new Date('2026-09-15T12:00:00Z'), descripcion: 'Venta',
  origen: { tipo: 'reconciliacion_venta', id: 'sale' }, monto: '10', moneda: 'CUP',
  montoFuncional: '10', monedaFuncional: 'CUP',
};
const snapshot = {
  tenantId: 'tenant',
  period: { periodId: 'period', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-30T23:59:59Z' },
  sources: [{
    identity: { sourceType: event.origen.tipo, sourceId: event.origen.id },
    classification: 'REPLAYABLE', omissionCause: null,
    semantics: {
      tipo: event.tipo, fecha: event.fecha, descripcion: event.descripcion,
      medioCobro: null, referencia: null,
      auxiliares: { costoFifo: null, intereses: null, montoPagado: null, diferenciaFx: null },
    },
    valuation: {
      originalAmount: '10', originalCurrency: 'CUP', functionalAmount: '10',
      functionalCurrency: 'CUP', fxRate: null, fxEvidenceFingerprint: null,
    },
  }],
};
const digest = computeReplayPreflightDigest(snapshot);
const findUnique = vi.fn();
const membership = vi.fn();
const license = vi.fn();
const tx = {
  replayRun: { findUnique }, tenantMembership: { findFirst: membership },
  tenantLicense: { findFirst: license },
} as unknown as Prisma.TransactionClient;
const scope = { tenantId: 'tenant', userId: 'actor' };
const input = { ...scope, periodoId: 'period', replayRunId: 'run' };

/** @description Creates a persisted independently approved active replay run fixture. */
function approvedRun() {
  const generatedAt = new Date(Date.now() - 1000);
  return {
    ...input, startedByUserId: 'actor', replayPreflightId: 'preflight',
    replayApprovalId: 'approval', status: 'RUNNING', digestVersion: 2, digest,
    preflight: {
      tenantId: 'tenant', periodoId: 'period', replayPreflightId: 'preflight',
      requestedByUserId: 'requester', status: 'APPROVED', digestVersion: 2, digest,
      generatedAt, expiresAt: new Date(generatedAt.getTime() + 86_400_000), snapshot,
    },
    approval: {
      tenantId: 'tenant', replayPreflightId: 'preflight', replayApprovalId: 'approval',
      requestedByUserId: 'requester', approvedByUserId: 'approver',
      status: 'APPROVED', digestVersion: 2, digest,
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  findUnique.mockResolvedValue(approvedRun());
  membership.mockResolvedValue({
    tenantRole: 'manager', isActive: true, user: { isActive: true }, customRole: null,
  });
  license.mockResolvedValue({ plan: { features: { 'contabilidad-formal': true } } });
});

describe('runtime historical replay capability', () => {
  it('rejects absent, forged and serialized capabilities', () => {
    for (const token of [undefined, {}, JSON.parse('{}')]) {
      expect(() => assertReplayPostingCapability(token, tx, scope, event, 'period'))
        .toThrow('Capacidad de replay no válida');
    }
  });

  it('binds the capability to transaction, tenant, actor, period and approved event', async () => {
    await withReplayPostingCapability(tx, input, async (token) => {
      expect(() => assertReplayPostingCapability(token, tx, scope, event, 'period')).not.toThrow();
      for (const [client, actor, source, periodId] of [
        [{}, scope, event, 'period'],
        [tx, { ...scope, tenantId: 'other' }, event, 'period'],
        [tx, { ...scope, userId: 'other' }, event, 'period'],
        [tx, scope, event, 'other'],
        [tx, scope, { ...event, montoFuncional: '11' }, 'period'],
        [tx, scope, { ...event, origen: { ...event.origen, id: 'other' } }, 'period'],
      ] as const) {
        expect(() => assertReplayPostingCapability(token, client as Prisma.TransactionClient,
          actor, source, periodId)).toThrow('Capacidad de replay no válida');
      }
    });
  });

  it.each([false, true])('revokes the capability after callback settlement (failure=%s)', async (fail) => {
    let leaked: unknown;
    const execution = withReplayPostingCapability(tx, input, async (token) => {
      leaked = token;
      if (fail) throw new Error('posting failure');
    });
    if (fail) await expect(execution).rejects.toThrow('posting failure');
    else await execution;
    expect(() => assertReplayPostingCapability(leaked, tx, scope, event, 'period')).toThrow();
  });

  it.each(['FAILED', 'COMPLETED'])('does not mint for a %s run', async (status) => {
    findUnique.mockResolvedValue({ ...approvedRun(), status });
    const callback = vi.fn();
    await expect(withReplayPostingCapability(tx, input, callback)).rejects.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not mint for self-approval or expired/mismatched preflight', async () => {
    const run = approvedRun();
    for (const invalid of [
      { ...run, approval: { ...run.approval, approvedByUserId: 'requester' } },
      { ...run, preflight: { ...run.preflight, expiresAt: new Date(0) } },
      { ...run, digest: 'changed' },
    ]) {
      findUnique.mockResolvedValue(invalid);
      await expect(withReplayPostingCapability(tx, input, vi.fn())).rejects.toThrow();
    }
  });

  it('rejects missing proof and expires a capability during its scope', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(withReplayPostingCapability(tx, input, vi.fn())).rejects.toThrow();
    await withReplayPostingCapability(tx, input, async (token) => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(Date.now() + 86_400_001);
        expect(() => assertReplayPostingCapability(token, tx, scope, event, 'period')).toThrow();
      } finally { vi.useRealTimers(); }
    });
  });

  it('revalidates current license and actor/approver permission before minting', async () => {
    membership.mockResolvedValueOnce(null);
    await expect(withReplayPostingCapability(tx, input, vi.fn())).rejects.toThrow();
    license.mockResolvedValueOnce(null);
    await expect(withReplayPostingCapability(tx, input, vi.fn())).rejects.toThrow();
  });
});
