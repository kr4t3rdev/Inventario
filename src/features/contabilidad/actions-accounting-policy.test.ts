import { beforeEach, describe, expect, it, vi } from 'vitest';

const user = vi.hoisted(() => ({
  userId: 'user-a',
  tenantId: 'tenant-a',
  tenantRole: 'manager',
  role: 'user',
  isActive: true,
  name: 'Manager',
  email: 'manager@example.com',
}));
const capabilityMock = vi.hoisted(() => vi.fn());
const evidenceMock = vi.hoisted(() => vi.fn());
const provisionMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  moneda: { findFirst: vi.fn() },
  tenantAccountingPolicy: { findUnique: vi.fn() },
  accountingPolicyTenantApproval: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/server-actions', () => ({
  ActionError: class ActionError extends Error {
    constructor(message: string, public readonly code: string) {
      super(message);
    }
  },
  withAction: (callback: (input: unknown, actor: typeof user) => Promise<unknown>) =>
    (input: unknown) => callback(input, user)
      .then((data) => ({ success: true, data }))
      .catch((error: { message: string; code?: string; name?: string }) => ({
        success: false,
        error: {
          message: error.name === 'ZodError' ? 'Datos inválidos' : error.message,
          code: error.name === 'ZodError' ? 'VALIDATION_ERROR' : error.code,
        },
      })),
}));
vi.mock('@/lib/auth/accounting-policy-capabilities', () => ({
  canManageAccountingPolicy: capabilityMock,
}));
vi.mock('@/features/contabilidad/services/accounting-policy-evidence-service', () => ({
  classifyAccountingPolicyEvidence: evidenceMock,
}));
vi.mock('@/features/contabilidad/services/tenant-accounting-policy-service', () => ({
  provisionTenantAccountingPolicy: provisionMock,
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

describe('accounting policy actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capabilityMock.mockResolvedValue(true);
    evidenceMock.mockResolvedValue({ classification: 'NONE', counts: {} });
    provisionMock.mockResolvedValue({ result: 'CREATED', functionalCurrencyCode: 'CUP' });
    prismaMock.moneda.findFirst.mockResolvedValue({ codigo: 'CUP' });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
  });

  it('deriva el tenant con requireTenant y crea solo sin evidencia', async () => {
    const { setInitialAccountingPolicyAction } = await import('./actions-accounting-policy');

    const response = await setInitialAccountingPolicyAction({
      functionalCurrencyCode: 'CUP',
      reason: 'Moneda confirmada por la empresa',
      returnTo: '/busy/contabilidad/balance-resultados#moneda-funcional',
    });

    expect(response.success).toBe(true);
    expect(provisionMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a',
      actorUserId: 'user-a',
      functionalCurrencyCode: 'CUP',
      origin: 'TENANT_UI',
    }));
  });

  it('deniega en servidor aunque el cliente fuerce el CTA', async () => {
    capabilityMock.mockResolvedValue(false);
    const { setInitialAccountingPolicyAction } = await import('./actions-accounting-policy');

    const response = await setInitialAccountingPolicyAction({
      functionalCurrencyCode: 'CUP',
      reason: 'Intento no autorizado',
    });

    expect(response).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } });
    expect(provisionMock).not.toHaveBeenCalled();
  });

  it('no responde success cuando el provisioning queda BLOCKED', async () => {
    provisionMock.mockResolvedValue({
      result: 'BLOCKED',
      functionalCurrencyCode: 'CUP',
      existingCurrencyCode: null,
      evidence: 'PRESENT',
    });
    const { setInitialAccountingPolicyAction } = await import('./actions-accounting-policy');

    const response = await setInitialAccountingPolicyAction({
      functionalCurrencyCode: 'CUP',
      reason: 'La evidencia requiere revisión adicional',
    });

    expect(response).toMatchObject({
      success: false,
      error: { code: 'ACCOUNTING_POLICY_BLOCKED' },
    });
  });

  it('con evidencia registra aprobación exacta y no crea unilateralmente', async () => {
    evidenceMock.mockResolvedValue({ classification: 'PRESENT', counts: { checkpoints: 1 } });
    prismaMock.accountingPolicyTenantApproval.create.mockResolvedValue({
      approvalId: 'approval-a',
    });
    const { createTenantAccountingPolicyApprovalAction } = await import(
      './actions-accounting-policy'
    );

    const response = await createTenantAccountingPolicyApprovalAction({
      functionalCurrencyCode: 'CUP',
      reason: 'Aprobación individual para revisión de plataforma',
    });

    expect(response).toMatchObject({
      success: true,
      data: { status: 'PENDING_PLATFORM_REVIEW', approvalId: 'approval-a' },
    });
    expect(provisionMock).not.toHaveBeenCalled();
    expect(prismaMock.accountingPolicyTenantApproval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-a',
        functionalCurrencyCode: 'CUP',
        actorUserId: 'user-a',
      }),
    });
  });

  it('rechaza aprobación si la moneda solicitada no existe o está inactiva', async () => {
    evidenceMock.mockResolvedValue({ classification: 'PRESENT', counts: { checkpoints: 1 } });
    prismaMock.moneda.findFirst.mockResolvedValue(null);
    const { createTenantAccountingPolicyApprovalAction } = await import(
      './actions-accounting-policy',
    );

    const response = await createTenantAccountingPolicyApprovalAction({
      functionalCurrencyCode: 'USD',
      reason: 'Aprobación para moneda no disponible',
    });

    expect(response).toMatchObject({
      success: false,
      error: { code: 'FUNCTIONAL_CURRENCY_NOT_AVAILABLE' },
    });
    expect(prismaMock.moneda.findFirst).toHaveBeenCalledWith({
      where: { codigo: 'USD', isActive: true },
      select: { codigo: true },
    });
    expect(prismaMock.accountingPolicyTenantApproval.create).not.toHaveBeenCalled();
  });

  it('rechaza returnTo fuera de la allowlist', async () => {
    const { setInitialAccountingPolicyAction } = await import('./actions-accounting-policy');

    const response = await setInitialAccountingPolicyAction({
      functionalCurrencyCode: 'CUP',
      reason: 'Moneda confirmada por la empresa',
      returnTo: 'https://evil.example/redirect',
    });

    expect(response).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
  });
});
