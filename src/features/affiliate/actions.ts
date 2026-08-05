'use server';

import { revalidatePath } from 'next/cache';

import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { ActionError, withAction } from '@/lib/server-actions';

import { AFFILIATE_DEFAULT_CURRENCY, AFFILIATE_TIER_DEFINITIONS } from './constants';
import type {
  AffiliateLedgerRow,
  AffiliateReferralRow,
  AffiliateSummary,
  ReferralPerkGrantRow,
} from './types';
import {
  applyAffiliateCreditsToLicensePreviewSchema,
  assignReferralPerkSchema,
  confirmReferredTenantPaymentSchema,
  registerReferralFromCodeSchema,
  requestCustomReferralPerkSchema,
  reviewCustomReferralPerkSchema,
  type ApplyAffiliateCreditsToLicensePreviewInput,
  type AssignReferralPerkInput,
  type ConfirmReferredTenantPaymentInput,
  type RegisterReferralFromCodeInput,
  type RequestCustomReferralPerkInput,
  type ReviewCustomReferralPerkInput,
} from './schemas';
import { calculateAffiliateCommission, roundCurrency } from './services/commission-service';
import {
  buildAffiliateCreditSnapshot,
  sumAvailableAffiliateCredit,
} from './services/credit-service';
import { isEligibleAffiliateTenant } from './services/eligibility-service';
import {
  assertReferralFeatureKey,
  getReferralPerkCatalog,
} from './services/perk-service';
import { buildAffiliateAdminSummaryRow } from './services/admin-report-service';
import {
  calculateAffiliateTierProgress,
  getGrantedMilestones,
} from './services/tier-service';

function assertTenantUser(user: AuthenticatedUser): string {
  if (!user.tenantId) {
    throw new ActionError('Este usuario no pertenece a un tenant activo', 'TENANT_REQUIRED');
  }

  return user.tenantId;
}

async function getActiveTenantLicense(tenantId: string) {
  return prisma.tenantLicense.findFirst({
    where: {
      tenantId,
      activa: true,
      expiracion: { gt: new Date() },
    },
    include: {
      plan: true,
      tenant: {
        include: {
          memberships: {
            where: { isActive: true },
            include: { user: true },
          },
        },
      },
    },
    orderBy: { inicio: 'desc' },
  });
}

function createReferralCode(tenantId: string): string {
  const suffix = tenantId.slice(-6).toUpperCase();
  const randomChunk = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `REF-${suffix}-${randomChunk}`;
}

async function ensureAffiliateProfile(tenantId: string) {
  const existing = await prisma.affiliateProfile.findUnique({
    where: { tenantId },
  });

  const activeLicense = await getActiveTenantLicense(tenantId);
  const isEligible = isEligibleAffiliateTenant({
    hasActiveMembership: Boolean(activeLicense?.tenant.memberships.length),
    hasActiveLicense: Boolean(activeLicense),
    isDemo: activeLicense?.isDemo === true,
    userIsActive: activeLicense?.tenant.memberships.every((membership) => membership.user.isActive !== false),
  });

  if (existing) {
    return prisma.affiliateProfile.update({
      where: { tenantId },
      data: {
        isEligible,
        status: isEligible ? 'active' : 'inactive',
      },
    });
  }

  const referralCode = createReferralCode(tenantId);

  return prisma.affiliateProfile.create({
    data: {
      tenantId,
      referralCode,
      isEligible,
      status: isEligible ? 'active' : 'inactive',
    },
  });
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber(): number }).toNumber();
  }

  return Number(value ?? 0);
}

async function getAvailableCreditForTenant(tenantId: string): Promise<number> {
  const balance = await prisma.affiliateCreditBalance.findUnique({ where: { tenantId } });

  if (balance) {
    return roundCurrency(toNumber(balance.availableCredit));
  }

  const ledger = await prisma.affiliateCommissionLedger.findMany({
    where: {
      referrerTenantId: tenantId,
      status: 'available',
    },
    select: { commissionAmount: true, status: true },
  });

  return sumAvailableAffiliateCredit(
    ledger.map((row) => ({
      commissionAmount: toNumber(row.commissionAmount),
      status: row.status,
    })),
  );
}

