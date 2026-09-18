import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/lib/prisma';
import { createTenantForUser } from '../tenant-factory';

const provisionMock = vi.hoisted(() => vi.fn());
const metricsMock = vi.hoisted(() => ({
  recordAccountingPolicyProvisioningCommitted: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/tenant-accounting-policy-service', () => ({
  provisionTenantAccountingPolicyInTransaction: provisionMock,
}));
vi.mock('@/lib/metrics', () => metricsMock);

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    tenantMembership: { findFirst: vi.fn() },
    tenant: { findUnique: vi.fn() },
    plan: { findFirst: vi.fn(), findUnique: vi.fn() },
    affiliateProfile: { findUnique: vi.fn() },
    salesAgentProfile: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/db/platform-prisma', async () => {
  const { prisma } = await import('@/lib/prisma');
  return { prismaPlatform: prisma, default: prisma };
});

describe('createTenantForUser referral attribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    metricsMock.recordAccountingPolicyProvisioningCommitted.mockReset();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'company-user',
      name: 'Company',
      onboardingStatus: 'awaiting_global_approval',
      pendingReferralCode: 'SA-CODE',
      pendingFunctionalCurrencyCode: 'CUP',
    } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.plan.findFirst).mockResolvedValue({
      planId: 'plan-1',
      precio: 40,
      duracionDias: 30,
      maxUsuarios: 5,
      maxAlmacenes: 2,
      maxProductos: 100,
      maxClientes: 100,
    } as never);
    vi.mocked(prisma.affiliateProfile.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValue({
      userId: 'agent-1',
      status: 'active',
    } as never);
    provisionMock.mockResolvedValue({ result: 'CREATED', functionalCurrencyCode: 'CUP' });
  });

  it('atribuye el tenant al Gestor activo dentro de la transacción', async () => {
    const salesAgentReferralCreate = vi.fn().mockResolvedValue({
      salesAgentReferralId: 'sales-ref-1',
    });
    const txMembershipFindFirst = vi.fn().mockResolvedValue(null);
    const licenseCreate = vi.fn().mockResolvedValue({
      tenantLicenseId: 'license-new',
      expiracion: new Date('2030-01-01'),
    });
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
      callback({
        tenant: { create: vi.fn().mockResolvedValue({ tenantId: 'tenant-new' }) },
        tenantMembership: {
          create: vi.fn().mockResolvedValue({ membershipId: 'membership-new' }),
          findFirst: txMembershipFindFirst,
        },
        tenantLicense: { create: licenseCreate },
        salesAgentReferral: { create: salesAgentReferralCreate, findUnique: vi.fn().mockResolvedValue(null) },
        affiliateReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        user: { update: vi.fn() },
      } as never),
    );

    await createTenantForUser({ userId: 'company-user' });

    expect(txMembershipFindFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-new', userId: 'agent-1' },
      select: { membershipId: true },
    });
    expect(salesAgentReferralCreate).toHaveBeenCalledWith({
      data: {
        salesAgentUserId: 'agent-1',
        referredTenantId: 'tenant-new',
        status: 'attributed',
      },
    });
    expect(licenseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        listPriceUsd: 40,
        finalPriceUsd: 35,
      }),
    });
  });

  it('aplica el precio base cuando el tenant no es referido', async () => {
    vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValue(null);
    const licenseCreate = vi.fn().mockResolvedValue({
      tenantLicenseId: 'license-new',
      expiracion: new Date('2030-01-01'),
    });
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
      callback({
        tenant: { create: vi.fn().mockResolvedValue({ tenantId: 'tenant-new' }) },
        tenantMembership: {
          create: vi.fn().mockResolvedValue({ membershipId: 'membership-new' }),
        },
        tenantLicense: { create: licenseCreate },
        salesAgentReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        affiliateReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        user: { update: vi.fn() },
      } as never),
    );

    await createTenantForUser({ userId: 'company-user' });

    expect(licenseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        listPriceUsd: 40,
        finalPriceUsd: 40,
      }),
    });
  });

  it('provisiona la política explícita antes de activar al usuario', async () => {
    vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValue(null);
    const userUpdate = vi.fn();
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
      callback({
        tenant: { create: vi.fn().mockResolvedValue({ tenantId: 'tenant-new' }) },
        tenantMembership: { create: vi.fn().mockResolvedValue({ membershipId: 'membership-new' }) },
        tenantLicense: { create: vi.fn().mockResolvedValue({
          tenantLicenseId: 'license-new',
          expiracion: new Date('2030-01-01'),
        }) },
        salesAgentReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        affiliateReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        user: { update: userUpdate },
      } as never),
    );

    await createTenantForUser({ userId: 'company-user' });

    expect(provisionMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tenantId: 'tenant-new',
      functionalCurrencyCode: 'CUP',
      actorUserId: 'company-user',
      origin: 'ONBOARDING',
    }));
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pendingFunctionalCurrencyCode: null }),
    }));
  });

  it('falla cerrado si la política devuelve BLOCKED y no crea licencia ni activa usuario', async () => {
    vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValue(null);
    provisionMock.mockResolvedValue({
      result: 'BLOCKED',
      functionalCurrencyCode: 'CUP',
      existingCurrencyCode: null,
      evidence: 'REVIEW_REQUIRED',
    });
    const licenseCreate = vi.fn();
    const userUpdate = vi.fn();
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
      callback({
        tenant: { create: vi.fn().mockResolvedValue({ tenantId: 'tenant-blocked' }) },
        tenantMembership: { create: vi.fn().mockResolvedValue({ membershipId: 'membership-blocked' }) },
        tenantLicense: { create: licenseCreate },
        salesAgentReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        affiliateReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        user: { update: userUpdate },
      } as never),
    );

    await expect(createTenantForUser({ userId: 'company-user' }))
      .rejects.toMatchObject({ code: 'ACCOUNTING_POLICY_REQUIRED' });
    expect(licenseCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('abre el alta con aislamiento serializable', async () => {
    vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
      callback({
        tenant: { create: vi.fn().mockResolvedValue({ tenantId: 'tenant-new' }) },
        tenantMembership: { create: vi.fn().mockResolvedValue({ membershipId: 'membership-new' }) },
        tenantLicense: { create: vi.fn().mockResolvedValue({
          tenantLicenseId: 'license-new',
          expiracion: new Date('2030-01-01'),
        }) },
        salesAgentReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        affiliateReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        user: { update: vi.fn() },
      } as never),
    );

    await createTenantForUser({ userId: 'company-user' });

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('impide completar el alta sin moneda funcional confirmada', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'company-user',
      name: 'Company',
      onboardingStatus: 'awaiting_global_approval',
      pendingReferralCode: null,
      pendingFunctionalCurrencyCode: null,
    } as never);

    await expect(createTenantForUser({ userId: 'company-user' }))
      .rejects.toMatchObject({ code: 'ACCOUNTING_POLICY_REQUIRED' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('publica la métrica solo después del commit del alta exterior', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('outer rollback'));

    await expect(createTenantForUser({ userId: 'company-user' }))
      .rejects.toThrow('outer rollback');

    expect(metricsMock.recordAccountingPolicyProvisioningCommitted).not.toHaveBeenCalled();
  });

  it('devuelve el alta ya confirmada al reintentar sin duplicar recursos', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'company-user',
      name: 'Company',
      onboardingStatus: null,
      pendingReferralCode: null,
      pendingFunctionalCurrencyCode: null,
    } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
      membershipId: 'membership-existing',
      tenantId: 'tenant-existing',
      tenant: {
        accountingPolicy: { tenantId: 'tenant-existing' },
        licencias: [{ tenantLicenseId: 'license-existing' }],
      },
    } as never);

    await expect(createTenantForUser({ userId: 'company-user' })).resolves.toEqual({
      tenantId: 'tenant-existing',
      membershipId: 'membership-existing',
      licenseId: 'license-existing',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(provisionMock).not.toHaveBeenCalled();
  });

  it('bloquea atribución si el Gestor conserva membership residual del referido', async () => {
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
      callback({
        tenant: { create: vi.fn().mockResolvedValue({ tenantId: 'tenant-new' }) },
        tenantMembership: {
          create: vi.fn().mockResolvedValue({ membershipId: 'membership-new' }),
          findFirst: vi.fn().mockResolvedValue({ membershipId: 'residual' }),
        },
        tenantLicense: {
          create: vi.fn().mockResolvedValue({
            tenantLicenseId: 'license-new',
            expiracion: new Date('2030-01-01'),
          }),
        },
        salesAgentReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        affiliateReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        user: { update: vi.fn() },
      } as never),
    );

    await expect(createTenantForUser({ userId: 'company-user' }))
      .rejects.toMatchObject({ code: 'SALES_AGENT_SELF_REFERRAL' });
  });

  it('no atribuye si el código colisiona entre affiliate y Gestor', async () => {
    vi.mocked(prisma.affiliateProfile.findUnique).mockResolvedValue({
      tenantId: 'affiliate-tenant',
      isEligible: true,
      status: 'active',
    } as never);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
      callback({
        tenant: { create: vi.fn().mockResolvedValue({ tenantId: 'tenant-new' }) },
        tenantMembership: {
          create: vi.fn().mockResolvedValue({ membershipId: 'membership-new' }),
        },
        tenantLicense: {
          create: vi.fn().mockResolvedValue({
            tenantLicenseId: 'license-new',
            expiracion: new Date('2030-01-01'),
          }),
        },
        salesAgentReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        affiliateReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
        user: { update: vi.fn() },
      } as never),
    );

    await expect(createTenantForUser({ userId: 'company-user' }))
      .rejects.toMatchObject({ code: 'REFERRAL_CODE_COLLISION' });
  });

  it('rechaza sin planes con copy neutro "Crea al menos un plan primero" (PE-01)', async () => {
    vi.mocked(prisma.plan.findFirst).mockResolvedValueOnce(null);

    await expect(createTenantForUser({ userId: 'company-user' }))
      .rejects.toMatchObject({
        code: 'NO_PLANS',
        message: 'No hay planes disponibles. Crea al menos un plan primero.',
      });
  });
});

