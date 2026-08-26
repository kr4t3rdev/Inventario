import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyAccountingPolicyRollout,
  runAccountingPolicyDryRun,
  runAccountingPolicyCli,
} from './accounting-policy-rollout';
import type { AccountingPolicyRolloutGates } from './lib/accounting-policy-rollout-gates';

const capabilityMock = vi.hoisted(() => vi.fn());
const preflightMock = vi.hoisted(() => vi.fn());
const provisionMock = vi.hoisted(() => vi.fn());
const retentionMock = vi.hoisted(() => vi.fn());
const rolloutMetricsMock = vi.hoisted(() => ({
  accountingPolicyPreflightCounter: { inc: vi.fn() },
  accountingPolicyRolloutEntriesCounter: { inc: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({
  accountingPolicyRolloutRun: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  accountingPolicyRolloutEntry: {
    createMany: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  accountingPolicyTenantApproval: { findMany: vi.fn() },
}));

vi.mock('@/lib/auth/accounting-policy-capabilities', () => ({
  canRunAccountingPolicyRollout: capabilityMock,
}));
vi.mock('@/features/contabilidad/services/accounting-policy-preflight-service', () => ({
  preflightAccountingPoliciesForRollout: preflightMock,
}));
vi.mock('@/features/contabilidad/services/tenant-accounting-policy-service', () => ({
  provisionTenantAccountingPolicy: provisionMock,
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/services/audit-log-service', () => ({
  verifyAccountingPolicyAuditRetention: retentionMock,
}));
vi.mock('@/lib/metrics', () => rolloutMetricsMock);

const manifest = {
  version: 1 as const,
  reason: 'Remediación aprobada por control interno',
  platformApproval: {
    approverUserId: 'approver-a',
    reference: 'CAB-123',
    approvedAt: '2026-08-25T12:00:00.000Z',
  },
  entries: [{
    tenantId: 'tenant-a',
    functionalCurrencyCode: 'CUP',
    expectedClassification: 'MISSING_NO_EVIDENCE' as const,
    origin: 'ROLLOUT' as const,
    reason: 'CUP confirmada explícitamente',
  }],
};

const productionGates: AccountingPolicyRolloutGates = {
  capabilityMappings: { verified: true, evidenceRef: 'capability-check' },
  tenantResponsibles: { verified: true, evidenceRef: 'tenant-owners-check' },
  databaseBackup: { verified: true, evidenceRef: 'backup-check' },
  pilot: { verified: true, evidenceRef: 'pilot-check' },
};

describe('accounting policy rollout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capabilityMock.mockResolvedValue(true);
    retentionMock.mockResolvedValue(true);
    prismaMock.accountingPolicyRolloutRun.create.mockResolvedValue({ runId: 'run-a' });
    prismaMock.accountingPolicyRolloutRun.update.mockResolvedValue({ runId: 'run-a' });
    prismaMock.accountingPolicyRolloutEntry.createMany.mockResolvedValue({ count: 1 });
    prismaMock.accountingPolicyRolloutEntry.findMany.mockResolvedValue([
      { tenantId: 'tenant-a', projectedResult: 'CREATE' },
    ]);
    prismaMock.accountingPolicyTenantApproval.findMany.mockResolvedValue([]);
    preflightMock.mockResolvedValue({
      entries: [{ tenantId: 'tenant-a', classification: 'MISSING_NO_EVIDENCE' }],
      summary: { inspected: 1 },
    });
  });

  it('persiste un dry-run vinculante sin crear políticas', async () => {
    const result = await runAccountingPolicyDryRun({ manifest, executorUserId: 'operator-a' });

    expect(result.entries).toEqual([{ tenantId: 'tenant-a', projectedResult: 'CREATE' }]);
    expect(prismaMock.accountingPolicyRolloutRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mode: 'DRY_RUN', status: 'RUNNING' }),
      select: { runId: true },
    });
    expect(prismaMock.accountingPolicyRolloutEntry.createMany).toHaveBeenCalledOnce();
    expect(provisionMock).not.toHaveBeenCalled();
  });

  it('rechaza apply sin flag y sin tocar datos', async () => {
    await expect(applyAccountingPolicyRollout({
      manifest,
      dryRunId: 'dry-a',
      executorUserId: 'operator-a',
      correlationId: 'correlation-a',
      apply: false,
    })).rejects.toMatchObject({ code: 'APPLY_CONFIRMATION_REQUIRED' });

    expect(prismaMock.accountingPolicyRolloutRun.findFirst).not.toHaveBeenCalled();
    expect(provisionMock).not.toHaveBeenCalled();
  });

  it('proyecta BLOCKED si la aprobación tenant no es vigente y exacta', async () => {
    preflightMock.mockResolvedValue({
      entries: [{ tenantId: 'tenant-a', classification: 'MISSING_WITH_EVIDENCE' }],
      summary: { inspected: 1 },
    });
    const withEvidence = {
      ...manifest,
      entries: [{
        ...manifest.entries[0],
        expectedClassification: 'MISSING_WITH_EVIDENCE' as const,
        tenantApprovalId: 'approval-a',
      }],
    };

    const result = await runAccountingPolicyDryRun({
      manifest: withEvidence,
      executorUserId: 'operator-a',
    });

    expect(result.entries).toEqual([{ tenantId: 'tenant-a', projectedResult: 'BLOCKED' }]);
  });

  it('vincula apply al dry-run exacto y delega una transacción por tenant', async () => {
    prismaMock.accountingPolicyRolloutRun.findFirst.mockResolvedValue({ runId: 'dry-a' });
    prismaMock.accountingPolicyRolloutRun.create.mockResolvedValue({ runId: 'apply-a' });
    provisionMock.mockResolvedValue({
      result: 'CREATED',
      functionalCurrencyCode: 'CUP',
      existingCurrencyCode: null,
      evidence: 'NONE',
    });

    const result = await applyAccountingPolicyRollout({
      manifest,
      dryRunId: 'dry-a',
      executorUserId: 'operator-a',
      correlationId: 'correlation-a',
      apply: true,
      productionGates,
    });

    expect(result.entries).toEqual([{ tenantId: 'tenant-a', finalResult: 'CREATED' }]);
    expect(provisionMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      expectedEvidence: 'NONE',
      manifestHash: expect.any(String),
      platformApproverUserId: 'approver-a',
      correlationId: 'correlation-a',
    }));
  });

  it('rechaza autoaprobación y readiness incompleto antes del dry-run lookup', async () => {
    await expect(applyAccountingPolicyRollout({
      manifest: {
        ...manifest,
        platformApproval: { ...manifest.platformApproval, approverUserId: 'operator-a' },
      },
      dryRunId: 'dry-a',
      executorUserId: 'operator-a',
      correlationId: 'correlation-a',
      apply: true,
      productionGates,
    })).rejects.toMatchObject({ code: 'SEPARATION_OF_DUTIES_REQUIRED' });

    retentionMock.mockResolvedValue(false);
    await expect(applyAccountingPolicyRollout({
      manifest,
      dryRunId: 'dry-a',
      executorUserId: 'operator-a',
      correlationId: 'correlation-a',
      apply: true,
      productionGates,
    })).rejects.toMatchObject({ code: 'ROLLOUT_NOT_READY' });
    expect(prismaMock.accountingPolicyRolloutRun.findFirst).not.toHaveBeenCalled();
  });

  it('no confía en un indicador del caller cuando el servidor no confirma la retención', async () => {
    retentionMock.mockResolvedValue(false);

    await expect(applyAccountingPolicyRollout({
      manifest,
      dryRunId: 'dry-a',
      executorUserId: 'operator-a',
      correlationId: 'correlation-a',
      apply: true,
      productionGates,
    })).rejects.toMatchObject({ code: 'ROLLOUT_NOT_READY' });

    expect(prismaMock.accountingPolicyRolloutRun.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    'capabilityMappings',
    'tenantResponsibles',
    'databaseBackup',
    'pilot',
  ] as const)('bloquea apply antes de escribir si falta el gate %s', async (gate) => {
    const incompleteGates = {
      ...productionGates,
      [gate]: { verified: false, evidenceRef: '' },
    };

    await expect(applyAccountingPolicyRollout({
      manifest,
      dryRunId: 'dry-a',
      executorUserId: 'operator-a',
      correlationId: 'correlation-a',
      apply: true,
      productionGates: incompleteGates,
    })).rejects.toMatchObject({ code: 'ROLLOUT_NOT_READY' });

    expect(prismaMock.accountingPolicyRolloutRun.create).not.toHaveBeenCalled();
    expect(prismaMock.accountingPolicyRolloutEntry.createMany).not.toHaveBeenCalled();
    expect(provisionMock).not.toHaveBeenCalled();
  });

  it('concilia el total inspeccionado con el manifiesto antes de persistir el dry-run', async () => {
    preflightMock.mockResolvedValue({
      entries: [],
      summary: { inspected: 0 },
    });

    await expect(runAccountingPolicyDryRun({
      manifest,
      executorUserId: 'operator-a',
    })).rejects.toMatchObject({ code: 'PREFLIGHT_INCOMPLETE' });

    expect(prismaMock.accountingPolicyRolloutRun.create).not.toHaveBeenCalled();
    expect(prismaMock.accountingPolicyRolloutEntry.createMany).not.toHaveBeenCalled();
  });

  it('rechaza apply si la cardinalidad persistida del dry-run no coincide exactamente', async () => {
    prismaMock.accountingPolicyRolloutRun.findFirst.mockResolvedValue({ runId: 'dry-a' });
    prismaMock.accountingPolicyRolloutEntry.findMany.mockResolvedValue([
      { tenantId: 'tenant-a', projectedResult: 'CREATE' },
      { tenantId: 'tenant-extra', projectedResult: 'CREATE' },
    ]);

    await expect(applyAccountingPolicyRollout({
      manifest,
      dryRunId: 'dry-a',
      executorUserId: 'operator-a',
      correlationId: 'correlation-a',
      apply: true,
      productionGates,
    })).rejects.toMatchObject({ code: 'DRY_RUN_ENTRIES_MISMATCH' });

    expect(prismaMock.accountingPolicyRolloutRun.create).not.toHaveBeenCalled();
    expect(provisionMock).not.toHaveBeenCalled();
  });

  it('detiene el apply ante un conflicto no proyectado sin escribir entradas restantes', async () => {
    const twoTenants = {
      ...manifest,
      entries: [
        manifest.entries[0],
        { ...manifest.entries[0], tenantId: 'tenant-b', reason: 'CUP confirmada explícitamente' },
      ],
    };
    prismaMock.accountingPolicyRolloutRun.findFirst.mockResolvedValue({ runId: 'dry-a' });
    prismaMock.accountingPolicyRolloutEntry.findMany.mockResolvedValue([
      { tenantId: 'tenant-a', projectedResult: 'CREATE' },
      { tenantId: 'tenant-b', projectedResult: 'CREATE' },
    ]);
    let call = 0;
    provisionMock.mockImplementation(async (input: { tenantId: string }) => {
      call += 1;
      if (input.tenantId === 'tenant-a') {
        return {
          result: 'CONFLICT',
          functionalCurrencyCode: 'CUP',
          existingCurrencyCode: 'USD',
          evidence: 'NONE',
        };
      }
      return {
        result: 'CREATED',
        functionalCurrencyCode: 'CUP',
        existingCurrencyCode: null,
        evidence: 'NONE',
      };
    });

    await expect(applyAccountingPolicyRollout({
      manifest: twoTenants,
      dryRunId: 'dry-a',
      executorUserId: 'operator-a',
      correlationId: 'correlation-a',
      apply: true,
      productionGates,
    })).rejects.toMatchObject({ code: 'STOP_CONDITION_TRIGGERED' });

    expect(call).toBe(1);
    expect(prismaMock.accountingPolicyRolloutRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'STOPPED' }) }),
    );
  });

  it('bloquea el apply si una entrada creada estaba proyectada como bloqueada', async () => {
    prismaMock.accountingPolicyRolloutRun.findFirst.mockResolvedValue({ runId: 'dry-a' });
    prismaMock.accountingPolicyRolloutEntry.findMany.mockResolvedValue([
      { tenantId: 'tenant-a', projectedResult: 'BLOCKED' },
    ]);
    provisionMock.mockResolvedValue({
      result: 'CREATED',
      functionalCurrencyCode: 'CUP',
      existingCurrencyCode: null,
      evidence: 'PRESENT',
    });

    await expect(applyAccountingPolicyRollout({
      manifest,
      dryRunId: 'dry-a',
      executorUserId: 'operator-a',
      correlationId: 'correlation-a',
      apply: true,
      productionGates,
    })).rejects.toMatchObject({ code: 'STOP_CONDITION_TRIGGERED' });

    expect(provisionMock).not.toHaveBeenCalled();
    expect(prismaMock.accountingPolicyRolloutRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'STOPPED', summary: { BLOCKED: 1 } }),
      }),
    );
    expect(prismaMock.accountingPolicyRolloutEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          observedClassification: 'BLOCKED',
          finalResult: 'BLOCKED',
          safeError: expect.stringContaining('Apply detenido'),
        }),
      }),
    );
  });

  it('no marca como FAILED una política comprometida si falla el bookkeeping de la entrada', async () => {
    prismaMock.accountingPolicyRolloutRun.findFirst.mockResolvedValue({ runId: 'dry-a' });
    prismaMock.accountingPolicyRolloutEntry.findMany.mockResolvedValue([
      { tenantId: 'tenant-a', projectedResult: 'CREATE' },
    ]);
    provisionMock.mockResolvedValue({
      result: 'CREATED',
      functionalCurrencyCode: 'CUP',
      existingCurrencyCode: null,
      evidence: 'NONE',
    });
    prismaMock.accountingPolicyRolloutEntry.updateMany.mockRejectedValueOnce(
      new Error('rollout entry unavailable'),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(applyAccountingPolicyRollout({
      manifest,
      dryRunId: 'dry-a',
      executorUserId: 'operator-a',
      correlationId: 'correlation-a',
      apply: true,
      productionGates,
    })).rejects.toMatchObject({ code: 'STOP_CONDITION_TRIGGERED' });

    expect(provisionMock).toHaveBeenCalledOnce();
    expect(prismaMock.accountingPolicyRolloutEntry.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ finalResult: 'FAILED' }) }),
    );
    expect(prismaMock.accountingPolicyRolloutRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'STOPPED', summary: { CREATED: 1 } }),
      }),
    );
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('mantiene el resultado comprometido si falla el incremento de métricas', async () => {
    prismaMock.accountingPolicyRolloutRun.findFirst.mockResolvedValue({ runId: 'dry-a' });
    prismaMock.accountingPolicyRolloutEntry.findMany.mockResolvedValue([
      { tenantId: 'tenant-a', projectedResult: 'CREATE' },
    ]);
    provisionMock.mockResolvedValue({
      result: 'CREATED',
      functionalCurrencyCode: 'CUP',
      existingCurrencyCode: null,
      evidence: 'NONE',
    });
    rolloutMetricsMock.accountingPolicyRolloutEntriesCounter.inc.mockImplementationOnce(() => {
      throw new Error('metrics unavailable');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await applyAccountingPolicyRollout({
      manifest,
      dryRunId: 'dry-a',
      executorUserId: 'operator-a',
      correlationId: 'correlation-a',
      apply: true,
      productionGates,
    });

    expect(result.entries).toEqual([{ tenantId: 'tenant-a', finalResult: 'CREATED' }]);
    expect(prismaMock.accountingPolicyRolloutRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    );
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('detiene el apply si una entrada proyectada como creada termina bloqueada', async () => {
    prismaMock.accountingPolicyRolloutRun.findFirst.mockResolvedValue({ runId: 'dry-a' });
    prismaMock.accountingPolicyRolloutEntry.findMany.mockResolvedValue([
      { tenantId: 'tenant-a', projectedResult: 'CREATE' },
    ]);
    provisionMock.mockResolvedValue({
      result: 'BLOCKED',
      functionalCurrencyCode: 'CUP',
      existingCurrencyCode: null,
      evidence: 'REVIEW_REQUIRED',
    });

    await expect(applyAccountingPolicyRollout({
      manifest,
      dryRunId: 'dry-a',
      executorUserId: 'operator-a',
      correlationId: 'correlation-a',
      apply: true,
      productionGates,
    })).rejects.toMatchObject({ code: 'STOP_CONDITION_TRIGGERED' });

    expect(prismaMock.accountingPolicyRolloutRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'STOPPED' }) }),
    );
  });

  it('detiene y marca STOPPED el lote ante un fallo crítico de apply', async () => {
    const twoTenants = {
      ...manifest,
      entries: [
        manifest.entries[0],
        { ...manifest.entries[0], tenantId: 'tenant-b', reason: 'CUP confirmada explícitamente' },
      ],
    };
    prismaMock.accountingPolicyRolloutRun.findFirst.mockResolvedValue({ runId: 'dry-a' });
    prismaMock.accountingPolicyRolloutEntry.findMany.mockResolvedValue([
      { tenantId: 'tenant-a', projectedResult: 'CREATE' },
      { tenantId: 'tenant-b', projectedResult: 'CREATE' },
    ]);
    provisionMock.mockRejectedValue(new Error('audit persistence failed'));

    await expect(applyAccountingPolicyRollout({
      manifest: twoTenants,
      dryRunId: 'dry-a',
      executorUserId: 'operator-a',
      correlationId: 'correlation-a',
      apply: true,
      productionGates,
    })).rejects.toMatchObject({ code: 'STOP_CONDITION_TRIGGERED' });

    expect(provisionMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.accountingPolicyRolloutRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'STOPPED' }) }),
    );
  });
});

