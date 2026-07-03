import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/lib/prisma', () => {
  const prisma = {
    affiliateProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    affiliateReferral: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    affiliateCommissionLedger: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    affiliateCreditBalance: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    affiliatePerkGrant: {
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    referralPerkRequest: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tenantLicense: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (input: any) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      return input(prisma);
    }),
  };

  return { prisma };
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  assignReferralPerkAction,
  confirmReferredTenantPaymentAction,
  registerReferralFromCodeAction,
} from '@/features/affiliate/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const tenantUser: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Tenant User',
  email: 'tenant@test.com',
  role: 'user',
  isActive: true,
  tenantId: 'tenant-self',
  tenantRole: 'manager',
};

const adminUser: AuthenticatedUser = {
  userId: 'admin-1',
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin',
  isActive: true,
};

describe('affiliate actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a referral from a valid code and blocks self-referrals', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(tenantUser);
    vi.mocked(prisma.affiliateProfile.findUnique).mockResolvedValue({
      tenantId: 'tenant-referrer',
      referralCode: 'REF-ABC',
      isEligible: true,
    } as never);
    vi.mocked(prisma.affiliateReferral.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue({
      tenantLicenseId: 'license-self',
      tenantId: 'tenant-self',
      planId: 'plan-pro',
      isDemo: false,
      tenant: { memberships: [{ user: { isActive: true } }] },
      plan: { precio: 75 },
    } as never);
    vi.mocked(prisma.affiliateReferral.create).mockResolvedValue({ referralId: 'ref-1' } as never);

    const result = await registerReferralFromCodeAction({ referralCode: 'REF-ABC' });
    expect(result.success).toBe(true);
    expect(prisma.affiliateReferral.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referrerTenantId: 'tenant-referrer',
          referredTenantId: 'tenant-self',
        }),
      }),
    );

    vi.mocked(prisma.affiliateProfile.findUnique).mockResolvedValue({
      tenantId: 'tenant-self',
      referralCode: 'REF-SELF',
      isEligible: true,
    } as never);
    const selfReferral = await registerReferralFromCodeAction({ referralCode: 'REF-SELF' });
    expect(selfReferral.success).toBe(false);
    expect(selfReferral.error?.code).toBe('SELF_REFERRAL_NOT_ALLOWED');
  });

  it('confirms a referred payment, creates commission credit and perk grants', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
    vi.mocked(prisma.affiliateReferral.findFirst).mockResolvedValue({
      referralId: 'ref-1',
      referrerTenantId: 'tenant-referrer',
      referredTenantId: 'tenant-referred',
      status: 'registered',
      referredTenant: { nombre: 'Referido' },
      referrerTenant: { nombre: 'Referidor' },
    } as never);
    vi.mocked(prisma.tenantLicense.findUnique).mockResolvedValue({
      tenantLicenseId: 'license-referred',
      tenantId: 'tenant-referred',
      isDemo: false,
      plan: { precio: 75 },
    } as never);
    vi.mocked(prisma.affiliateCommissionLedger.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.affiliateReferral.count).mockResolvedValue(10 as never);
    vi.mocked(prisma.affiliateReferral.update).mockResolvedValue({ referralId: 'ref-1' } as never);
    vi.mocked(prisma.affiliateCommissionLedger.create).mockResolvedValue({ ledgerId: 'ledger-1' } as never);
    vi.mocked(prisma.affiliateCreditBalance.upsert).mockResolvedValue({ tenantId: 'tenant-referrer' } as never);
    vi.mocked(prisma.affiliatePerkGrant.upsert).mockResolvedValue({ perkGrantId: 'grant-1' } as never);

    const result = await confirmReferredTenantPaymentAction({
      referralId: 'ref-1',
      sourceTenantLicenseId: 'license-referred',
    });

    expect(result.success).toBe(true);
    expect(prisma.affiliateCommissionLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          commissionRate: 0.07,
          commissionAmount: 5.25,
          status: 'available',
        }),
      }),
    );
    expect(prisma.affiliatePerkGrant.upsert).toHaveBeenCalled();
  });

  it('assigns a referral perk into featureOverrides using referral-only keys', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
    vi.mocked(prisma.affiliatePerkGrant.findUnique).mockResolvedValue({
      perkGrantId: 'grant-1',
      tenantId: 'tenant-referrer',
      status: 'pending_manual_assignment',
    } as never);
    vi.mocked(prisma.tenantLicense.findUnique).mockResolvedValue({
      tenantLicenseId: 'license-1',
      tenantId: 'tenant-referrer',
      featureOverrides: { productos: true },
    } as never);
    vi.mocked(prisma.tenantLicense.update).mockResolvedValue({ tenantLicenseId: 'license-1' } as never);
    vi.mocked(prisma.affiliatePerkGrant.update).mockResolvedValue({ perkGrantId: 'grant-1' } as never);

    const result = await assignReferralPerkAction({
      perkGrantId: 'grant-1',
      tenantLicenseId: 'license-1',
      featureKey: 'referral-priority-support',
    });

    expect(result.success).toBe(true);
    expect(prisma.tenantLicense.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          featureOverrides: {
            productos: true,
            'referral-priority-support': true,
          },
        },
      }),
    );
  });
});
