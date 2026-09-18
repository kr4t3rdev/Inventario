import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAccountingPolicyPrismaMock } from './__tests__/fixtures/accounting-policy-evidence';

const prismaMock = createAccountingPolicyPrismaMock();

const auditMock = vi.hoisted(() => ({ logStrict: vi.fn() }));
const metricsMock = vi.hoisted(() => ({
  accountingPolicyProvisioningCounter: { inc: vi.fn() },
  recordAccountingPolicyProvisioningCommitted: vi.fn(),
  refreshOperationalTenantsWithoutAccountingPolicy: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: auditMock,
}));
vi.mock('@/lib/metrics', () => metricsMock);

describe('tenant accounting policy service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
    prismaMock.moneda.findFirst.mockResolvedValue({ codigo: 'USD' });
    prismaMock.financialAuxiliaryCheckpoint.count.mockResolvedValue(0);
    prismaMock.snapshotPeriodo.count.mockResolvedValue(0);
    prismaMock.reconciliacionVenta.count.mockResolvedValue(0);
    prismaMock.reconciliacionServicio.count.mockResolvedValue(0);
    prismaMock.reconciliacionGasto.count.mockResolvedValue(0);
    prismaMock.accountingPolicyTenantApproval.findUnique.mockResolvedValue(null);
    auditMock.logStrict.mockResolvedValue({ id: 'audit-1' });
    metricsMock.accountingPolicyProvisioningCounter.inc.mockReset();
    metricsMock.recordAccountingPolicyProvisioningCommitted.mockReset();
    metricsMock.refreshOperationalTenantsWithoutAccountingPolicy.mockResolvedValue(0);
  });

  it('returns only the explicit policy owned by the requested tenant', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'USD',
      updatedBy: 'user-a',
    });
    const { getRequiredTenantAccountingPolicy } = await import(
      './tenant-accounting-policy-service'
    );

    const policy = await getRequiredTenantAccountingPolicy('tenant-a');

    expect(policy.functionalCurrencyCode).toBe('USD');
    expect(prismaMock.tenantAccountingPolicy.findUnique).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
      select: expect.objectContaining({ tenantId: true, functionalCurrencyCode: true }),
    });
  });

  it('fails closed when no independently configured policy exists', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    const { getRequiredTenantAccountingPolicy } = await import(
      './tenant-accounting-policy-service'
    );

    await expect(getRequiredTenantAccountingPolicy('tenant-a')).rejects.toMatchObject({
      code: 'TENANT_ACCOUNTING_POLICY_REQUIRED',
    });
    expect(prismaMock.moneda.findFirst).not.toHaveBeenCalled();
  });

  it('blocks a currency change after immutable accounting evidence exists', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      updatedBy: 'user-old',
    });
    prismaMock.financialAuxiliaryCheckpoint.count.mockResolvedValue(1);
    const transactionClient = { ...prismaMock, auditLog: { create: vi.fn() } };
    prismaMock.$transaction.mockImplementationOnce(async (callback) => callback(transactionClient));
    const { setTenantAccountingPolicy } = await import('./tenant-accounting-policy-service');

    await expect(setTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'USD',
      updatedBy: 'user-new',
    })).rejects.toMatchObject({ code: 'FUNCTIONAL_CURRENCY_IMMUTABLE' });
    expect(prismaMock.tenantAccountingPolicy.update).not.toHaveBeenCalled();
    expect(auditMock.logStrict).toHaveBeenLastCalledWith(
      expect.objectContaining({ detalles: expect.objectContaining({ result: 'BLOCKED' }) }),
      prismaMock,
    );
  });

  it('persiste el rechazo de moneda inválida después del rollback de la transacción', async () => {
    prismaMock.moneda.findFirst.mockResolvedValue(null);
    const transactionClient = { ...prismaMock, auditLog: { create: vi.fn() } };
    prismaMock.$transaction.mockImplementationOnce(async (callback) => callback(transactionClient));
    const { setTenantAccountingPolicy } = await import('./tenant-accounting-policy-service');

    await expect(setTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'XYZ',
      updatedBy: 'user-a',
    })).rejects.toMatchObject({ code: 'FUNCTIONAL_CURRENCY_NOT_AVAILABLE' });

    expect(auditMock.logStrict).toHaveBeenCalledWith(
      expect.objectContaining({
        entidad: 'TENANT_ACCOUNTING_POLICY',
        detalles: expect.objectContaining({
          result: 'BLOCKED',
          requestedCurrency: 'XYZ',
        }),
      }),
      prismaMock,
    );
    expect(auditMock.logStrict).not.toHaveBeenCalledWith(
      expect.anything(),
      transactionClient,
    );
  });

  it('persiste una decisión segura si falla una escritura posterior dentro de la transacción', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    prismaMock.financialAuxiliaryCheckpoint.count.mockResolvedValue(1);
    prismaMock.accountingPolicyTenantApproval.findUnique.mockResolvedValue({
      approvalId: 'approval-a',
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      status: 'ACTIVE',
      expiresAt: new Date('2030-01-01'),
    });
    prismaMock.tenantAccountingPolicy.create.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      updatedBy: 'operator-a',
    });
    prismaMock.accountingPolicyTenantApproval.update.mockRejectedValue(
      new Error('approval consumption failed'),
    );
    const transactionClient = { ...prismaMock, auditLog: { create: vi.fn() } };
    prismaMock.$transaction.mockImplementationOnce(async (callback) => callback(transactionClient));
    const { provisionTenantAccountingPolicy } = await import(
      './tenant-accounting-policy-service'
    );

    await expect(provisionTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      actorUserId: 'operator-a',
      origin: 'ROLLOUT',
      reason: 'Aplicación aprobada por plataforma',
      correlationId: 'correlation-a',
      expectedEvidence: 'PRESENT',
      platformApproverUserId: 'approver-a',
      tenantApprovalId: 'approval-a',
    })).rejects.toThrow('approval consumption failed');

    expect(auditMock.logStrict).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detalles: expect.objectContaining({
          result: 'BLOCKED',
          evidence: 'REVIEW_REQUIRED',
          requestedCurrency: 'CUP',
        }),
      }),
      prismaMock,
    );
  });

  it('crea una política explícita y auditoría estricta cuando no hay evidencia', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    prismaMock.moneda.findFirst.mockResolvedValue({ codigo: 'CUP' });
    prismaMock.tenantAccountingPolicy.create.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      updatedBy: 'user-a',
    });
    const { provisionTenantAccountingPolicy } = await import(
      './tenant-accounting-policy-service'
    );

    const result = await provisionTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: ' cup ',
      actorUserId: 'user-a',
      origin: 'TENANT_UI',
      reason: 'Decisión confirmada por la empresa',
      correlationId: 'correlation-a',
    });

    expect(result.result).toBe('CREATED');
    expect(prismaMock.tenantAccountingPolicy.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-a',
        functionalCurrencyCode: 'CUP',
        updatedBy: 'user-a',
      },
    });
    expect(auditMock.logStrict).toHaveBeenCalledWith(
      expect.objectContaining({
        entidad: 'TENANT_ACCOUNTING_POLICY',
        usuarioId: 'user-a',
        detalles: expect.objectContaining({
          result: 'CREATED',
          tenantId: 'tenant-a',
          requestedCurrency: 'CUP',
          origin: 'TENANT_UI',
          correlationId: 'correlation-a',
        }),
      }),
      prismaMock,
    );
    expect(metricsMock.recordAccountingPolicyProvisioningCommitted).toHaveBeenCalledWith(
      'TENANT_UI',
      'CREATED',
    );
  });

  it('no convierte un fallo del gauge posterior al commit en un fallo de dominio', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    prismaMock.moneda.findFirst.mockResolvedValue({ codigo: 'CUP' });
    prismaMock.tenantAccountingPolicy.create.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      updatedBy: 'user-a',
    });
    metricsMock.refreshOperationalTenantsWithoutAccountingPolicy.mockRejectedValue(
      new Error('telemetry unavailable'),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { provisionTenantAccountingPolicy } = await import(
      './tenant-accounting-policy-service'
    );

    await expect(provisionTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      actorUserId: 'user-a',
      origin: 'TENANT_UI',
      reason: 'Decisión confirmada por la empresa',
      correlationId: 'correlation-telemetry-failure',
    })).resolves.toMatchObject({ result: 'CREATED' });

    expect(metricsMock.recordAccountingPolicyProvisioningCommitted).toHaveBeenCalledWith(
      'TENANT_UI',
      'CREATED',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'No se pudo actualizar el gauge de tenants sin política después del commit',
      expect.objectContaining({ origin: 'TENANT_UI', result: 'CREATED' }),
    );
    errorSpy.mockRestore();
  });

  it('devuelve NO_OP sin alterar actor ni timestamps para la misma moneda', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      updatedBy: 'user-old',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    });
    const { provisionTenantAccountingPolicy } = await import(
      './tenant-accounting-policy-service'
    );

    const result = await provisionTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      actorUserId: 'user-new',
      origin: 'ROLLOUT',
      reason: 'Reintento del mismo manifiesto',
      correlationId: 'run-a',
    });

    expect(result.result).toBe('NO_OP');
    expect(prismaMock.tenantAccountingPolicy.update).not.toHaveBeenCalled();
    expect(prismaMock.tenantAccountingPolicy.create).not.toHaveBeenCalled();
  });

  it('devuelve CONFLICT sin sobrescribir otra moneda durante rollout', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'USD',
      updatedBy: 'user-old',
    });
    const { provisionTenantAccountingPolicy } = await import(
      './tenant-accounting-policy-service'
    );

    const result = await provisionTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      actorUserId: 'operator-a',
      origin: 'ROLLOUT',
      reason: 'Manifiesto aprobado',
      correlationId: 'run-a',
      platformApproverUserId: 'approver-a',
    });

    expect(result).toMatchObject({ result: 'CONFLICT', existingCurrencyCode: 'USD' });
    expect(prismaMock.tenantAccountingPolicy.update).not.toHaveBeenCalled();
  });

  it('permite cambiar la moneda inicial antes de que exista evidencia inmutable', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'USD',
      updatedBy: 'user-old',
    });
    prismaMock.moneda.findFirst.mockResolvedValue({ codigo: 'CUP' });
    prismaMock.tenantAccountingPolicy.update.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      updatedBy: 'user-new',
    });
    const { setTenantAccountingPolicy } = await import('./tenant-accounting-policy-service');

    const result = await setTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      updatedBy: 'user-new',
    });

    expect(result).toMatchObject({
      result: 'UPDATED',
      functionalCurrencyCode: 'CUP',
      existingCurrencyCode: 'USD',
      evidence: 'NONE',
    });
    expect(prismaMock.tenantAccountingPolicy.update).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
      data: { functionalCurrencyCode: 'CUP', updatedBy: 'user-new' },
    });
    expect(auditMock.logStrict).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'UPDATE' }),
      prismaMock,
    );
    expect(metricsMock.recordAccountingPolicyProvisioningCommitted).toHaveBeenCalledWith(
      'TENANT_UI',
      'UPDATED',
    );
  });

  it('mantiene la transición fail-closed cuando aparece evidencia antes del cambio', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'USD',
      updatedBy: 'user-old',
    });
    prismaMock.financialAuxiliaryCheckpoint.count.mockResolvedValue(1);
    const { setTenantAccountingPolicy } = await import('./tenant-accounting-policy-service');

    await expect(setTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      updatedBy: 'user-new',
    })).rejects.toMatchObject({ code: 'FUNCTIONAL_CURRENCY_IMMUTABLE' });

    expect(prismaMock.tenantAccountingPolicy.update).not.toHaveBeenCalled();
    expect(auditMock.logStrict).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detalles: expect.objectContaining({
          result: 'BLOCKED',
          evidence: 'PRESENT',
          existingCurrency: 'USD',
        }),
      }),
      prismaMock,
    );
  });

  it('preserva idempotencia después de una corrección pre-evidencia', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      updatedBy: 'user-old',
    });
    const { setTenantAccountingPolicy } = await import('./tenant-accounting-policy-service');

    const result = await setTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      updatedBy: 'user-new',
    });

    expect(result.result).toBe('NO_OP');
    expect(prismaMock.tenantAccountingPolicy.update).not.toHaveBeenCalled();
  });

  it('no incrementa métricas si una transacción exterior revierte después del provisioning', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    prismaMock.moneda.findFirst.mockResolvedValue({ codigo: 'CUP' });
    prismaMock.tenantAccountingPolicy.create.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      updatedBy: 'user-a',
    });
    const { provisionTenantAccountingPolicyInTransaction } = await import(
      './tenant-accounting-policy-service'
    );

    await expect(prismaMock.$transaction(async (tx) => {
      await provisionTenantAccountingPolicyInTransaction(tx, {
        tenantId: 'tenant-a',
        functionalCurrencyCode: 'CUP',
        actorUserId: 'user-a',
        origin: 'ONBOARDING',
        reason: 'Alta transaccional de prueba',
        correlationId: 'rollback-a',
      });
      throw new Error('outer transaction rollback');
    })).rejects.toThrow('outer transaction rollback');

    expect(metricsMock.accountingPolicyProvisioningCounter.inc).not.toHaveBeenCalled();
  });

  it('bloquea fail-closed si una fuente de evidencia no es confiable', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    prismaMock.snapshotPeriodo.count.mockRejectedValue(new Error('unavailable'));
    const { provisionTenantAccountingPolicy } = await import(
      './tenant-accounting-policy-service'
    );

    const result = await provisionTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      actorUserId: 'user-a',
      origin: 'TENANT_UI',
      reason: 'Decisión confirmada',
      correlationId: 'correlation-a',
    });

    expect(result).toMatchObject({ result: 'BLOCKED', evidence: 'REVIEW_REQUIRED' });
    expect(prismaMock.tenantAccountingPolicy.create).not.toHaveBeenCalled();
  });

  it('exige triple control exacto para primera asignación con evidencia', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    prismaMock.financialAuxiliaryCheckpoint.count.mockResolvedValue(1);
    const { provisionTenantAccountingPolicy } = await import(
      './tenant-accounting-policy-service'
    );

    const result = await provisionTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      actorUserId: 'operator-a',
      origin: 'ROLLOUT',
      reason: 'Manifiesto aprobado',
      correlationId: 'run-a',
      platformApproverUserId: 'approver-a',
    });

    expect(result).toMatchObject({ result: 'BLOCKED', evidence: 'PRESENT' });
    expect(prismaMock.tenantAccountingPolicy.create).not.toHaveBeenCalled();
  });

  it('bloquea si la evidencia cambió después del dry-run vinculante', async () => {
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    const { provisionTenantAccountingPolicy } = await import(
      './tenant-accounting-policy-service'
    );

    const result = await provisionTenantAccountingPolicy({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
      actorUserId: 'operator-a',
      origin: 'ROLLOUT',
      reason: 'Manifiesto aprobado',
      correlationId: 'run-a',
      manifestHash: 'manifest-a',
      expectedEvidence: 'PRESENT',
      platformApproverUserId: 'approver-a',
    });

    expect(result).toMatchObject({ result: 'BLOCKED', evidence: 'NONE' });
    expect(prismaMock.tenantAccountingPolicy.create).not.toHaveBeenCalled();
  });
});
