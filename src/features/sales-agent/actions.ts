'use server';

import { z } from 'zod';
import { Decimal } from '@/generated/prisma/runtime/library';

import { prisma } from '@/lib/prisma';
import { ActionError, withAction } from '@/lib/server-actions';

import { confirmSalesAgentTenantPayment } from './services/payment-service';
import { confirmSalesAgentPayout } from './services/payout-service';
import { calculateSalesAgentPayout } from './services/commission-service';
import {
  calculateSalesAgentTier,
  getSalesAgentCommissionRate,
} from './services/tier-service';

const confirmPaymentSchema = z.object({
  tenantId: z.string().min(1),
  tenantLicenseId: z.string().min(1),
  idempotencyKey: z.string().min(1).max(191),
  amountPaidUsd: z.coerce.number().positive().optional(),
}).strict();

const dashboardSchema = z.object({
  salesAgentUserId: z.string().min(1).optional(),
}).strict();

const MAX_PAYOUT_USD = 9_999_999_999.99;
const MAX_EXCHANGE_RATE = 99_999_999.9999;
const MAX_PAYOUT_CUP = new Decimal('999999999999.99');

const payoutBaseSchema = z.object({
  userId: z.string().min(1),
  amountUsd: z.coerce.number().finite().positive().max(MAX_PAYOUT_USD),
  exchangeRateCupPerUsd: z.coerce.number().finite().positive().max(MAX_EXCHANGE_RATE),
  notes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().min(1).max(191),
}).strict();

const validateDerivedCup = (
  value: { amountUsd: number; exchangeRateCupPerUsd: number },
  context: z.RefinementCtx,
) => {
  const amountCup = new Decimal(value.amountUsd).mul(value.exchangeRateCupPerUsd);
  if (amountCup.gt(MAX_PAYOUT_CUP)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['exchangeRateCupPerUsd'],
      message: 'El monto CUP excede el máximo permitido',
    });
  }
};

const payoutSchema = payoutBaseSchema.superRefine(validateDerivedCup);

const payoutPreviewSchema = payoutBaseSchema.pick({
  userId: true,
  amountUsd: true,
  exchangeRateCupPerUsd: true,
}).superRefine(validateDerivedCup);

export type ConfirmSalesAgentPaymentDto = z.input<typeof confirmPaymentSchema>;
export type SalesAgentDashboardDto = z.input<typeof dashboardSchema>;
export type ConfirmSalesAgentPayoutDto = z.input<typeof payoutSchema>;

/**
 * @description Confirma como admin un pago inicial o renovación de tenant referido.
 * @param {ConfirmSalesAgentPaymentDto} input - Evento de pago idempotente sin tasa ni comisión.
 * @returns {Promise<object>} Resultado de crédito o duplicado.
 */
export const confirmSalesAgentPaymentAction = withAction(
  async (input: ConfirmSalesAgentPaymentDto, user) => {
    if (user.role !== 'admin') {
      throw new ActionError('Acceso restringido', 'FORBIDDEN');
    }
    return confirmSalesAgentTenantPayment({
      ...confirmPaymentSchema.parse(input),
      confirmedByAdminId: user.userId,
    });
  },
);

export const confirmSalesAgentPayoutAction = withAction(
  async (input: ConfirmSalesAgentPayoutDto, user) => {
    if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
    return confirmSalesAgentPayout({
      ...payoutSchema.parse(input),
      processedByAdminId: user.userId,
    });
  },
);

export const previewSalesAgentPayoutAction = withAction(
  async (input: z.input<typeof payoutPreviewSchema>, user) => {
    if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
    const parsed = payoutPreviewSchema.parse(input);
    const balance = await prisma.salesAgentBalance.findUnique({
      where: { userId: parsed.userId },
      select: { availableUsd: true },
    });
    if (!balance) throw new ActionError('Saldo no encontrado', 'NOT_FOUND');
    return calculateSalesAgentPayout({
      amountUsd: parsed.amountUsd,
      availableBalanceUsd: balance.availableUsd,
      exchangeRateCupPerUsd: parsed.exchangeRateCupPerUsd,
    });
  },
);

