/**
 * @description Tests de regresión para renewLicenciaAction y el servicio de
 * renovación. Exigen el comportamiento CORRECTO: descuento por referido
 * conservado sin pago, idempotencia de toda la operación vía recibo
 * persistido (LicenseRenewalOperation), validación de identidad de la clave
 * de pago, comisión del gestor dentro de la transacción (rollback atómico)
 * y preservación de los contratos existentes (reset de overrides al cambiar
 * de plan según spec, isDemo en demos, sincronización de usuarios, auditoría).
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
    .mockResolvedValue({ credited: true, duplicate: false, ledgerId: 'ledger-legacy' }),
  confirmSalesAgentTenantPaymentInTx: vi.fn().mockResolvedValue({
    result: { credited: true, duplicate: false, ledgerId: 'ledger-1', paymentId: 'pay-agent-1' },
    deliveryIds: ['ev-1'],
  }),
}));
vi.mock('@/features/sales-agent/services/notification-service', () => ({
  deliverSalesAgentEmails: vi.fn().mockResolvedValue(undefined),
  createSalesAgentEvent: vi.fn().mockResolvedValue('ev-1'),
}));
vi.mock('@/lib/prisma', () => {
  const mock = {
    $transaction: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ tenantLicenseId: 'lic-1' }]),
    tenantLicense: { findUnique: vi.fn(), update: vi.fn() },
    plan: { findUnique: vi.fn() },
    tenantMembership: { findFirst: vi.fn() },
    user: { updateMany: vi.fn() },
    tenantLicensePayment: { create: vi.fn(), findUnique: vi.fn() },
    licenseRenewalOperation: { findUnique: vi.fn(), create: vi.fn() },
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
import { revalidatePath } from 'next/cache';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { renewLicenciaAction } from '@/features/admin/actions';
import { quoteRenewalLicenciaAction } from '@/features/admin/actions';
import { resolveLicensePricing } from '@/lib/services/plan-pricing';
import { confirmSalesAgentTenantPayment } from '@/features/sales-agent/services/payment-service';
import { confirmSalesAgentTenantPaymentInTx } from '@/features/sales-agent/services/payment-service';
import { deliverSalesAgentEmails } from '@/features/sales-agent/services/notification-service';
import {
  hashRenewalKey,
  fingerprintRenewalPayload,
  snapshotRenewalOutcome,
} from '@/features/admin/services/renew-licencia-idempotency';

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
const renewedExpiracion = new Date('2026-04-11T00:00:00.000Z');

const licenseActive = {
  tenantLicenseId: 'lic-1',
  tenantId: 'tenant-1',
  planId: 'plan-basic',
  activa: true,
  expiracion: currentExpiracion,
  inicio: new Date('2025-12-12T00:00:00.000Z'),
  isDemo: false,
  isAdminTest: false,
  finalPriceUsd: 40,
  listPriceUsd: 40,
  features: { custom: 'flag' },
  featureOverrides: { 'contabilidad.moneda': 'USD' },
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

const noPaymentKeylessPayload = {
  tenantLicenseId: 'lic-1',
  planId: 'plan-basic',
  registerPayment: false,
  amountPaidUsd: null,
  durationDays: null,
};

function buildTx(overrides: Record<string, unknown> = {}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ tenantLicenseId: 'lic-1' }]),
    tenantLicense: {
      findUnique: vi.fn().mockResolvedValue(licenseActive),
      update: vi.fn().mockResolvedValue({ ...licenseActive, expiracion: renewedExpiracion }),
    },
    plan: { findUnique: vi.fn().mockResolvedValue(licenseActive.plan) },
    tenantMembership: { findFirst: vi.fn().mockResolvedValue({ membershipId: 'mem-1', userId: 'u-1', tenantId: 'tenant-1' }) },
    user: { updateMany: vi.fn().mockResolvedValue({ count: 3 }) },
    tenantLicensePayment: {
      create: vi.fn().mockResolvedValue({ tenantLicensePaymentId: 'pay-1' }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    licenseRenewalOperation: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'receipt-1' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    salesAgentReferral: { findUnique: vi.fn().mockResolvedValue(null) },
    affiliateReferral: { findUnique: vi.fn().mockResolvedValue(null) },
    ...overrides,
  };
}

describe('renewLicenciaAction — regresión del flujo de renovación', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('REGRESIÓN: renovar sin pago a tenant referido conserva el descuento (finalPriceUsd = precio - 5)', async () => {
    const tx = buildTx({
      salesAgentReferral: { findUnique: vi.fn().mockResolvedValue({ salesAgentReferralId: 'sar-1' }) },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic', registerPayment: false });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    // La detección de referidos corre dentro de la tx, independiente de registerPayment
    expect(tx.salesAgentReferral.findUnique).toHaveBeenCalledWith({
      where: { referredTenantId: 'tenant-1' },
      select: { salesAgentReferralId: true },
    });
    expect(resolveLicensePricing).toHaveBeenCalledWith(40, true);
    expect(tx.tenantLicense.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        finalPriceUsd: 35,
        listPriceUsd: 40,
      }),
    }));
  });

  it('REGRESIÓN: comisión del gestor corre dentro de la transacción con descuento aplicado', async () => {
    const tx = buildTx({
      salesAgentReferral: { findUnique: vi.fn().mockResolvedValue({ salesAgentReferralId: 'sar-1' }) },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 35,
      idempotencyKey: 'renewal:tenant-1:it-1',
    });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(resolveLicensePricing).toHaveBeenCalledWith(40, true);
    expect(tx.tenantLicense.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ finalPriceUsd: 35, listPriceUsd: 40 }),
    }));
    // El pago + comisión del gestor ocurren DENTRO de la tx con el cliente transaccional
    expect(confirmSalesAgentTenantPaymentInTx).toHaveBeenCalledTimes(1);
    const [txClient, inTxInput] = vi.mocked(confirmSalesAgentTenantPaymentInTx).mock.calls[0] as unknown as [unknown, Record<string, unknown>];
    expect(txClient).toBe(tx);
    expect(inTxInput).toEqual(expect.objectContaining({
      tenantId: 'tenant-1',
      tenantLicenseId: 'lic-1',
      idempotencyKey: 'renewal:tenant-1:it-1',
      confirmedByAdminId: 'admin-1',
      paymentKind: 'renewal',
    }));
    expect((inTxInput.expectedExpiration as Date).toISOString()).toBe(renewedExpiracion.toISOString());
    // La variante legacy fuera de tx ya no se usa desde la renovación
    expect(confirmSalesAgentTenantPayment).not.toHaveBeenCalled();
    expect(result.data?.commissionCredited).toBe(true);
    expect(result.data?.registeredPaymentId).toBe('pay-agent-1');
    // Los emails se despachan post-commit, fuera de la tx
    expect(deliverSalesAgentEmails).toHaveBeenCalledWith(['ev-1']);
  });

  it('REGRESIÓN: si la comisión del gestor falla, la renovación se revierte por completo', async () => {
    const tx = buildTx({
      salesAgentReferral: { findUnique: vi.fn().mockResolvedValue({ salesAgentReferralId: 'sar-1' }) },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));
    vi.mocked(confirmSalesAgentTenantPaymentInTx).mockRejectedValue(
      new Error('ledger down'),
    );

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 35,
      idempotencyKey: 'renewal:tenant-1:it-1',
    });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    // El error propaga y aborta la tx: nada posterior queda persistido
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.licenseRenewalOperation.create).not.toHaveBeenCalled();
    expect(tx.tenantLicensePayment.create).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('REGRESIÓN: replay con la misma clave devuelve el outcome original sin extender ni repetir pago', async () => {
    const key = 'renewal:tenant-1:it-1';
    const paidPayload = {
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 40,
      durationDays: null,
    };
    const receipt = {
      id: 'receipt-1',
      tenantId: 'tenant-1',
      keyHash: hashRenewalKey(key),
      payloadFingerprint: fingerprintRenewalPayload(paidPayload),
      tenantLicenseId: 'lic-1',
      responseSnapshot: snapshotRenewalOutcome({
        tenantLicenseId: 'lic-1',
        newPlanId: 'plan-basic',
        previousPlanId: 'plan-basic',
        newExpiracion: renewedExpiracion.toISOString(),
        previousExpiracion: currentExpiracion.toISOString(),
        registeredPaymentId: 'pay-1',
        commissionCredited: false,
      }),
    };
    const tx = buildTx({
      licenseRenewalOperation: {
        findUnique: vi.fn().mockResolvedValue(receipt),
        create: vi.fn(),
      },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 40,
      idempotencyKey: key,
    });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(result.data?.duplicate).toBe(true);
    expect(result.data?.newExpiracion).toBe(renewedExpiracion.toISOString());
    expect(result.data?.registeredPaymentId).toBe('pay-1');
    // Sin segunda extensión ni escrituras de ningún tipo
    expect(tx.tenantLicense.update).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.tenantLicensePayment.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(confirmSalesAgentTenantPaymentInTx).not.toHaveBeenCalled();
  });

  it('REGRESIÓN: replay con la misma clave pero payload distinto → IDEMPOTENCY_CONFLICT', async () => {
    const key = 'renewal:tenant-1:it-1';
    const tx = buildTx({
      licenseRenewalOperation: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'receipt-1',
          tenantId: 'tenant-1',
          keyHash: hashRenewalKey(key),
          payloadFingerprint: 'huella-distinta',
          tenantLicenseId: 'lic-1',
          responseSnapshot: {},
        }),
        create: vi.fn(),
      },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: false,
      idempotencyKey: key,
    });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(tx.tenantLicense.update).not.toHaveBeenCalled();
  });

  it('REGRESIÓN: pago legado con la misma clave y misma licencia → duplicado sin extender', async () => {
    const key = 'renewal:tenant-1:legacy';
    const tx = buildTx({
      tenantLicensePayment: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          tenantLicensePaymentId: 'pay-old',
          tenantId: 'tenant-1',
          tenantLicenseId: 'lic-1',
          paymentCycleEndsAt: renewedExpiracion,
        }),
      },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 40,
      idempotencyKey: key,
    });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(result.data?.duplicate).toBe(true);
    expect(result.data?.registeredPaymentId).toBe('pay-old');
    expect(result.data?.newExpiracion).toBe(renewedExpiracion.toISOString());
    expect(tx.tenantLicense.update).not.toHaveBeenCalled();
    expect(tx.tenantLicensePayment.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('REGRESIÓN: clave de pago reutilizada de otra licencia → IDEMPOTENCY_CONFLICT sin renovar', async () => {
    const key = 'renewal:tenant-2:robada';
    const tx = buildTx({
      tenantLicensePayment: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          tenantLicensePaymentId: 'pay-ajeno',
          tenantId: 'tenant-2',
          tenantLicenseId: 'lic-otra',
          paymentCycleEndsAt: renewedExpiracion,
        }),
      },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 40,
      idempotencyKey: key,
    });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(tx.tenantLicense.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('REGRESIÓN: renovación con clave crea el recibo con keyHash, fingerprint y snapshot', async () => {
    const key = 'renewal:tenant-1:it-nopay';
    const tx = buildTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: false,
      idempotencyKey: key,
    });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(tx.licenseRenewalOperation.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        keyHash: hashRenewalKey(key),
        payloadFingerprint: fingerprintRenewalPayload(noPaymentKeylessPayload),
        tenantLicenseId: 'lic-1',
        responseSnapshot: snapshotRenewalOutcome({
          tenantLicenseId: 'lic-1',
          newPlanId: 'plan-basic',
          previousPlanId: 'plan-basic',
          newExpiracion: renewedExpiracion.toISOString(),
          previousExpiracion: currentExpiracion.toISOString(),
          registeredPaymentId: null,
          commissionCredited: false,
        }),
      },
    });
  });

  it('renovación sin clave preserva el comportamiento legado: no consulta ni crea recibos', async () => {
    const tx = buildTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic', registerPayment: false });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(tx.licenseRenewalOperation.findUnique).not.toHaveBeenCalled();
    expect(tx.licenseRenewalOperation.create).not.toHaveBeenCalled();
    expect(tx.tenantLicense.update).toHaveBeenCalled();
  });

  it('renovar con pago a afiliado exige finalPriceUsd: pagar precio de lista falla', async () => {
    const tx = buildTx({
      affiliateReferral: { findUnique: vi.fn().mockResolvedValue({ referralId: 'ref-aff-1' }) },
      tenantLicense: {
        findUnique: vi.fn().mockResolvedValue(licenseActive),
        update: vi.fn().mockResolvedValue({ ...licenseActive, finalPriceUsd: 35, listPriceUsd: 40 }),
      },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 40,
      idempotencyKey: 'renewal:tenant-1:it-1',
    });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('PAYMENT_AMOUNT_MISMATCH');
    expect(tx.tenantLicensePayment.create).not.toHaveBeenCalled();
  });

  it('renovar con pago a afiliado pagando el monto con descuento crea el pago con expectedAmount = finalPriceUsd', async () => {
    const tx = buildTx({
      affiliateReferral: { findUnique: vi.fn().mockResolvedValue({ referralId: 'ref-aff-1' }) },
      tenantLicense: {
        findUnique: vi.fn().mockResolvedValue(licenseActive),
        update: vi.fn().mockResolvedValue({ ...licenseActive, finalPriceUsd: 35, listPriceUsd: 40 }),
      },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 35,
      idempotencyKey: 'renewal:tenant-1:it-1',
    });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(tx.tenantLicensePayment.create).toHaveBeenCalledOnce();
    const createArgs = tx.tenantLicensePayment.create.mock.calls[0][0] as {
      data: { expectedAmountUsd: unknown; amountPaidUsd: unknown };
    };
    expect(new Prisma.Decimal(createArgs.data.expectedAmountUsd as never).equals(35)).toBe(true);
    expect(new Prisma.Decimal(createArgs.data.amountPaidUsd as never).equals(35)).toBe(true);
    expect(confirmSalesAgentTenantPaymentInTx).not.toHaveBeenCalled();
    expect(result.data?.commissionCredited).toBe(false);
  });

  it('mismo plan preserva features y featureOverrides existentes', async () => {
    const tx = buildTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic', registerPayment: false });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(tx.tenantLicense.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        features: licenseActive.features,
        featureOverrides: licenseActive.featureOverrides,
      }),
    }));
  });

  it('cambiar de plan al renovar resetea features a JsonNull y featureOverrides a vacío (contrato de spec)', async () => {
    const tx = buildTx({ plan: { findUnique: vi.fn().mockResolvedValue(planPro) } });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-pro', registerPayment: false });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(tx.tenantLicense.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        features: Prisma.JsonNull,
        featureOverrides: {},
      }),
    }));
  });

  it('renovar una demo NO limpia isDemo (solo convertDemoToPaidPlanAction lo hace)', async () => {
    const demoLicense = { ...licenseActive, isDemo: true };
    const tx = buildTx({
      tenantLicense: {
        findUnique: vi.fn().mockResolvedValue(demoLicense),
        update: vi.fn().mockResolvedValue({ ...demoLicense, expiracion: renewedExpiracion }),
      },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic', registerPayment: false });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    const updateArgs = tx.tenantLicense.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect('isDemo' in updateArgs.data).toBe(false);
    expect(updateArgs.data.activa).toBe(true);
  });

  it('renovar una demo desactivada por cron la reactiva conservando isDemo', async () => {
    const demoExpired = { ...licenseActive, isDemo: true, activa: false, expiracion: new Date('2025-11-01T00:00:00.000Z') };
    const tx = buildTx({
      tenantLicense: {
        findUnique: vi.fn().mockResolvedValue(demoExpired),
        update: vi.fn().mockResolvedValue({ ...demoExpired, activa: true, expiracion: new Date('2026-01-31T00:00:00.000Z') }),
      },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic', registerPayment: false });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    const updateArgs = tx.tenantLicense.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data.activa).toBe(true);
    expect('isDemo' in updateArgs.data).toBe(false);
    expect(updateArgs.data.expiracion).toEqual(new Date('2026-01-31T00:00:00.000Z'));
  });

  it('rechaza con NOT_FOUND si la licencia no existe', async () => {
    const tx = buildTx({ tenantLicense: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() } });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-inexistente', planId: 'plan-basic', registerPayment: false });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(tx.tenantLicense.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rechaza con PLAN_NOT_FOUND si el plan destino no existe', async () => {
    const tx = buildTx({ plan: { findUnique: vi.fn().mockResolvedValue(null) } });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-fantasma', registerPayment: false });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('PLAN_NOT_FOUND');
    expect(tx.tenantLicense.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rechaza con VALIDATION_ERROR si plan.duracionDias no es un entero positivo', async () => {
    const planInvalido = { ...licenseActive.plan, duracionDias: 0 };
    const tx = buildTx({ plan: { findUnique: vi.fn().mockResolvedValue(planInvalido) } });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic', registerPayment: false });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(tx.tenantLicense.update).not.toHaveBeenCalled();
  });

  it('valida Zod: registerPayment=true sin idempotencyKey se rechaza antes de tocar prisma', async () => {
    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 40,
    });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('valida Zod: amountPaidUsd debe ser positivo', async () => {
    const result = await renewLicenciaAction({
      tenantLicenseId: 'lic-1',
      planId: 'plan-basic',
      registerPayment: true,
      amountPaidUsd: 0,
      idempotencyKey: 'renewal:tenant-1:it-1',
    });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza con TENANT_NOT_ACTIVE si el tenant no tiene membresías activas', async () => {
    const tx = buildTx({ tenantMembership: { findFirst: vi.fn().mockResolvedValue(null) } });
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic', registerPayment: false });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('TENANT_NOT_ACTIVE');
    expect(tx.tenantLicense.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rechaza con FORBIDDEN si el usuario no es admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...adminUser, role: 'user' } as unknown as AuthenticatedUser);

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic', registerPayment: false });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('FORBIDDEN');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('éxito keyless: revalidatePath, auditoría con diff completo, sync de usuarios y resultado sin recibos', async () => {
    const tx = buildTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(tx));

    const result = await renewLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic', registerPayment: false });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/licencias');
    expect(revalidatePath).toHaveBeenCalledWith('/admin');

    // Bloqueo pesimista de la fila antes de leer estado
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    const userArgs = tx.user.updateMany.mock.calls[0][0] as {
      where: { tenantMemberships: { some: { tenantId: string; isActive: boolean } } };
      data: { expiresAt: Date; isActive: boolean };
    };
    expect(userArgs.where.tenantMemberships.some.tenantId).toBe('tenant-1');
    expect(userArgs.data.expiresAt).toEqual(renewedExpiracion);
    expect(userArgs.data.isActive).toBe(true);

    const auditArgs = tx.auditLog.create.mock.calls[0][0] as {
      data: {
        accion: string;
        entidad: string;
        entidadId: string;
        detalles: Record<string, unknown>;
      };
    };
    expect(auditArgs.data.accion).toBe('UPDATE');
    expect(auditArgs.data.entidad).toBe('TENANT_LICENSE');
    expect(auditArgs.data.entidadId).toBe('lic-1');
    expect(auditArgs.data.detalles).toEqual(expect.objectContaining({
      previousExpiracion: currentExpiracion.toISOString(),
      newExpiracion: renewedExpiracion.toISOString(),
      previousPlanId: 'plan-basic',
      newPlanId: 'plan-basic',
      registerPayment: false,
      registeredPaymentId: null,
      via: 'web-admin',
    }));

    expect(result.data).toEqual(expect.objectContaining({
      tenantLicenseId: 'lic-1',
      previousExpiracion: currentExpiracion.toISOString(),
      previousPlanId: 'plan-basic',
      newExpiracion: renewedExpiracion.toISOString(),
      newPlanId: 'plan-basic',
      duplicate: false,
      commissionCredited: false,
    }));
  });
});

describe('quoteRenewalLicenciaAction — cotización de servidor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
    vi.mocked(prisma.tenantLicense.findUnique).mockResolvedValue(licenseActive as never);
    vi.mocked(prisma.salesAgentReferral.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.affiliateReferral.findUnique).mockResolvedValue(null as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('REGRESIÓN: cotiza el precio del plan SELECCIONADO con el descuento por referido', async () => {
    // La licencia tiene finalPriceUsd 40 del plan viejo: la cotización debe
    // ignorarlo y mostrar el precio del plan destino con descuento referido
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(planPro as never);
    vi.mocked(prisma.salesAgentReferral.findUnique).mockResolvedValue({
      salesAgentReferralId: 'sar-1',
    } as never);

    const result = await quoteRenewalLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-pro' });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(result.data).toEqual({
      tenantLicenseId: 'lic-1',
      planId: 'plan-pro',
      listPriceUsd: 80,
      finalPriceUsd: 75,
      duracionDias: 90,
      // base = expiración actual (2026-03-12) + 90 días
      newExpiracion: new Date('2026-06-10T00:00:00.000Z').toISOString(),
      esReferido: true,
    });
  });

  it('sin referido: finalPriceUsd es el precio de lista del plan destino', async () => {
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(planPro as never);

    const result = await quoteRenewalLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-pro' });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(result.data?.finalPriceUsd).toBe(80);
    expect(result.data?.listPriceUsd).toBe(80);
    expect(result.data?.esReferido).toBe(false);
  });

  it('licencia vencida: la base de la cotización es now', async () => {
    const expired = { ...licenseActive, expiracion: new Date('2025-11-01T00:00:00.000Z') };
    vi.mocked(prisma.tenantLicense.findUnique).mockResolvedValue(expired as never);
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(licenseActive.plan as never);

    const result = await quoteRenewalLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-basic' });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    // base = now (2026-01-01) + 30 días
    expect(result.data?.newExpiracion).toBe(new Date('2026-01-31T00:00:00.000Z').toISOString());
    expect(result.data?.duracionDias).toBe(30);
  });

  it('rechaza con NOT_FOUND si la licencia no existe', async () => {
    vi.mocked(prisma.tenantLicense.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(planPro as never);

    const result = await quoteRenewalLicenciaAction({ tenantLicenseId: 'lic-x', planId: 'plan-pro' });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('rechaza con PLAN_NOT_FOUND si el plan destino no existe', async () => {
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(null as never);

    const result = await quoteRenewalLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-x' });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('PLAN_NOT_FOUND');
  });

  it('rechaza con FORBIDDEN si el usuario no es admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...adminUser, role: 'user' } as unknown as AuthenticatedUser);

    const result = await quoteRenewalLicenciaAction({ tenantLicenseId: 'lic-1', planId: 'plan-pro' });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('FORBIDDEN');
  });
});
