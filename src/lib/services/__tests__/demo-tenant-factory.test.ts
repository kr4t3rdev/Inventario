import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => {
  const tx = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    tenant: {
      create: vi.fn(),
    },
    tenantMembership: {
      create: vi.fn(),
    },
    tenantLicense: {
      create: vi.fn(),
    },
  };

  return {
    prisma: {
      plan: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
    __tx: tx,
  };
});

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
  },
}));

const provisionMock = vi.hoisted(() => vi.fn());
const seedMock = vi.hoisted(() => vi.fn());
const metricsMock = vi.hoisted(() => ({
  recordAccountingPolicyProvisioningCommitted: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/tenant-accounting-policy-service', () => ({
  provisionTenantAccountingPolicyInTransaction: provisionMock,
}));
vi.mock('../demo-seed', () => ({ seedDemoTenantData: seedMock }));
vi.mock('@/lib/metrics', () => metricsMock);

import bcrypt from 'bcryptjs';
import { prisma, __tx } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { createDemoTenantForPlan } from '../demo-tenant-factory';

describe('createDemoTenantForPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    metricsMock.recordAccountingPolicyProvisioningCommitted.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-26T10:00:00.000Z'));

    vi.mocked(bcrypt.hash).mockResolvedValue('hashed-demo-password' as never);
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({
      planId: 'plan-pro',
      nombre: 'Profesional',
      maxUsuarios: 5,
      maxAlmacenes: 5,
      maxProductos: 5000,
      maxClientes: 800,
      features: { productos: true, clientes: true },
    } as never);

    vi.mocked(__tx.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(__tx.user.create).mockResolvedValue({ userId: 'user-demo-1' } as never);
    vi.mocked(__tx.tenant.create).mockResolvedValue({ tenantId: 'tenant-demo-1' } as never);
    vi.mocked(__tx.tenantMembership.create).mockResolvedValue({
      membershipId: 'membership-demo-1',
    } as never);
    vi.mocked(__tx.tenantLicense.create).mockResolvedValue({
      tenantLicenseId: 'license-demo-1',
    } as never);
    provisionMock.mockResolvedValue({ result: 'CREATED', functionalCurrencyCode: 'CUP' });
    seedMock.mockResolvedValue({ profile: 'professional' });
  });

  it('creates a demo tenant with isDemo=true and a 6-day license by default', async () => {
    const result = await createDemoTenantForPlan({
      planId: 'plan-pro',
    });

    expect(result).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-demo-1',
        membershipId: 'membership-demo-1',
        licenseId: 'license-demo-1',
        userId: 'user-demo-1',
        planName: 'Profesional',
        isDemo: true,
        createdBy: null,
      }),
    );

    expect(__tx.tenantLicense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        planId: 'plan-pro',
        isDemo: true,
        createdBy: null,
        maxUsuarios: 5,
        maxAlmacenes: 5,
        maxProductos: 5000,
        maxClientes: 800,
        features: undefined,
        featureOverrides: {},
        expiracion: new Date('2026-07-02T10:00:00.000Z'),
      }),
    });
  });

  it('allows overriding the demo duration', async () => {
    await createDemoTenantForPlan({
      planId: 'plan-pro',
      durationDays: 3,
      demoName: 'Demo Express',
    });

    expect(__tx.tenantLicense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expiracion: new Date('2026-06-29T10:00:00.000Z'),
      }),
    });
  });

  it('provisiona CUP literal y seed dentro de la misma unidad transaccional', async () => {
    await createDemoTenantForPlan({ planId: 'plan-pro', createdBy: 'admin-a' });

    expect(provisionMock).toHaveBeenCalledWith(__tx, expect.objectContaining({
      tenantId: 'tenant-demo-1',
      functionalCurrencyCode: 'CUP',
      origin: 'DEMO',
      actorUserId: 'admin-a',
    }));
    expect(seedMock).toHaveBeenCalledWith({
      tenantId: 'tenant-demo-1',
      planName: 'Profesional',
      client: __tx,
    });
  });

  it('falla cerrado si la política devuelve BLOCKED y no activa la demo ni siembra datos', async () => {
    provisionMock.mockResolvedValue({
      result: 'BLOCKED',
      functionalCurrencyCode: 'CUP',
      existingCurrencyCode: null,
      evidence: 'REVIEW_REQUIRED',
    });

    await expect(createDemoTenantForPlan({ planId: 'plan-pro' }))
      .rejects.toMatchObject({ code: 'ACCOUNTING_POLICY_REQUIRED' });
    expect(__tx.tenantLicense.create).not.toHaveBeenCalled();
    expect(seedMock).not.toHaveBeenCalled();
  });

  it('abre la demo con aislamiento serializable', async () => {
    await createDemoTenantForPlan({ planId: 'plan-pro' });

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('no convierte un fallo de métrica post-commit en un fallo de creación', async () => {
    metricsMock.recordAccountingPolicyProvisioningCommitted.mockImplementationOnce(() => {
      throw new Error('metrics unavailable');
    });

    await expect(createDemoTenantForPlan({ planId: 'plan-pro' }))
      .resolves.toMatchObject({ tenantId: 'tenant-demo-1' });
  });

  it('throws PLAN_NOT_FOUND when the plan does not exist', async () => {
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(null as never);

    await expect(
      createDemoTenantForPlan({ planId: 'missing-plan' }),
    ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' } satisfies Partial<ActionError>);
  });

  it('throws VALIDATION_ERROR when durationDays is invalid', async () => {
    await expect(
      createDemoTenantForPlan({ planId: 'plan-pro', durationDays: 0 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' } satisfies Partial<ActionError>);
  });

  it('throws EMAIL_CONFLICT when generated credentials already exist', async () => {
    vi.mocked(__tx.user.findUnique).mockResolvedValue({ userId: 'existing-user' } as never);

    await expect(
      createDemoTenantForPlan({ planId: 'plan-pro' }),
    ).rejects.toMatchObject({ code: 'EMAIL_CONFLICT' } satisfies Partial<ActionError>);
  });
});