export const getAdminSalesAgentPayoutsAction = withAction(
  async (_input: undefined, user) => {
    if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
    const agents = await prisma.user.findMany({
      where: {
        role: 'salesAgent',
        salesAgentProfile: { status: 'active' },
      },
      orderBy: { name: 'asc' },
      select: {
        userId: true,
        name: true,
        isActive: true,
        salesAgentProfile: { select: { phone: true, status: true } },
        salesAgentBalance: { select: { availableUsd: true, paidUsd: true } },
        salesAgentReferrals: {
          where: { status: 'attributed' },
          select: { salesAgentReferralId: true },
        },
        salesAgentPayouts: {
          orderBy: { processedAt: 'desc' },
          take: 20,
          select: {
            salesAgentPayoutId: true,
            amountUsd: true,
            exchangeRateCupPerUsd: true,
            amountCup: true,
            status: true,
            processedAt: true,
            adminNotes: true,
          },
        },
      },
    });
    return agents.map((agent) => ({
      ...agent,
      activeReferralCount: agent.salesAgentReferrals.length,
      commissionRate: getSalesAgentCommissionRate(agent.salesAgentReferrals.length),
    }));
  },
);

/**
 * @description Lista tenants referidos y su licencia vigente para confirmar cobros desde Admin.
 * @returns {Promise<object[]>} Filas mínimas, sin datos personales del tenant.
 */
