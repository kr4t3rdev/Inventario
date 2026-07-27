import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/features/sales-agent/services/payment-service', () => ({
  confirmSalesAgentTenantPayment: vi.fn(),
}));
vi.mock('@/features/sales-agent/services/payout-service', () => ({
  confirmSalesAgentPayout: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    salesAgentReferral: { findMany: vi.fn() },
    salesAgentProfile: { findUnique: vi.fn() },
    salesAgentCommissionLedger: { findMany: vi.fn() },
    salesAgentBalance: { findUnique: vi.fn() },
    salesAgentPayout: { findMany: vi.fn() },
    notification: { findMany: vi.fn() },
    tasaCambio: { findFirst: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { confirmSalesAgentTenantPayment } from '@/features/sales-agent/services/payment-service';
import { confirmSalesAgentPayout } from '@/features/sales-agent/services/payout-service';
import { prisma } from '@/lib/prisma';
import {
  confirmSalesAgentPaymentAction,
  confirmSalesAgentPayoutAction,
  getAdminSalesAgentTenantPaymentsAction,
  getSalesAgentDashboardAction,
} from '../actions';

const admin = {
  userId: 'admin-1',
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin',
  isActive: true,
  tenantId: null,
  tenantRole: null,
};
const agent = {
  ...admin,
  userId: 'agent-1',
  role: 'salesAgent',
};

describe('sales-agent actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('solo permite a platform admin confirmar pagos', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(agent as never);

    const result = await confirmSalesAgentPaymentAction({
      tenantId: 'tenant-1',
      tenantLicenseId: 'license-1',
      idempotencyKey: 'pay-1',
      amountPaidUsd: 100,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(confirmSalesAgentTenantPayment).not.toHaveBeenCalled();
  });

  it('solo permite a platform admin confirmar payouts presenciales', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(agent as never);

    const result = await confirmSalesAgentPayoutAction({
      userId: 'agent-1',
      amountUsd: 25,
      exchangeRateCupPerUsd: 320,
      idempotencyKey: 'payout-1',
    });

    expect(result).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } });
    expect(confirmSalesAgentPayout).not.toHaveBeenCalled();
  });

  it('queries referred tenants with the real Tenant relation keys', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin as never);
    vi.mocked(prisma.salesAgentReferral.findMany).mockResolvedValue([]);

    await getAdminSalesAgentTenantPaymentsAction(undefined);

    expect(prisma.salesAgentReferral.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          referredTenant: {
            select: expect.objectContaining({
              licencias: expect.any(Object),
            }),
          },
        }),
      }),
    );
  });

  it.each([
    { amountUsd: Number.POSITIVE_INFINITY, exchangeRateCupPerUsd: 320 },
    { amountUsd: 10_000_000_000, exchangeRateCupPerUsd: 320 },
    { amountUsd: 25, exchangeRateCupPerUsd: Number.POSITIVE_INFINITY },
    { amountUsd: 25, exchangeRateCupPerUsd: 100_000_000 },
    { amountUsd: 9_999_999_999.99, exchangeRateCupPerUsd: 101 },
  ])('rejects payout values outside persisted decimal bounds: %j', async (values) => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin as never);

    const result = await confirmSalesAgentPayoutAction({
      userId: 'agent-1',
      ...values,
      idempotencyKey: 'bounded-payout',
    });

    expect(result).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    expect(confirmSalesAgentPayout).not.toHaveBeenCalled();
  });

  it('no acepta rate ni commission en el contrato del cliente', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin as never);

    const result = await confirmSalesAgentPaymentAction({
      tenantId: 'tenant-1',
      tenantLicenseId: 'license-1',
      idempotencyKey: 'pay-1',
      amountPaidUsd: 100,
      commissionRate: 0.99,
    } as never);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('permite al gestor consultar solo su dashboard básico', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(agent as never);
    vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValue({
      referralCode: 'SA-OWNER',
      status: 'active',
    } as never);
    vi.mocked(prisma.salesAgentReferral.findMany).mockResolvedValue([]);
    vi.mocked(prisma.salesAgentCommissionLedger.findMany).mockResolvedValue([]);
    vi.mocked(prisma.salesAgentBalance.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.salesAgentPayout.findMany).mockResolvedValue([]);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);
    vi.mocked(prisma.tasaCambio.findFirst).mockResolvedValue(null);

    const result = await getSalesAgentDashboardAction({});

    expect(result.success).toBe(true);
    expect(prisma.salesAgentReferral.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { salesAgentUserId: 'agent-1' } }),
    );
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'agent-1' } }),
    );
    expect(result.data).not.toHaveProperty('email');
    expect(result.data).not.toHaveProperty('tenantId');
  });

  it('impide que un gestor consulte datos de otro gestor', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(agent as never);

    const result = await getSalesAgentDashboardAction({ salesAgentUserId: 'agent-2' });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  it('limita el DTO referido a información comercial y financiera permitida', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(agent as never);
    vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValue({
      referralCode: 'SA-OWNER',
      status: 'active',
    } as never);
    vi.mocked(prisma.salesAgentReferral.findMany).mockResolvedValue([{
      salesAgentReferralId: 'ref-1',
      status: 'attributed',
      attributedAt: new Date('2026-07-01T00:00:00.000Z'),
      referredTenant: {
        nombre: 'Comercial Permitido',
        licencias: [{
          activa: true,
          expiracion: new Date('2030-01-01T00:00:00.000Z'),
          finalPriceUsd: { toString: () => '100.00' },
          plan: { nombre: 'Profesional' },
        }],
      },
    }] as never);
    vi.mocked(prisma.salesAgentCommissionLedger.findMany).mockResolvedValue([]);
    vi.mocked(prisma.salesAgentBalance.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.salesAgentPayout.findMany).mockResolvedValue([]);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);
    vi.mocked(prisma.tasaCambio.findFirst).mockResolvedValue(null);

    const result = await getSalesAgentDashboardAction({});

    expect(result).toMatchObject({
      success: true,
      data: {
        referrals: [{
          tenant: {
            commercialName: 'Comercial Permitido',
            plan: 'Profesional',
            licenseStatus: 'active',
            commissionBaseUsd: '100.00',
          },
        }],
      },
    });
    expect(result.data?.referrals[0].tenant).toEqual(expect.not.objectContaining({
      direccion: expect.anything(),
      telefono: expect.anything(),
      tenantId: expect.anything(),
      memberships: expect.anything(),
    }));
  });
});
