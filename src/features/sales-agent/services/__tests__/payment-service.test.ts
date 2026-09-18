import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/lib/prisma';
import { Decimal } from '@/generated/prisma/runtime/library';
import {
  createSalesAgentEvent,
  deliverSalesAgentEmails,
} from '../notification-service';
import {
  confirmSalesAgentTenantPayment,
  type ConfirmSalesAgentTenantPaymentInput,
} from '../payment-service';

vi.mock('../notification-service', () => ({
  createSalesAgentEvent: vi.fn().mockResolvedValue('delivery-1'),
  deliverSalesAgentEmails: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantLicensePayment: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/db/platform-prisma', async () => {
  const { prisma } = await import('@/lib/prisma');
  return { prismaPlatform: prisma, default: prisma };
});

const input: ConfirmSalesAgentTenantPaymentInput = {
  tenantId: 'tenant-referred',
  tenantLicenseId: 'license-current',
  idempotencyKey: 'renewal:payment-1',
  amountPaidUsd: 100,
  confirmedByAdminId: 'admin-1',
};

describe('confirmSalesAgentTenantPayment', () => {
  const paymentCreate = vi.fn();
  const paymentFindUnique = vi.fn();
  const ledgerCreate = vi.fn();
  const ledgerFindFirst = vi.fn();
  const balanceUpsert = vi.fn();
  const auditCreate = vi.fn();
  const referralCount = vi.fn();
  const tenantLicenseFindFirst = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.tenantLicensePayment.findUnique).mockResolvedValue(null);
    paymentFindUnique.mockResolvedValue(null);
    paymentCreate.mockResolvedValue({ tenantLicensePaymentId: 'payment-confirmation-1' });
    ledgerCreate.mockResolvedValue({ salesAgentCommissionLedgerId: 'ledger-default' });
    ledgerFindFirst.mockResolvedValue(null);
    balanceUpsert.mockResolvedValue({ availableUsd: '3' });
    auditCreate.mockResolvedValue({ id: 'audit-1' });
    referralCount.mockResolvedValue(1);
    tenantLicenseFindFirst.mockResolvedValue({
      tenantLicenseId: input.tenantLicenseId,
      tenantId: input.tenantId,
      activa: true,
      expiracion: new Date('2030-01-01T00:00:00.000Z'),
      isDemo: false,
      isAdminTest: false,
      finalPriceUsd: '100',
      listPriceUsd: '120',
      plan: { precio: '130' },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        salesAgentReferral: {
          findUnique: vi.fn().mockResolvedValue({
            salesAgentReferralId: 'referral-1',
            salesAgentUserId: 'agent-1',
            referredTenantId: input.tenantId,
            status: 'attributed',
            salesAgent: {
              isActive: true,
              role: 'salesAgent',
              salesAgentProfile: { status: 'active' },
            },
          }),
          count: referralCount,
        },
        tenantLicense: {
          findFirst: tenantLicenseFindFirst,
        },
        tenantMembership: { findFirst: vi.fn().mockResolvedValue({ membershipId: 'active' }) },
        tenantLicensePayment: { count: vi.fn().mockResolvedValue(1), create: paymentCreate, findUnique: paymentFindUnique },
        salesAgentCommissionLedger: { create: ledgerCreate, findFirst: ledgerFindFirst },
        salesAgentBalance: { upsert: balanceUpsert },
        auditLog: { create: auditCreate },
      } as never),
    );
  });

  it('creates authoritative payment, ledger, balance and audit atomically', async () => {
    const result = await confirmSalesAgentTenantPayment(input);

    expect(result.credited).toBe(true);
    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expectedAmountUsd: expect.objectContaining({}),
        amountPaidUsd: expect.objectContaining({}),
        paymentCycleEndsAt: new Date('2030-01-01T00:00:00.000Z'),
        licenseExpirationSnapshot: new Date('2030-01-01T00:00:00.000Z'),
        immutableFingerprint:
          'tenant-referred|license-current|2030-01-01T00:00:00.000Z|100.00',
        confirmedByAdminId: 'admin-1',
      }),
    });
    expect(ledgerCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      paymentSource: 'tenant_license_payment',
      paymentSourceId: 'payment-confirmation-1',
    }) });
    expect(auditCreate).toHaveBeenCalledOnce();
    expect(createSalesAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'agent-1',
      eventType: 'commission_generated',
    }));
    expect(deliverSalesAgentEmails).toHaveBeenCalledWith(['delivery-1', 'delivery-1']);
  });

  it('calculates referred Basic commission from list price while recording final paid amount', async () => {
    tenantLicenseFindFirst.mockResolvedValue({
      tenantLicenseId: input.tenantLicenseId,
      tenantId: input.tenantId,
      activa: true,
      expiracion: new Date('2030-01-01T00:00:00.000Z'),
      isDemo: false,
      isAdminTest: false,
      finalPriceUsd: '35',
      listPriceUsd: '40',
      plan: { precio: '40' },
    });

    await confirmSalesAgentTenantPayment({ ...input, amountPaidUsd: 35 });

    const ledgerData = ledgerCreate.mock.calls[0][0].data;
    expect(ledgerData.amountPaidUsd.toString()).toBe('35');
    expect(ledgerData.commissionAmountUsd.toString()).toBe('2');
  });

  it('rejects an amount that differs from the server amount due', async () => {
    await expect(confirmSalesAgentTenantPayment({ ...input, amountPaidUsd: 99 }))
      .rejects.toMatchObject({ code: 'PAYMENT_AMOUNT_MISMATCH' });
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it('returns an idempotent duplicate only for the same immutable fingerprint', async () => {
    paymentFindUnique.mockResolvedValue({
      tenantLicensePaymentId: 'payment-existing',
      commissionLedger: { salesAgentCommissionLedgerId: 'ledger-existing' },
      immutableFingerprint:
        'tenant-referred|license-current|2030-01-01T00:00:00.000Z|100.00',
    } as never);

    await expect(confirmSalesAgentTenantPayment(input)).resolves.toEqual({
      credited: false,
      duplicate: true,
      ledgerId: 'ledger-existing',
    });
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it('rejects the same idempotency key with a different fingerprint', async () => {
    paymentFindUnique.mockResolvedValue({
      tenantLicensePaymentId: 'payment-existing',
      commissionLedger: { salesAgentCommissionLedgerId: 'ledger-existing' },
      immutableFingerprint:
        'tenant-referred|other-license|2030-01-01T00:00:00.000Z|100.00',
    } as never);
    await expect(confirmSalesAgentTenantPayment(input))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('derives the canonical amount before replaying a request without amount', async () => {
    paymentFindUnique.mockResolvedValue({
      tenantLicensePaymentId: 'payment-existing',
      commissionLedger: { salesAgentCommissionLedgerId: 'ledger-existing' },
      immutableFingerprint:
        'tenant-referred|license-current|2030-01-01T00:00:00.000Z|99.00',
    } as never);

    await expect(confirmSalesAgentTenantPayment({ ...input, amountPaidUsd: undefined }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it('does not credit a second payment key in the same license cycle', async () => {
    paymentFindUnique.mockImplementation(async ({ where }) => {
      if ('idempotencyKey' in where) return null;
      return {
        tenantLicensePaymentId: 'payment-existing',
        commissionLedger: { salesAgentCommissionLedgerId: 'ledger-existing' },
        immutableFingerprint:
          'tenant-referred|license-current|2030-01-01T00:00:00.000Z|100.00',
      };
    });

    await expect(confirmSalesAgentTenantPayment({ ...input, idempotencyKey: 'renewal:new-key' }))
      .resolves.toEqual({
        credited: false,
        duplicate: true,
        ledgerId: 'ledger-existing',
      });
    expect(paymentCreate).not.toHaveBeenCalled();
    expect(balanceUpsert).not.toHaveBeenCalled();
  });

  it('allows a future renewal cycle on the same tenant license', async () => {
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
      callback({
        salesAgentReferral: {
          findUnique: vi.fn().mockResolvedValue({
            salesAgentReferralId: 'referral-1',
            salesAgentUserId: 'agent-1',
            status: 'attributed',
            salesAgent: {
              isActive: true,
              role: 'salesAgent',
              salesAgentProfile: { status: 'active' },
            },
          }),
          count: referralCount,
        },
        tenantLicense: {
          findFirst: vi.fn().mockResolvedValue({
            tenantLicenseId: input.tenantLicenseId,
            tenantId: input.tenantId,
            expiracion: new Date('2031-01-01T00:00:00.000Z'),
            finalPriceUsd: '100',
            plan: { precio: '130' },
          }),
        },
        tenantMembership: { findFirst: vi.fn().mockResolvedValue({ membershipId: 'active' }) },
        tenantLicensePayment: { count: vi.fn().mockResolvedValue(1), create: paymentCreate, findUnique: paymentFindUnique },
        salesAgentCommissionLedger: { create: ledgerCreate, findFirst: ledgerFindFirst },
        salesAgentBalance: { upsert: balanceUpsert },
        auditLog: { create: auditCreate },
      } as never),
    );

    await expect(confirmSalesAgentTenantPayment({ ...input, idempotencyKey: 'renewal:2031' }))
      .resolves.toMatchObject({ credited: true, duplicate: false });
    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentCycleEndsAt: new Date('2031-01-01T00:00:00.000Z'),
      }),
    });
  });

  it('excludes admin-test licenses from payment eligibility and tier counts', async () => {
    await confirmSalesAgentTenantPayment(input);

    expect(tenantLicenseFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isDemo: false, isAdminTest: false }),
    }));
    expect(referralCount).toHaveBeenCalledWith({
      where: expect.objectContaining({
        referredTenant: expect.objectContaining({
          licencias: {
            some: expect.objectContaining({ isDemo: false, isAdminTest: false }),
          },
          memberships: { some: expect.any(Object) },
        }),
      }),
    });
  });

  it('creates an additional event when the authoritative commission tier changes', async () => {
    ledgerFindFirst.mockResolvedValue({ commissionRate: new Decimal('0.07') });
    vi.mocked(createSalesAgentEvent)
      .mockResolvedValueOnce('delivery-commission')
      .mockResolvedValueOnce('delivery-tier');

    await confirmSalesAgentTenantPayment(input);

    expect(createSalesAgentEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: 'agent-1',
        eventType: 'tier_changed',
      }),
    );
    expect(deliverSalesAgentEmails).toHaveBeenCalledWith([
      'delivery-commission',
      'delivery-tier',
    ]);
  });

  it('emits the initial tier change from 0% to 5% on the first qualifying payment', async () => {
    ledgerFindFirst.mockResolvedValue(null);
    vi.mocked(createSalesAgentEvent)
      .mockResolvedValueOnce('delivery-commission')
      .mockResolvedValueOnce('delivery-tier');

    await confirmSalesAgentTenantPayment(input);

    expect(createSalesAgentEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventType: 'tier_changed',
        message: expect.stringContaining('0% a 5%'),
        emailPayload: {
          previousRate: '0',
          rate: '0.05',
        },
      }),
    );
  });

  it('rejects an inactive or invalid sales-agent owner', async () => {
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
      callback({
        salesAgentReferral: { findUnique: vi.fn().mockResolvedValue({
          status: 'attributed',
          salesAgent: { isActive: false, role: 'salesAgent', salesAgentProfile: { status: 'active' } },
        }) },
      } as never),
    );
    await expect(confirmSalesAgentTenantPayment(input))
      .rejects.toMatchObject({ code: 'SALES_AGENT_NOT_ACTIVE' });
  });

  it('rejects a selected license that is not the current active license', async () => {
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) =>
      callback({
        salesAgentReferral: { findUnique: vi.fn().mockResolvedValue({
          salesAgentReferralId: 'referral-1',
          salesAgentUserId: 'agent-1',
          status: 'attributed',
          salesAgent: { isActive: true, role: 'salesAgent', salesAgentProfile: { status: 'active' } },
        }) },
        tenantLicense: { findFirst: vi.fn().mockResolvedValue({
          tenantLicenseId: 'newer-license',
          tenantId: input.tenantId,
        }) },
        tenantMembership: { findFirst: vi.fn().mockResolvedValue({ membershipId: 'active' }) },
      } as never),
    );
    await expect(confirmSalesAgentTenantPayment(input))
      .rejects.toMatchObject({ code: 'LICENSE_NOT_CURRENT' });
  });
});