export const getAdminSalesAgentTenantPaymentsAction = withAction(
  async (_input: undefined, user) => {
    if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
    const now = new Date();
    const referrals = await prisma.salesAgentReferral.findMany({
      where: { status: 'attributed' },
      orderBy: { attributedAt: 'desc' },
      select: {
        salesAgentReferralId: true,
        salesAgent: { select: { userId: true, name: true } },
        referredTenant: {
          select: {
            tenantId: true,
            nombre: true,
            licencias: {
              where: {
                activa: true,
                expiracion: { gt: now },
                isDemo: false,
                isAdminTest: false,
              },
              orderBy: [{ inicio: 'desc' }, { createdAt: 'desc' }],
              take: 1,
              select: {
                tenantLicenseId: true,
                expiracion: true,
                finalPriceUsd: true,
                listPriceUsd: true,
                plan: { select: { nombre: true, precio: true } },
                salesAgentPayments: {
                  where: { status: 'confirmed' },
                  orderBy: { confirmedAt: 'desc' },
                  take: 1,
                  select: {
                    tenantLicensePaymentId: true,
                    paymentCycleEndsAt: true,
                    confirmedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return referrals.map((referral) => {
      const license = referral.referredTenant.licencias[0] ?? null;
      const amount =
        license?.finalPriceUsd ?? license?.listPriceUsd ?? license?.plan?.precio ?? null;
      const currentCycleConfirmed = Boolean(
        license?.salesAgentPayments.some(
          (payment) => payment.paymentCycleEndsAt.getTime() === license.expiracion.getTime(),
        ),
      );
      return {
        referralId: referral.salesAgentReferralId,
        salesAgentUserId: referral.salesAgent.userId,
        salesAgentName: referral.salesAgent.name,
        tenantId: referral.referredTenant.tenantId,
        tenantName: referral.referredTenant.nombre,
        tenantLicenseId: license?.tenantLicenseId ?? null,
        planName: license?.plan?.nombre ?? null,
        amountUsd: amount?.toString() ?? null,
        cycleEndsAt: license?.expiracion ?? null,
        paymentStatus: currentCycleConfirmed ? 'confirmed' : license ? 'pending' : 'missing',
      };
    });
  },
);

/**
 * @description Lista referidos, earnings y balance para el Gestor propietario o un admin.
 * @param {SalesAgentDashboardDto} input - Gestor objetivo opcional para administración.
 * @returns {Promise<object>} Snapshot básico para un dashboard futuro.
 */
export const getSalesAgentDashboardAction = withAction(
  async (input: SalesAgentDashboardDto, user) => {
    const parsed = dashboardSchema.parse(input);
    const targetUserId = parsed.salesAgentUserId ?? user.userId;
    const ownsDashboard = user.role === 'salesAgent' && targetUserId === user.userId;
    if (user.role !== 'admin' && !ownsDashboard) {
      throw new ActionError('Acceso restringido', 'FORBIDDEN');
    }

    const [profile, referrals, earnings, balance, payouts, notifications, currentRate] =
      await Promise.all([
      prisma.salesAgentProfile.findUnique({
        where: { userId: targetUserId },
        select: { referralCode: true, status: true },
      }),
      prisma.salesAgentReferral.findMany({
        where: { salesAgentUserId: targetUserId },
        orderBy: { attributedAt: 'desc' },
        select: {
          salesAgentReferralId: true,
          status: true,
          attributedAt: true,
          referredTenant: {
            select: {
              nombre: true,
              licencias: {
                where: { isDemo: false, isAdminTest: false },
                orderBy: { expiracion: 'desc' },
                take: 1,
                select: {
                  activa: true,
                  expiracion: true,
                  finalPriceUsd: true,
                  plan: { select: { nombre: true } },
                },
              },
            },
          },
        },
      }),
      prisma.salesAgentCommissionLedger.findMany({
        where: { salesAgentUserId: targetUserId },
        orderBy: { createdAt: 'desc' },
        select: {
          salesAgentCommissionLedgerId: true,
          salesAgentReferralId: true,
          paymentSource: true,
          paymentSourceId: true,
          amountPaidUsd: true,
          commissionRate: true,
          commissionAmountUsd: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.salesAgentBalance.findUnique({
        where: { userId: targetUserId },
        select: { availableUsd: true, paidUsd: true },
      }),
      prisma.salesAgentPayout.findMany({
        where: { salesAgentUserId: targetUserId },
        orderBy: { processedAt: 'desc' },
        take: 50,
        select: {
          salesAgentPayoutId: true,
          amountUsd: true,
          amountCup: true,
          exchangeRateCupPerUsd: true,
          status: true,
          processedAt: true,
        },
      }),
      prisma.notification.findMany({
        where: { userId: targetUserId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          message: true,
          type: true,
          isRead: true,
          createdAt: true,
          link: true,
        },
      }),
      prisma.tasaCambio.findFirst({
        where: { monedaOrigenId: 'USD', monedaDestino: 'CUP' },
        orderBy: [{ fechaVigencia: 'desc' }, { createdAt: 'desc' }],
        select: { tasa: true, fechaVigencia: true },
      }),
    ]);

    if (!profile?.referralCode || profile.status !== 'active') {
      throw new ActionError('Perfil de Gestor no activo', 'FORBIDDEN');
    }

    const now = new Date();
    const tier = calculateSalesAgentTier(
      referrals.map((referral) => {
        const license = referral.referredTenant.licencias[0];
        return {
          tenantId: referral.salesAgentReferralId,
          referralIsActive: referral.status === 'attributed',
          licenses: license
            ? [{ active: license.activa, expiresAt: license.expiracion }]
            : [],
        };
      }),
      now,
    );
    const normalizedReferrals = referrals.map((referral) => {
      const license = referral.referredTenant.licencias[0] ?? null;
      return {
        salesAgentReferralId: referral.salesAgentReferralId,
        status: referral.status,
        attributedAt: referral.attributedAt,
        tenant: {
          commercialName: referral.referredTenant.nombre,
          plan: license?.plan?.nombre ?? null,
          licenseStatus:
            license?.activa && license.expiracion > now
              ? 'active'
              : license
                ? 'inactive'
                : 'missing',
          licenseExpiration: license?.expiracion ?? null,
          commissionBaseUsd: license?.finalPriceUsd?.toString() ?? null,
        },
      };
    });
    const availableUsd = balance?.availableUsd ?? new Decimal(0);
    const paidUsd = balance?.paidUsd ?? new Decimal(0);

    return {
      salesAgentUserId: targetUserId,
      referralCode: profile.referralCode,
      referralPath: `/register?ref=${encodeURIComponent(profile.referralCode)}`,
      summary: {
        totalReferrals: referrals.length,
        activeReferrals: tier.activeReferredTenants,
        pendingReferrals: referrals.length - tier.activeReferredTenants,
        tier:
          tier.activeReferredTenants === 0
            ? 'none'
            : tier.activeReferredTenants <= 10
              ? 'entry'
              : tier.activeReferredTenants <= 31
                ? 'growth'
                : 'top',
        commissionRate: tier.commissionRate.toString(),
        availableUsd: availableUsd.toFixed(2),
        paidUsd: paidUsd.toFixed(2),
        estimatedAvailableCup: currentRate
          ? availableUsd.mul(currentRate.tasa).toDecimalPlaces(2).toFixed(2)
          : null,
        informationalRate: currentRate
          ? {
              cupPerUsd: currentRate.tasa.toString(),
              effectiveAt: currentRate.fechaVigencia,
            }
          : null,
      },
      referrals: normalizedReferrals,
      commissionHistory: earnings.map((entry) => ({
        ...entry,
        amountPaidUsd: entry.amountPaidUsd.toString(),
        commissionRate: entry.commissionRate.toString(),
        commissionAmountUsd: entry.commissionAmountUsd.toString(),
      })),
      paymentHistory: payouts.map((payout) => ({
        ...payout,
        amountUsd: payout.amountUsd.toString(),
        amountCup: payout.amountCup.toString(),
        exchangeRateCupPerUsd: payout.exchangeRateCupPerUsd.toString(),
      })),
      notifications,
    };
  },
);