describe('createTenantForUser duración de licencia', () => {
  beforeEach(() => {
    vi.mocked(prisma.affiliateProfile.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockReset();
  });

  const txMocks = (licenseCreate: ReturnType<typeof vi.fn>) =>
    ({
      tenant: { create: vi.fn().mockResolvedValue({ tenantId: 'tenant-new' }) },
      tenantMembership: {
        create: vi.fn().mockResolvedValue({ membershipId: 'membership-new' }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      tenantLicense: {
        create: licenseCreate.mockResolvedValue({
          tenantLicenseId: 'license-new',
          expiracion: new Date('2030-01-01'),
        }),
      },
      salesAgentReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
      affiliateReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
      user: { update: vi.fn() },
    }) as never;

  const captureExpiracion = (licenseCreate: ReturnType<typeof vi.fn>): Date =>
    licenseCreate.mock.calls[0][0].data.expiracion as Date;

  it('usa la duración del plan (30 días) cuando no se pasa override', async () => {
    const licenseCreate = vi.fn();
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
      callback(txMocks(licenseCreate)),
    );

    const before = Date.now();
    await createTenantForUser({ userId: 'company-user' });

    const expiracion = captureExpiracion(licenseCreate).getTime();
    expect(expiracion).toBeGreaterThanOrEqual(before + 30 * 86400000 - 1000);
    expect(expiracion).toBeLessThanOrEqual(before + 30 * 86400000 + 1000);
  });

  it('respeta el override explícito de duración', async () => {
    const licenseCreate = vi.fn();
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
      callback(txMocks(licenseCreate)),
    );

    const before = Date.now();
    await createTenantForUser({ userId: 'company-user', licenseDurationDays: 45 });

    const expiracion = captureExpiracion(licenseCreate).getTime();
    expect(expiracion).toBeGreaterThanOrEqual(before + 45 * 86400000 - 1000);
    expect(expiracion).toBeLessThanOrEqual(before + 45 * 86400000 + 1000);
  });

  it('rechaza duración inválida (cero o negativa)', async () => {
    await expect(
      createTenantForUser({ userId: 'company-user', licenseDurationDays: 0 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      createTenantForUser({ userId: 'company-user', licenseDurationDays: -5 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