describe('accounting policy rollout resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capabilityMock.mockResolvedValue(true);
    prismaMock.accountingPolicyRolloutRun.create.mockResolvedValue({ runId: 'run-2' });
    prismaMock.accountingPolicyRolloutRun.update.mockResolvedValue({ runId: 'run-2' });
    prismaMock.accountingPolicyRolloutEntry.createMany.mockResolvedValue({ count: 1 });
    prismaMock.accountingPolicyRolloutEntry.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.accountingPolicyTenantApproval.findMany.mockResolvedValue([]);
    prismaMock.accountingPolicyRolloutEntry.findMany.mockResolvedValue([
      { tenantId: 'tenant-a', projectedResult: 'CREATE' },
    ]);
    preflightMock.mockResolvedValue({
      entries: [{ tenantId: 'tenant-a', classification: 'POLICY_PRESENT' }],
      summary: { inspected: 1 },
    });
  });

  it('converge a NO_OP al reanudar un lote interrumpido tras un alta previa', async () => {
    // Primera ejecución: el alta de tenant-a se confirmó y luego el proceso murió.
    prismaMock.accountingPolicyRolloutRun.findFirst.mockResolvedValue({ runId: 'dry-b' });
    provisionMock
      .mockResolvedValueOnce({
        result: 'CREATED',
        functionalCurrencyCode: 'CUP',
        existingCurrencyCode: null,
        evidence: 'NONE',
      })
      .mockResolvedValueOnce({
        result: 'NO_OP',
        functionalCurrencyCode: 'CUP',
        existingCurrencyCode: 'CUP',
        evidence: 'NONE',
      });

    const first = await applyAccountingPolicyRollout({
      manifest,
      dryRunId: 'dry-b',
      executorUserId: 'operator-a',
      correlationId: 'correlation-b',
      apply: true,
      productionGates,
    });
    expect(first.entries).toEqual([{ tenantId: 'tenant-a', finalResult: 'CREATED' }]);

    // Reanudación con nuevo dry-run vinculado: mismo manifiesto, resultado NO_OP.
    const resumed = await applyAccountingPolicyRollout({
      manifest,
      dryRunId: 'dry-c',
      executorUserId: 'operator-a',
      correlationId: 'correlation-c',
      apply: true,
      productionGates,
    });

    expect(resumed.runId).toBe('run-2');
    expect(resumed.entries).toEqual([{ tenantId: 'tenant-a', finalResult: 'NO_OP' }]);
    expect(provisionMock).toHaveBeenLastCalledWith(expect.objectContaining({
      tenantId: 'tenant-a',
      expectedEvidence: 'NONE',
    }));
  });
});

describe('accounting policy rollout CLI', () => {
  it('prints a safe message for unknown errors while logging the detail server-side', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    preflightMock.mockRejectedValueOnce(new Error('secret database path /srv/db'));

    const exitCode = await runAccountingPolicyCli([
      'preflight',
      '--tenants',
      'tenant-a',
      '--executor',
      'operator-a',
    ]);

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'accounting-policy-rollout failed',
      expect.objectContaining({ message: 'secret database path /srv/db' }),
    );
    expect(errorSpy).toHaveBeenCalledWith('ROLLOUT_CLI_ERROR: Error operativo seguro.');
    expect(errorSpy.mock.calls.some(([message]) =>
      typeof message === 'string' && message.includes('secret database path'))).toBe(false);
    errorSpy.mockRestore();
  });
});
