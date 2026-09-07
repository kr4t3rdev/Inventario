/**
 * @description Tests unitarios para renewLicenciaAction.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/plan-pricing', () => ({
  resolveLicensePricing: vi.fn((precio: number, referred: boolean) => ({
    listPriceUsd: precio,
    finalPriceUsd: referred ? precio - 5 : precio,
  })),
  isTenantReferred: vi.fn().mockResolvedValue(false),
}));
vi.mock('@/features/sales-agent/services/payment-service', () => ({
  confirmSalesAgentTenantPayment: vi
    .fn()
    .mockResolvedValue({ credited: true, duplicate: false, ledgerId: 'ledger-1' }),
}));
vi.mock('@/features/affiliate/actions', () => ({
  confirmReferredTenantPaymentAction: vi
    .fn()
    .mockResolvedValue({ success: true, data: { ledgerId: 'aff-ledger-1' } }),
}));
vi.mock('@/lib/prisma', () => {
  const mock = {
    $transaction: vi.fn(),
    tenantLicense: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    plan: { findUnique: vi.fn() },
    tenantMembership: { findFirst: vi.fn() },
    user: { updateMany: vi.fn() },
    tenantLicensePayment: { create: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    salesAgentReferral: { findUnique: vi.fn() },
    affiliateReferral: { findUnique: vi.fn() },
  };
  return { prisma: mock };
});

vi.mock('@/lib/db/platform-prisma', async () => {
  const { prisma } = await import('@/lib/prisma');
  return { prismaPlatform: prisma, default: prisma };
});

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { renewLicenciaAction } from '@/features/admin/actions';
import { confirmSalesAgentTenantPayment } from '@/features/sales-agent/services/payment-service';

const adminUser: AuthenticatedUser = {
  userId: 'admin-1',
  tenantId: null,
  tenantRole: null,
  role: 'admin',
  email: 'admin@test',
  name: 'Admin',
} as unknown as AuthenticatedUser;

const now = new Date('2026-01-01T00:00:00.000Z');
const currentExpiracion = new Date('2026-03-12T00:00:00.000Z');

const licenseActive = {
  tenantLicenseId: 'lic-1',
  tenantId: 'tenant-1',
  planId: 'plan-basic',
  activa: true,
  expiracion: currentExpiracion,
  inicio: new Date('2025-12-12T00:00:00.000Z'),
  isDemo: false,
  isAdminTest: false,
  finalPriceUsd: '40',
  listPriceUsd: '40',
  featureOverrides: {},
  plan: { planId: 'plan-basic', nombre: 'Básico', precio: '40', duracionDias: 30, maxUsuarios: 3, maxAlmacenes: 2, maxProductos: 100, maxClientes: 200 },
};

const planPro = {
  planId: 'plan-pro',
  nombre: 'Profesional',
  precio: '80',
  duracionDias: 90,
  maxUsuarios: 10,
  maxAlmacenes: 5,
  maxProductos: 500,
  maxClientes: 1000,
};

function buildTx(overrides: Record<string, unknown> = {}) {
  return {
    tenantLicense: {
      findUnique: vi.fn().mockResolvedValue(licenseActive),
      update: vi.fn().mockResolvedValue({ ...licenseActive, expiracion: new Date('2026-04-11T00:00:00.000Z'), planId: 'plan-basic' }),
    },
    plan: { findUnique: vi.fn().mockResolvedValue(licenseActive.plan) },
    tenantMembership: { findFirst: vi.fn().mockResolvedValue({ membershipId: 'mem-1', userId: 'u-1', tenantId: 'tenant-1' }) },
    user: { updateMany: vi.fn().mockResolvedValue({ count: 3 }) },
    tenantLicensePayment: {
      create: vi.fn().mockResolvedValue({ tenantLicensePaymentId: 'pay-1' }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    ...overrides,
  } as never;
}

describe('renewLicenciaAction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
    // default peek para el chequeo de referido: el admin action consulta
    // salesAgentReferral/affiliateReferral fuera de tx antes de actualizar
    vi.mocked(prisma.tenantLicense.findUnique).mockResolvedValue({
      tenantId: 'tenant-1',
    } as never);
    vi.mocked(prisma.salesAgentReferral.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.affiliateReferral.findUnique).mockResolvedValue(null as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renueva licencia activa sin cambio de plan ni pago', async () => {
    const tx = buildTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic' });

    expect(result.success).toBe(true);
    expect(tx.tenantLicense.update).toHaveBeenCalled();
    const updateArgs = tx.tenantLicense.update.mock.calls[0][0] as {
      where: { tenantLicenseId: string };
      data: { planId: string; activa: boolean; expiracion: Date };
    };
    expect(updateArgs.where).toEqual({ tenantLicenseId: 'lic-1' });
    expect(updateArgs.data.planId).toBe('plan-basic');
    expect(updateArgs.data.activa).toBe(true);
    expect(updateArgs.data.expiracion).toEqual(new Date('2026-04-11T00:00:00.000Z'));
    expect(tx.user.updateMany).toHaveBeenCalled();
    const userArgs = tx.user.updateMany.mock.calls[0][0] as {
      where: { tenantMemberships: { some: { tenantId: string; isActive: boolean } } };
      data: { expiresAt: Date; isActive: boolean };
    };
    // La implementación realiza el update scoping sobre memberships activas,
    // no sobre un where directo por tenantId (fase del fix de afiliación).
    expect(userArgs.where.tenantMemberships.some.tenantId).toBe('tenant-1');
    expect(userArgs.data.expiresAt).toEqual(new Date('2026-04-11T00:00:00.000Z'));
    expect(userArgs.data.isActive).toBe(true);
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    expect(tx.tenantLicensePayment.create).not.toHaveBeenCalled();
    expect(confirmSalesAgentTenantPayment).not.toHaveBeenCalled();
    expect(result.data).toEqual(expect.objectContaining({
      tenantLicenseId: 'lic-1',
      newPlanId: 'plan-basic',
    }));
  });

  it('renueva con cambio de plan sincronizando planId y max* del nuevo plan', async () => {
    const tx = buildTx({ plan: { findUnique: vi.fn().mockResolvedValue(planPro) } });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-pro' });

    expect(result.success).toBe(true);
    expect(tx.tenantLicense.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        planId: 'plan-pro',
        maxUsuarios: 10,
        maxAlmacenes: 5,
        maxProductos: 500,
        maxClientes: 1000,
        features: Prisma.JsonNull,
        featureOverrides: {},
      }),
    }));
    // 90 días sumados a expiración actual 2026-03-12 → 2026-06-10
    expect(tx.tenantLicense.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ expiracion: new Date('2026-06-10T00:00:00.000Z') }),
    }));
    expect(result.data?.newPlanId).toBe('plan-pro');
  });

  it('renueva licencia inactiva/expirada tomando base desde now y reactiva', async () => {
    const expired = { ...licenseActive, activa: false, expiracion: new Date('2025-11-01T00:00:00.000Z') };
    const tx = buildTx({ tenantLicense: { findUnique: vi.fn().mockResolvedValue(expired), update: vi.fn().mockResolvedValue({ ...expired, activa: true, expiracion: new Date('2026-01-31T00:00:00.000Z') }) } });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic' });

    expect(result.success).toBe(true);
    expect(tx.tenantLicense.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        activa: true,
        // base = now (2026-01-01) + 30 días = 2026-01-31
        expiracion: new Date('2026-01-31T00:00:00.000Z'),
      }),
    }));
  });

  it('rechaza con TENANT_NOT_ACTIVE si el tenant no tiene membresías activas', async () => {
    const tx = buildTx({ tenantMembership: { findFirst: vi.fn().mockResolvedValue(null) } });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TENANT_NOT_ACTIVE');
    expect(tx.tenantLicense.update).not.toHaveBeenCalled();
  });

  it('crea TenantLicensePayment dentro de la transacción cuando registerPayment y no referido', async () => {
    const tx = buildTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 40,
      idempotencyKey: 'renewal:tenant-1:2026-04',
    });

    expect(result.success).toBe(true);
    expect(tx.tenantLicensePayment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        paymentKind: 'renewal',
        status: 'confirmed',
        confirmedByAdminId: 'admin-1',
        idempotencyKey: 'renewal:tenant-1:2026-04',
      }),
    }));
    expect(result.data?.registeredPaymentId).toBe('pay-1');
    expect(confirmSalesAgentTenantPayment).not.toHaveBeenCalled();
  });

  it('invoca confirmSalesAgentTenantPayment fuera de tx cuando registerPayment y referido por gestor', async () => {
    vi.mocked(prisma.salesAgentReferral.findUnique).mockResolvedValue({
      salesAgentReferralId: 'sar-1',
    } as never);
    const tx = buildTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));
    vi.mocked(confirmSalesAgentTenantPayment).mockResolvedValue({ credited: true, duplicate: false, ledgerId: 'ledger-referred' });

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 40,
      idempotencyKey: 'renewal:tenant-1:2026-04',
    });

    expect(result.success).toBe(true);
    expect(tx.tenantLicensePayment.create).not.toHaveBeenCalled();
    expect(confirmSalesAgentTenantPayment).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      tenantLicenseId: 'lic-1',
      idempotencyKey: 'renewal:tenant-1:2026-04',
      amountPaidUsd: 40,
      confirmedByAdminId: 'admin-1',
    }));
    expect(result.data?.commissionCredited).toBe(true);
  });

  it('rechaza con PAYMENT_AMOUNT_MISMATCH si el monto pagado difiere del exigible (no referido)', async () => {
    const tx = buildTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 90,
      idempotencyKey: 'renewal:tenant-1:2026-04',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('PAYMENT_AMOUNT_MISMATCH');
    expect(tx.tenantLicensePayment.create).not.toHaveBeenCalled();
  });

  it('retorna duplicate:true sin crear pago si la idempotencyKey ya fue persistida (no referido)', async () => {
    const tx = buildTx({
      tenantLicensePayment: {
        create: vi.fn().mockResolvedValue({ tenantLicensePaymentId: 'pay-1' }),
        findUnique: vi.fn().mockResolvedValue({ tenantLicensePaymentId: 'pay-existing' }),
      },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 40,
      idempotencyKey: 'renewal:tenant-1:2026-04',
    });

    expect(result.success).toBe(true);
    expect(tx.tenantLicensePayment.create).not.toHaveBeenCalled();
    expect(result.data?.duplicate).toBe(true);
    expect(result.data?.registeredPaymentId).toBe('pay-existing');
  });

  it('registra pago sin comisión cuando el tenant es referido por afiliado', async () => {
    vi.mocked(prisma.affiliateReferral.findUnique).mockResolvedValue({
      referralId: 'ref-aff-1',
    } as never);
    const tx = buildTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 40,
      idempotencyKey: 'renewal:tenant-1:2026-04',
    });

    expect(result.success).toBe(true);
    expect(tx.tenantLicensePayment.create).toHaveBeenCalled();
    expect(confirmSalesAgentTenantPayment).not.toHaveBeenCalled();
    expect(result.data?.commissionCredited).toBe(false);
  });

  it('rechaza con FORBIDDEN si el usuario no es admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...adminUser, role: 'user' } as unknown as AuthenticatedUser);

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FORBIDDEN');
  });
});
