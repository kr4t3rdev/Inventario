/**
 * @description Tests de ergonomía operativa de la CLI de rollout de política
 *              contable: ayuda, códigos de salida diferenciados, apply que exige
 *              confirmación explícita no ambigua y salida libre de secretos.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { runAccountingPolicyCli } from './accounting-policy-rollout';

const execFileAsync = promisify(execFile);

const capabilityMock = vi.hoisted(() => vi.fn());
const preflightMock = vi.hoisted(() => vi.fn());
const provisionMock = vi.hoisted(() => vi.fn());
const retentionMock = vi.hoisted(() => vi.fn());
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
const readFileMock = vi.hoisted(() => vi.fn());

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
vi.mock('@/lib/db/platform-prisma', async () => ({
  prismaPlatform: prismaMock,
  default: prismaMock,
}));
vi.mock('@/lib/services/audit-log-service', () => ({
  verifyAccountingPolicyAuditRetention: retentionMock,
}));
vi.mock('node:fs/promises', () => ({
  readFile: readFileMock,
  default: { readFile: readFileMock },
}));

const validManifest = {
  version: 1,
  reason: 'Remediación aprobada',
  platformApproval: {
    approverUserId: 'approver-a',
    reference: 'CAB-123',
    approvedAt: '2026-08-25T12:00:00.000Z',
  },
  entries: [{
    tenantId: 'tenant-a',
    functionalCurrencyCode: 'CUP',
    expectedClassification: 'MISSING_NO_EVIDENCE',
    origin: 'ROLLOUT',
    reason: 'CUP confirmada explícitamente',
  }],
};

describe('accounting policy rollout cli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capabilityMock.mockResolvedValue(true);
    retentionMock.mockResolvedValue(true);
    readFileMock.mockResolvedValue(JSON.stringify(validManifest));
    preflightMock.mockResolvedValue({
      entries: [{ tenantId: 'tenant-a', classification: 'MISSING_NO_EVIDENCE' }],
      summary: { inspected: 1 },
    });
    prismaMock.accountingPolicyRolloutRun.create.mockResolvedValue({ runId: 'run-cli' });
    prismaMock.accountingPolicyRolloutRun.update.mockResolvedValue({ runId: 'run-cli' });
    prismaMock.accountingPolicyRolloutRun.findFirst.mockResolvedValue({ runId: 'dry-cli' });
    prismaMock.accountingPolicyRolloutEntry.findMany.mockResolvedValue([
      { tenantId: 'tenant-a', projectedResult: 'CREATE' },
    ]);
  });

  it('imprime ayuda sin ejecutar ninguna operación y sale con 0', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await runAccountingPolicyCli(['--help']);

    expect(exitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('preflight'));
    expect(preflightMock).not.toHaveBeenCalled();
    expect(provisionMock).not.toHaveBeenCalled();
    expect(readFileMock).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('imprime ayuda cuando se ejecuta como proceso CLI', async () => {
    const { stdout, stderr } = await execFileAsync(
      'node_modules/.bin/tsx',
      ['scripts/ops/accounting-policy-rollout.ts', '--help'],
      { cwd: process.cwd() },
    );

    expect(stdout).toContain('accounting-policy-rollout');
    expect(stdout).toContain('preflight');
    expect(stderr).toBe('');
  });

  it('devuelve código 2 para comandos desconocidos', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const exitCode = await runAccountingPolicyCli(['comando-inexistente']);

    expect(exitCode).toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CLI_USAGE_ERROR'));
    errorSpy.mockRestore();
  });

  it('ejecuta preflight con lista explícita de tenants y operador', async () => {
    const exitCode = await runAccountingPolicyCli([
      'preflight',
      '--tenants', 'tenant-a,tenant-b',
      '--executor', 'operator-a',
    ]);

    expect(exitCode).toBe(0);
    expect(preflightMock).toHaveBeenCalledWith('operator-a', ['tenant-a', 'tenant-b']);
  });

  it('exige executor para preflight y devuelve código 2 si falta', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const exitCode = await runAccountingPolicyCli(['preflight', '--tenants', 'tenant-a']);

    expect(exitCode).toBe(2);
    expect(preflightMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('ejecuta dry-run leyendo el manifiesto del archivo indicado', async () => {
    const exitCode = await runAccountingPolicyCli([
      'dry-run',
      '--manifest', '/tmp/manifest.json',
      '--executor', 'operator-a',
    ]);

    expect(exitCode).toBe(0);
    expect(readFileMock).toHaveBeenCalledWith('/tmp/manifest.json', 'utf8');
  });

  it('rechaza apply sin --dry-run-id o --correlation-id antes de leer datos', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    provisionMock.mockResolvedValue({
      result: 'CREATED',
      functionalCurrencyCode: 'CUP',
      existingCurrencyCode: null,
      evidence: 'NONE',
    });

    const missingDryRun = await runAccountingPolicyCli([
      'apply', '--apply',
      '--manifest', '/tmp/manifest.json',
      '--executor', 'operator-a',
      '--correlation-id', 'corr-a',
    ]);
    expect(missingDryRun).toBe(2);

    const missingCorrelation = await runAccountingPolicyCli([
      'apply', '--apply',
      '--manifest', '/tmp/manifest.json',
      '--dry-run-id', 'dry-cli',
      '--executor', 'operator-a',
    ]);
    expect(missingCorrelation).toBe(2);

    // Sin --apply explícito nunca escribe.
    const withoutFlag = await runAccountingPolicyCli([
      'apply',
      '--manifest', '/tmp/manifest.json',
      '--dry-run-id', 'dry-cli',
      '--correlation-id', 'corr-a',
      '--executor', 'operator-a',
    ]);
    expect(withoutFlag).toBe(2);
    expect(provisionMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('aplica solo con todos los gates explícitos presentes', async () => {
    provisionMock.mockResolvedValue({
      result: 'NO_OP',
      functionalCurrencyCode: 'CUP',
      existingCurrencyCode: 'CUP',
      evidence: 'NONE',
    });

    const exitCode = await runAccountingPolicyCli([
      'apply', '--apply',
      '--manifest', '/tmp/manifest.json',
      '--dry-run-id', 'dry-cli',
      '--correlation-id', 'corr-a',
      '--executor', 'operator-a',
      '--audit-retention-verified',
      '--capability-mappings-proof', 'capabilities-a',
      '--tenant-responsibles-proof', 'responsibles-a',
      '--database-backup-proof', 'backup-a',
      '--pilot-proof', 'pilot-a',
    ]);

    expect(exitCode).toBe(0);
    expect(provisionMock).toHaveBeenCalledWith(expect.objectContaining({
      correlationId: 'corr-a',
      manifestHash: expect.any(String),
    }));
  });

  it('ignora --audit-retention-verified si el servidor no confirma la retención', async () => {
    retentionMock.mockResolvedValue(false);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const exitCode = await runAccountingPolicyCli([
      'apply', '--apply',
      '--manifest', '/tmp/manifest.json',
      '--dry-run-id', 'dry-cli',
      '--correlation-id', 'corr-a',
      '--executor', 'operator-a',
      '--audit-retention-verified',
      '--capability-mappings-proof', 'capabilities-a',
      '--tenant-responsibles-proof', 'responsibles-a',
      '--database-backup-proof', 'backup-a',
      '--pilot-proof', 'pilot-a',
    ]);

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ROLLOUT_NOT_READY'));
    expect(provisionMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('traduce errores de dominio a código 1 sin exponer secretos', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    capabilityMock.mockResolvedValue(false);
    provisionMock.mockResolvedValue({
      result: 'NO_OP',
      functionalCurrencyCode: 'CUP',
      existingCurrencyCode: 'CUP',
      evidence: 'NONE',
    });

    const exitCode = await runAccountingPolicyCli([
      'apply', '--apply',
      '--manifest', '/tmp/manifest.json',
      '--dry-run-id', 'dry-cli',
      '--correlation-id', 'corr-a',
      '--executor', 'intruso-a',
      '--audit-retention-verified',
      '--capability-mappings-proof', 'capabilities-a',
      '--tenant-responsibles-proof', 'responsibles-a',
      '--database-backup-proof', 'backup-a',
      '--pilot-proof', 'pilot-a',
    ]);

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('FORBIDDEN'));
    expect(provisionMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
