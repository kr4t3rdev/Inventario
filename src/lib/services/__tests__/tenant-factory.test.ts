import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/lib/prisma';
import { createTenantForUser } from '../tenant-factory';

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

describe('createTenantForUser referral attribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'company-user',
      name: 'Company',
      onboardingStatus: 'awaiting_global_approval',
      pendingReferralCode: 'SA-CODE',
    } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.plan.findFirst).mockResolvedValue({
      planId: 'plan-1',
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
  });

  it('atribuye el tenant al Gestor activo dentro de la transacción', async () => {
    const salesAgentReferralCreate = vi.fn().mockResolvedValue({
      salesAgentReferralId: 'sales-ref-1',
    });
    const txMembershipFindFirst = vi.fn().mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
      callback({
        tenant: { create: vi.fn().mockResolvedValue({ tenantId: 'tenant-new' }) },
        tenantMembership: {
          create: vi.fn().mockResolvedValue({ membershipId: 'membership-new' }),
          findFirst: txMembershipFindFirst,
        },
        tenantLicense: {
          create: vi.fn().mockResolvedValue({
            tenantLicenseId: 'license-new',
            expiracion: new Date('2030-01-01'),
          }),
        },
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
});