async function getAssignedPerksCount(tenantId: string): Promise<number> {
  return prisma.affiliatePerkGrant.count({
    where: { tenantId, status: 'assigned' },
  });
}

async function buildAffiliateSummaryForTenant(
  tenantId: string,
  origin: string,
): Promise<AffiliateSummary> {
  const [profile, activeLicense, referrals, perkGrants, customRequests, ledgerRows] = await Promise.all([
    ensureAffiliateProfile(tenantId),
    getActiveTenantLicense(tenantId),
    prisma.affiliateReferral.findMany({
      where: { referrerTenantId: tenantId },
      include: {
        referredTenant: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.affiliatePerkGrant.findMany({
      where: { tenantId },
      orderBy: { grantedAt: 'asc' },
    }),
    prisma.referralPerkRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.affiliateCommissionLedger.findMany({
      where: { referrerTenantId: tenantId },
      select: { commissionAmount: true, status: true },
    }),
  ]);

  const confirmedSalesCount = referrals.filter((referral) =>
    referral.status === 'confirmed' || referral.status === 'credited',
  ).length;
  const progress = calculateAffiliateTierProgress(confirmedSalesCount);
  const availableCreditUsd = sumAvailableAffiliateCredit(
    ledgerRows.map((row) => ({
      commissionAmount: toNumber(row.commissionAmount),
      status: row.status,
    })),
  );
  const assignedPerksCount = perkGrants.filter((grant) => grant.status === 'assigned').length;
  const nextLicensePreview = activeLicense?.plan
    ? buildAffiliateCreditSnapshot({
        listPriceUsd: toNumber(activeLicense.plan.precio),
        availableCreditUsd,
      })
    : null;

  return {
    tenantId,
    referralCode: profile.referralCode,
    confirmedSalesCount,
    currentTier: progress.currentTier.id,
    currentRate: progress.currentRate,
    creditAvailableUsd: availableCreditUsd,
    totalPerkSlots: progress.totalPerkSlots,
    assignedPerksCount,
    pendingPerkSlots: Math.max(progress.totalPerkSlots - assignedPerksCount, 0),
    nextLicensePreview,
    referralLink: `${origin.replace(/\/$/, '')}/register?ref=${profile.referralCode}`,
    referredTenants: referrals.map((referral) => ({
      referralId: referral.referralId,
      tenantId: referral.referredTenantId,
      tenantName: referral.referredTenant.nombre,
      status: referral.status as AffiliateSummary['referredTenants'][number]['status'],
      confirmedAt: referral.confirmedAt?.toISOString() ?? null,
    })),
    perkGrants: perkGrants.map((grant) => ({
      perkGrantId: grant.perkGrantId,
      milestone: grant.milestone as ReferralPerkGrantRow['milestone'],
      grantedSlots: grant.grantedSlots,
      status: grant.status as ReferralPerkGrantRow['status'],
      assignedFeatureKey: grant.assignedFeatureKey,
      grantedAt: grant.grantedAt.toISOString(),
      assignedAt: grant.assignedAt?.toISOString() ?? null,
    })),
    customRequests: customRequests.map((request) => ({
      referralPerkRequestId: request.referralPerkRequestId,
      title: request.title,
      status: request.status as AffiliateSummary['customRequests'][number]['status'],
      createdAt: request.createdAt.toISOString(),
    })),
  };
}

export const generateReferralCodeAction = withAction(async (_input: void, user) => {
  const tenantId = assertTenantUser(user);
  const profile = await ensureAffiliateProfile(tenantId);
  return {
    tenantId,
    referralCode: profile.referralCode,
    isEligible: profile.isEligible,
    status: profile.status,
  };
});

export const getAffiliateDashboardAction = withAction(async (_input: void, user) => {
  const tenantId = assertTenantUser(user);
  return buildAffiliateSummaryForTenant(tenantId, process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
});

export const registerReferralFromCodeAction = withAction(
  async (input: RegisterReferralFromCodeInput, user) => {
    const tenantId = assertTenantUser(user);
    const parsed = registerReferralFromCodeSchema.parse(input);

    const [profile, salesAgentProfile] = await Promise.all([
      prisma.affiliateProfile.findUnique({
        where: { referralCode: parsed.referralCode },
      }),
      prisma.salesAgentProfile.findUnique({
        where: { referralCode: parsed.referralCode },
        select: { status: true },
      }),
    ]);

    if (!profile || profile.isEligible !== true) {
      throw new ActionError('Código de referido inválido o inactivo', 'REFERRAL_CODE_INVALID');
    }
    if (salesAgentProfile?.status === 'active') {
      throw new ActionError(
        'El código de referido no puede atribuirse',
        'REFERRAL_CODE_COLLISION',
      );
    }

    if (profile.tenantId === tenantId) {
      throw new ActionError('Un tenant no puede referirse a sí mismo', 'SELF_REFERRAL_NOT_ALLOWED');
    }

    const activeLicense = await getActiveTenantLicense(tenantId);
    // Las tablas legacy no permiten un UNIQUE cross-table. Estas lecturas y la
    // escritura comparten transacción, pero PostgreSQL no bloquea una inserción
    // concurrente en la otra tabla; una atribución unificada eliminaría ese riesgo residual.
    const referral = await prisma.$transaction(async (tx) => {
      const [existingAffiliate, existingSalesAgent] = await Promise.all([
        tx.affiliateReferral.findUnique({ where: { referredTenantId: tenantId } }),
        tx.salesAgentReferral.findUnique({ where: { referredTenantId: tenantId } }),
      ]);
      if (existingAffiliate || existingSalesAgent) {
        throw new ActionError(
          'Este tenant ya fue atribuido a un referidor',
          'REFERRAL_ALREADY_LINKED',
        );
      }
      return tx.affiliateReferral.create({
        data: {
          referrerTenantId: profile.tenantId,
          referredTenantId: tenantId,
          referredPlanId: activeLicense?.planId ?? null,
          status: 'registered',
        },
      });
    });

    revalidatePath('/busy/referidos');
    revalidatePath('/admin/referidos');

    return referral;
  },
);

export const confirmReferredTenantPaymentAction = withAction(
  async (input: ConfirmReferredTenantPaymentInput, user) => {
    if (user.role !== 'admin') {
      throw new ActionError('Acceso restringido', 'FORBIDDEN');
    }

    const parsed = confirmReferredTenantPaymentSchema.parse(input);

    const result = await prisma.$transaction(async (tx) => {
      const referral = await tx.affiliateReferral.findFirst({
        where: parsed.referralId
          ? { referralId: parsed.referralId }
          : { referredTenantId: parsed.referredTenantId },
        include: {
          referredTenant: true,
          referrerTenant: true,
        },
      });

      if (!referral) {
        throw new ActionError('Referencia no encontrada', 'REFERRAL_NOT_FOUND');
      }

      const sourceLicense = await tx.tenantLicense.findUnique({
        where: { tenantLicenseId: parsed.sourceTenantLicenseId },
        include: { plan: true },
      });

      if (!sourceLicense || sourceLicense.tenantId !== referral.referredTenantId) {
        throw new ActionError('La licencia indicada no pertenece al referido', 'LICENSE_MISMATCH');
      }

      if (sourceLicense.isDemo) {
        throw new ActionError('Las demos no generan comisión por referido', 'DEMO_NOT_ELIGIBLE');
      }

      if (!sourceLicense.activa || sourceLicense.expiracion.getTime() <= Date.now()) {
        throw new ActionError('La licencia del referido no está vigente', 'LICENSE_NOT_CURRENT');
      }

      const claim = await tx.affiliateReferral.updateMany({
        where: {
          referralId: referral.referralId,
          status: { notIn: ['confirmed', 'credited'] },
        },
        data: {
          status: 'credited',
          firstConfirmedLicenseId: sourceLicense.tenantLicenseId,
          confirmedAt: new Date(),
        },
      });
      if (claim.count !== 1) {
        throw new ActionError(
          'El pago de este referido ya fue acreditado',
          'REFERRAL_ALREADY_CONFIRMED',
        );
      }

      const alreadyCreditedLicense = await tx.affiliateCommissionLedger.findFirst({
        where: { sourceTenantLicenseId: parsed.sourceTenantLicenseId },
        select: { ledgerId: true },
      });
      if (alreadyCreditedLicense) {
        throw new ActionError('Esta licencia ya generó una comisión', 'LICENSE_ALREADY_CREDITED');
      }

      const previousConfirmedCount = await tx.affiliateReferral.count({
        where: {
          referrerTenantId: referral.referrerTenantId,
          status: { in: ['confirmed', 'credited'] },
        },
      });
      const nextConfirmedCount = previousConfirmedCount + 1;
      const commission = calculateAffiliateCommission({
        confirmedSalesCountAfterConfirmation: nextConfirmedCount,
        basePlanPriceUsd: toNumber(sourceLicense.plan?.precio ?? 0),
      });

      const previousMilestones = new Set(getGrantedMilestones(previousConfirmedCount));
      const nextMilestones = getGrantedMilestones(nextConfirmedCount);
      const newMilestones = nextMilestones.filter(
        (milestone) => !previousMilestones.has(milestone),
      );

      const grantDescriptors = newMilestones.flatMap((milestone) => {
        const tier = AFFILIATE_TIER_DEFINITIONS.find(
          (definition) => definition.id === milestone,
        );
        const grantedSlots = tier?.perkSlotsGranted ?? 1;

        return Array.from({ length: grantedSlots }, (_unused, index) => ({
          milestone,
          slotIndex: index + 1,
          grantedSlots,
        }));
      });

      const ledgerEntry = await tx.affiliateCommissionLedger.create({
        data: {
          referrerTenantId: referral.referrerTenantId,
          referralId: referral.referralId,
          sourceTenantLicenseId: sourceLicense.tenantLicenseId,
          basePlanPrice: toNumber(sourceLicense.plan?.precio ?? 0),
          commissionRate: commission.commissionRate,
          commissionAmount: commission.commissionAmount,
          currency: AFFILIATE_DEFAULT_CURRENCY,
          status: 'available',
        },
      });

      const balance = await tx.affiliateCreditBalance.upsert({
        where: { tenantId: referral.referrerTenantId },
        create: {
          tenantId: referral.referrerTenantId,
          availableCredit: commission.commissionAmount,
          appliedCredit: 0,
          carryOverCredit: commission.commissionAmount,
        },
        update: {
          availableCredit: { increment: commission.commissionAmount },
          carryOverCredit: { increment: commission.commissionAmount },
        },
      });

      const grantRecords = [];
      for (const descriptor of grantDescriptors) {
        const record = await tx.affiliatePerkGrant.upsert({
          where: {
            tenantId_milestone_slotIndex: {
              tenantId: referral.referrerTenantId,
              milestone: descriptor.milestone,
              slotIndex: descriptor.slotIndex,
            },
          },
          create: {
            tenantId: referral.referrerTenantId,
            milestone: descriptor.milestone,
            slotIndex: descriptor.slotIndex,
            grantedSlots: descriptor.grantedSlots,
            status: 'pending_manual_assignment',
          },
          update: {},
        });
        grantRecords.push(record);
      }

      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'AFFILIATE_COMMISSION',
        entidadId: ledgerEntry.ledgerId,
        usuarioId: user.userId,
        detalles: {
          referralId: referral.referralId,
          referrerTenantId: referral.referrerTenantId,
          referredTenantId: referral.referredTenantId,
          sourceTenantLicenseId: sourceLicense.tenantLicenseId,
          commissionRate: commission.commissionRate,
          commissionAmount: commission.commissionAmount,
        },
      }, tx);

      return {
        updatedReferral: {
          ...referral,
          status: 'credited',
          firstConfirmedLicenseId: sourceLicense.tenantLicenseId,
        },
        ledgerEntry,
        balance,
        grants: grantRecords.map((grant, index) => ({
          perkGrantId: grant.perkGrantId,
          milestone: grantDescriptors[index]?.milestone ?? '',
          slotIndex: grantDescriptors[index]?.slotIndex ?? index + 1,
        })),
      };
    });

    revalidatePath('/admin/referidos');
    revalidatePath('/admin/licencias');
    revalidatePath('/admin/subscriptions');

    return result;
  },
);

export const getAffiliateAdminLedgerAction = withAction(async (_input: void, user) => {
  if (user.role !== 'admin') {
    throw new ActionError('Acceso restringido', 'FORBIDDEN');
  }

  const [referrals, ledger] = await Promise.all([
    prisma.affiliateReferral.findMany({
      include: {
        referrerTenant: true,
        referredTenant: true,
        referredPlan: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.affiliateCommissionLedger.findMany({
      include: {
        referrerTenant: true,
        referral: {
          include: {
            referredTenant: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const referredTenantIds = referrals.map((referral) => referral.referredTenantId);
  const currentLicenses = await prisma.tenantLicense.findMany({
    where: {
      tenantId: { in: referredTenantIds },
      activa: true,
      expiracion: { gt: new Date() },
    },
    orderBy: [{ inicio: 'desc' }, { createdAt: 'desc' }],
    select: { tenantId: true, tenantLicenseId: true },
  });
  const licenseIdByTenant = new Map<string, string>();
  for (const license of currentLicenses) {
    if (!licenseIdByTenant.has(license.tenantId)) {
      licenseIdByTenant.set(license.tenantId, license.tenantLicenseId);
    }
  }

  return {
    referrals: referrals.map<AffiliateReferralRow>((referral) => ({
      referralId: referral.referralId,
      referrerTenantId: referral.referrerTenantId,
      referrerTenantName: referral.referrerTenant.nombre,
      referredTenantId: referral.referredTenantId,
      referredTenantName: referral.referredTenant.nombre,
      referredPlanName: referral.referredPlan?.nombre ?? null,
      referredCurrentLicenseId: licenseIdByTenant.get(referral.referredTenantId) ?? null,
      status: referral.status as AffiliateReferralRow['status'],
      confirmedAt: referral.confirmedAt?.toISOString() ?? null,
    })),
    ledger: ledger.map<AffiliateLedgerRow>((entry) => ({
      ledgerId: entry.ledgerId,
      referrerTenantId: entry.referrerTenantId,
      referrerTenantName: entry.referrerTenant.nombre,
      referredTenantId: entry.referral.referredTenantId,
      referredTenantName: entry.referral.referredTenant.nombre,
      commissionRate: toNumber(entry.commissionRate),
      commissionAmount: toNumber(entry.commissionAmount),
      currency: entry.currency,
      status: entry.status as AffiliateLedgerRow['status'],
      createdAt: entry.createdAt.toISOString(),
    })),
  };
});

export const getAffiliateAdminSummaryAction = withAction(async (_input: void, user) => {
  if (user.role !== 'admin') {
    throw new ActionError('Acceso restringido', 'FORBIDDEN');
  }

  const profiles = await prisma.affiliateProfile.findMany({
    include: {
      tenant: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const tenantIds = profiles.map((profile) => profile.tenantId);
  if (tenantIds.length === 0) {
    return [];
  }

  const now = new Date();
  const [referrals, activeLicenses, balances, grants, ledgerRows] = await Promise.all([
    prisma.affiliateReferral.findMany({
      where: { referrerTenantId: { in: tenantIds } },
      select: { referrerTenantId: true, status: true },
    }),
    prisma.tenantLicense.findMany({
      where: {
        tenantId: { in: tenantIds },
        activa: true,
        expiracion: { gt: now },
      },
      include: { plan: true },
      orderBy: [{ inicio: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.affiliateCreditBalance.findMany({
      where: { tenantId: { in: tenantIds } },
    }),
    prisma.affiliatePerkGrant.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { perkGrantId: true, tenantId: true, status: true },
    }),
    prisma.affiliateCommissionLedger.findMany({
      where: { referrerTenantId: { in: tenantIds }, status: 'available' },
      select: { referrerTenantId: true, commissionAmount: true },
    }),
  ]);

  const licenseByTenant = new Map<string, (typeof activeLicenses)[number]>();
  for (const license of activeLicenses) {
    if (!licenseByTenant.has(license.tenantId)) {
      licenseByTenant.set(license.tenantId, license);
    }
  }

  const balanceByTenant = new Map(
    balances.map((balance) => [balance.tenantId, balance]),
  );

  const grantsByTenant = new Map<string, (typeof grants)[number][]>();
  for (const grant of grants) {
    const list = grantsByTenant.get(grant.tenantId) ?? [];
    list.push(grant);
    grantsByTenant.set(grant.tenantId, list);
  }

  const ledgerByTenant = new Map<string, number>();
  for (const row of ledgerRows) {
    ledgerByTenant.set(
      row.referrerTenantId,
      (ledgerByTenant.get(row.referrerTenantId) ?? 0) + toNumber(row.commissionAmount),
    );
  }

  const referralsByTenant = new Map<string, (typeof referrals)[number][]>();
  for (const referral of referrals) {
    const list = referralsByTenant.get(referral.referrerTenantId) ?? [];
    list.push(referral);
    referralsByTenant.set(referral.referrerTenantId, list);
  }

  return profiles.map((profile) => {
    const tenantReferrals = referralsByTenant.get(profile.tenantId) ?? [];
    const confirmedSalesCount = tenantReferrals.filter(
      (referral) => referral.status === 'confirmed' || referral.status === 'credited',
    ).length;
    const activeLicense = licenseByTenant.get(profile.tenantId) ?? null;
    const balance = balanceByTenant.get(profile.tenantId) ?? null;
    const tenantGrants = grantsByTenant.get(profile.tenantId) ?? [];

    const availableCreditUsd = balance
      ? roundCurrency(toNumber(balance.availableCredit))
      : roundCurrency(ledgerByTenant.get(profile.tenantId) ?? 0);
    const assignedPerksCount = tenantGrants.filter((grant) => grant.status === 'assigned').length;
    const totalPerkSlots = calculateAffiliateTierProgress(confirmedSalesCount).totalPerkSlots;
    const nextPendingPerkGrantId =
      tenantGrants.find((grant) => grant.status === 'pending_manual_assignment')?.perkGrantId ??
      null;

    return buildAffiliateAdminSummaryRow({
      tenantId: profile.tenantId,
      tenantName: profile.tenant.nombre,
      referralCode: profile.referralCode,
      referredTenantsCount: tenantReferrals.length,
      confirmedSalesCount,
      lastAppliedCreditUsd: balance ? roundCurrency(toNumber(balance.appliedCredit)) : 0,
      planName: activeLicense?.plan?.nombre ?? null,
      currentLicenseId: activeLicense?.tenantLicenseId ?? null,
      listPriceUsd: toNumber(activeLicense?.plan?.precio ?? 0),
      availableLedgerRows: [{ commissionAmount: availableCreditUsd, status: 'available' }],
      pendingPerkSlots: Math.max(totalPerkSlots - assignedPerksCount, 0),
      assignedPerksCount,
      nextPendingPerkGrantId,
    });
  });
});

export const applyAffiliateCreditsToLicensePreviewAction = withAction(
  async (input: ApplyAffiliateCreditsToLicensePreviewInput, user) => {
    const parsed = applyAffiliateCreditsToLicensePreviewSchema.parse(input);
    const tenantLicense = await prisma.tenantLicense.findUnique({
      where: { tenantLicenseId: parsed.tenantLicenseId },
      include: { plan: true },
    });

    if (!tenantLicense) {
      throw new ActionError('Licencia no encontrada', 'LICENSE_NOT_FOUND');
    }

    if (user.role !== 'admin' && user.tenantId !== tenantLicense.tenantId) {
      throw new ActionError('Acceso restringido', 'FORBIDDEN');
    }

    const availableCreditUsd = await getAvailableCreditForTenant(tenantLicense.tenantId);
    const snapshot = buildAffiliateCreditSnapshot({
      listPriceUsd: toNumber(tenantLicense.plan?.precio ?? 0),
      availableCreditUsd,
    });

    const updated = await prisma.tenantLicense.update({
      where: { tenantLicenseId: tenantLicense.tenantLicenseId },
      data: {
        listPriceUsd: snapshot.listPriceUsd,
        creditAppliedUsd: snapshot.creditAppliedUsd,
        finalPriceUsd: snapshot.finalPriceUsd,
        creditSnapshotUsd: snapshot.creditSnapshotUsd,
      },
    });

    await AuditLogService.logStrict({
      accion: 'UPDATE',
      entidad: 'TENANT_LICENSE',
      entidadId: updated.tenantLicenseId,
      usuarioId: user.userId,
      detalles: {
        tenantId: updated.tenantId,
        listPriceUsd: snapshot.listPriceUsd,
        creditAppliedUsd: snapshot.creditAppliedUsd,
        finalPriceUsd: snapshot.finalPriceUsd,
        creditSnapshotUsd: snapshot.creditSnapshotUsd,
      },
    });

    revalidatePath('/admin/referidos');
    revalidatePath('/admin/licencias');
    revalidatePath('/busy/referidos');

    return {
      tenantLicenseId: updated.tenantLicenseId,
      ...snapshot,
    };
  },
);

export const assignReferralPerkAction = withAction(
  async (input: AssignReferralPerkInput, user) => {
    if (user.role !== 'admin') {
      throw new ActionError('Acceso restringido', 'FORBIDDEN');
    }

    const parsed = assignReferralPerkSchema.parse(input);
    const featureKey = assertReferralFeatureKey(parsed.featureKey);

    const [grant, tenantLicense] = await Promise.all([
      prisma.affiliatePerkGrant.findUnique({
        where: { perkGrantId: parsed.perkGrantId },
      }),
      prisma.tenantLicense.findUnique({
        where: { tenantLicenseId: parsed.tenantLicenseId },
      }),
    ]);

    if (!grant) {
      throw new ActionError('Grant no encontrado', 'PERK_GRANT_NOT_FOUND');
    }
    if (!tenantLicense || tenantLicense.tenantId !== grant.tenantId) {
      throw new ActionError('La licencia no coincide con el tenant del perk', 'LICENSE_MISMATCH');
    }
    if (grant.status === 'assigned') {
      throw new ActionError('Este perk ya fue asignado', 'PERK_ALREADY_ASSIGNED');
    }

    const currentOverrides =
      tenantLicense.featureOverrides && typeof tenantLicense.featureOverrides === 'object'
        ? (tenantLicense.featureOverrides as Record<string, boolean>)
        : {};

    const updated = await prisma.$transaction(async (tx) => {
      const nextOverrides = {
        ...currentOverrides,
        [featureKey]: true,
      };

      const updatedLicense = await tx.tenantLicense.update({
        where: { tenantLicenseId: tenantLicense.tenantLicenseId },
        data: {
          featureOverrides: nextOverrides,
        },
      });

      const updatedGrant = await tx.affiliatePerkGrant.update({
        where: { perkGrantId: grant.perkGrantId },
        data: {
          status: 'assigned',
          assignedFeatureKey: featureKey,
          assignedAt: new Date(),
          assignedBy: user.userId,
        },
      });

      return { updatedLicense, updatedGrant };
    });

    revalidatePath('/admin/referidos');
    revalidatePath('/busy/referidos');

    return updated;
  },
);

export const requestCustomReferralPerkAction = withAction(
  async (input: RequestCustomReferralPerkInput, user) => {
    const tenantId = assertTenantUser(user);
    const parsed = requestCustomReferralPerkSchema.parse(input);

    const request = await prisma.referralPerkRequest.create({
      data: {
        tenantId,
        title: parsed.title,
        description: parsed.description,
        status: 'pending',
      },
    });

    revalidatePath('/busy/referidos');
    revalidatePath('/admin/referidos');

    return request;
  },
);

export const reviewCustomReferralPerkAction = withAction(
  async (input: ReviewCustomReferralPerkInput, user) => {
    if (user.role !== 'admin') {
      throw new ActionError('Acceso restringido', 'FORBIDDEN');
    }

    const parsed = reviewCustomReferralPerkSchema.parse(input);
    const request = await prisma.referralPerkRequest.update({
      where: { referralPerkRequestId: parsed.referralPerkRequestId },
      data: {
        status: parsed.status,
        adminNotes: parsed.adminNotes ?? null,
        reviewedAt: new Date(),
        reviewedBy: user.userId,
      },
    });

    revalidatePath('/busy/referidos');
    revalidatePath('/admin/referidos');

    return request;
  },
);

export const getReferralPerkCatalogAction = withAction(async (_input: void, user) => {
  assertTenantUser(user);
  const persistedCatalog = await prisma.referralPerkCatalog.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (persistedCatalog.length > 0) {
    return persistedCatalog.map((item) => ({
      key: item.key,
      label: item.label,
      description: item.description,
      isActive: item.isActive,
      adminOnly: item.adminOnly,
    }));
  }

  return getReferralPerkCatalog();
});
