import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';

import { calculateRecurringCommission } from './commission-service';
import { getSalesAgentCommissionRate } from './tier-service';
import {
  createSalesAgentEvent,
  deliverSalesAgentEmails,
} from './notification-service';

const PAYMENT_SOURCE = 'tenant_license_payment';

export interface ConfirmSalesAgentTenantPaymentInput {
  tenantId: string;
  tenantLicenseId: string;
  idempotencyKey: string;
  amountPaidUsd?: Prisma.Decimal.Value;
  confirmedByAdminId: string;
}

export interface ConfirmSalesAgentTenantPaymentResult {
  credited: boolean;
  duplicate: boolean;
  ledgerId: string;
}

/**
 * @description Confirma el pago autoritativo y acredita la comisión en una transacción.
 * @param {ConfirmSalesAgentTenantPaymentInput} input - Identidad inmutable del pago.
 * @returns {Promise<ConfirmSalesAgentTenantPaymentResult>} Crédito o replay idempotente.
 */
export async function confirmSalesAgentTenantPayment(
  input: ConfirmSalesAgentTenantPaymentInput,
): Promise<ConfirmSalesAgentTenantPaymentResult> {
  const claimedAmount = input.amountPaidUsd === undefined
    ? undefined
    : new Prisma.Decimal(input.amountPaidUsd).toDecimalPlaces(2);

  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
      const referral = await tx.salesAgentReferral.findUnique({
        where: { referredTenantId: input.tenantId },
        select: {
          salesAgentReferralId: true,
          salesAgentUserId: true,
          status: true,
          salesAgent: {
            select: {
              isActive: true,
              role: true,
              salesAgentProfile: { select: { status: true } },
            },
          },
        },
      });
      if (!referral || referral.status !== 'attributed') {
        throw new ActionError('Referencia de Gestor no encontrada', 'REFERRAL_NOT_FOUND');
      }
      if (
        !referral.salesAgent.isActive ||
        referral.salesAgent.role !== 'salesAgent' ||
        referral.salesAgent.salesAgentProfile?.status !== 'active'
      ) {
        throw new ActionError('El Gestor no está activo', 'SALES_AGENT_NOT_ACTIVE');
      }

      const [license, activeMembership] = await Promise.all([
        tx.tenantLicense.findFirst({
          where: {
            tenantId: input.tenantId,
            activa: true,
            isDemo: false,
            isAdminTest: false,
            expiracion: { gt: new Date() },
          },
          include: { plan: { select: { precio: true } } },
          orderBy: [{ inicio: 'desc' }, { createdAt: 'desc' }],
        }),
        tx.tenantMembership.findFirst({
          where: { tenantId: input.tenantId, isActive: true, user: { isActive: true } },
          select: { membershipId: true },
        }),
      ]);
      if (!activeMembership) {
        throw new ActionError('El tenant referido no está activo', 'TENANT_NOT_ACTIVE');
      }
      if (!license || license.tenantLicenseId !== input.tenantLicenseId) {
        throw new ActionError('La licencia seleccionada no es la vigente', 'LICENSE_NOT_CURRENT');
      }

      const expectedAmount = new Prisma.Decimal(
        license.finalPriceUsd ?? license.listPriceUsd ?? license.plan?.precio ?? 0,
      ).toDecimalPlaces(2);
      if (!expectedAmount.gt(0)) {
        throw new ActionError('La licencia no tiene un monto cobrable válido', 'LICENSE_AMOUNT_INVALID');
      }
      const paidAmount = claimedAmount ?? expectedAmount;
      if (!paidAmount.equals(expectedAmount)) {
        throw new ActionError('El monto pagado no coincide con el monto exigible', 'PAYMENT_AMOUNT_MISMATCH');
      }
      const paymentCycleEndsAt = license.expiracion;
      const fingerprint = buildFingerprint(input, paymentCycleEndsAt, paidAmount.toFixed(2));
      const existingByKey = await tx.tenantLicensePayment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: {
          immutableFingerprint: true,
          commissionLedger: { select: { salesAgentCommissionLedgerId: true } },
        },
      });
      if (existingByKey) {
        return resolveDuplicate(existingByKey, fingerprint, true);
      }
      const existingCycle = await tx.tenantLicensePayment.findUnique({
        where: {
          tenantLicenseId_paymentCycleEndsAt: {
            tenantLicenseId: license.tenantLicenseId,
            paymentCycleEndsAt,
          },
        },
        select: {
          immutableFingerprint: true,
          commissionLedger: { select: { salesAgentCommissionLedgerId: true } },
        },
      });
      if (existingCycle) {
        return resolveDuplicate(existingCycle, fingerprint, false);
      }

      const activeReferredTenants = await tx.salesAgentReferral.count({
        where: {
          salesAgentUserId: referral.salesAgentUserId,
          status: 'attributed',
          referredTenant: {
            memberships: { some: { isActive: true, user: { isActive: true } } },
            licencias: {
              some: {
                activa: true,
                expiracion: { gt: new Date() },
                isDemo: false,
                isAdminTest: false,
              },
            },
          },
        },
      });
      const commission = calculateRecurringCommission({
        amountPaidUsd: paidAmount,
        commissionRate: getSalesAgentCommissionRate(activeReferredTenants),
      });
      const previousCommission = await tx.salesAgentCommissionLedger.findFirst({
        where: { salesAgentUserId: referral.salesAgentUserId },
        orderBy: { createdAt: 'desc' },
        select: { commissionRate: true },
      });
      const priorConfirmedPayments = await tx.tenantLicensePayment.count({
        where: {
          tenantLicenseId: license.tenantLicenseId,
          status: 'confirmed',
        },
      });
      const paymentKind = priorConfirmedPayments === 0 ? 'initial' : 'renewal';
      const payment = await tx.tenantLicensePayment.create({
        data: {
          tenantId: input.tenantId,
          tenantLicenseId: license.tenantLicenseId,
          paymentKind,
          expectedAmountUsd: expectedAmount,
          amountPaidUsd: paidAmount,
          idempotencyKey: input.idempotencyKey,
          immutableFingerprint: fingerprint,
          paymentCycleEndsAt,
          licenseExpirationSnapshot: license.expiracion,
          confirmedByAdminId: input.confirmedByAdminId,
          status: 'confirmed',
        },
      });
      const ledger = await tx.salesAgentCommissionLedger.create({
        data: {
          salesAgentUserId: referral.salesAgentUserId,
          salesAgentReferralId: referral.salesAgentReferralId,
          sourceTenantLicenseId: license.tenantLicenseId,
          paymentSource: PAYMENT_SOURCE,
          paymentSourceId: payment.tenantLicensePaymentId,
          idempotencyKey: input.idempotencyKey,
          amountPaidUsd: paidAmount,
          commissionRate: commission.commissionRate,
          commissionAmountUsd: commission.commissionAmountUsd,
        },
      });
      await tx.salesAgentBalance.upsert({
        where: { userId: referral.salesAgentUserId },
        create: { userId: referral.salesAgentUserId, availableUsd: commission.commissionAmountUsd },
        update: { availableUsd: { increment: commission.commissionAmountUsd } },
      });
      await AuditLogService.logStrict(
        {
          accion: 'CREATE',
          entidad: 'TENANT_LICENSE_PAYMENT',
          entidadId: payment.tenantLicensePaymentId,
          usuarioId: input.confirmedByAdminId,
          detalles: {
            tenantId: input.tenantId,
            tenantLicenseId: license.tenantLicenseId,
            paymentId: payment.tenantLicensePaymentId,
            amountPaidUsd: paidAmount.toFixed(2),
            paymentCycleEndsAt: paymentCycleEndsAt.toISOString(),
            idempotencyKey: input.idempotencyKey,
          },
        },
        tx,
      );
      const deliveryIds = [
        await createSalesAgentEvent({
          tx,
          userId: referral.salesAgentUserId,
          eventType: 'commission_generated',
          title: 'Nueva comisión disponible',
          message: `Generaste una comisión de USD ${commission.commissionAmountUsd.toFixed(2)}.`,
          emailPayload: {
            amountUsd: commission.commissionAmountUsd.toFixed(2),
            rate: commission.commissionRate.toString(),
          },
        }),
      ];
      const previousRate = previousCommission?.commissionRate ?? new Prisma.Decimal(0);
      if (!previousRate.equals(commission.commissionRate)) {
        const previousPercent = previousRate.mul(100).toString();
        const currentPercent = commission.commissionRate.mul(100).toString();
        deliveryIds.push(await createSalesAgentEvent({
          tx,
          userId: referral.salesAgentUserId,
          eventType: 'tier_changed',
          title: 'Cambió tu nivel de comisión',
          message: `Tu tasa cambió de ${previousPercent}% a ${currentPercent}%.`,
          emailPayload: {
            previousRate: previousRate.toString(),
            rate: commission.commissionRate.toString(),
          },
        }));
      }
      return {
        result: {
          credited: true,
          duplicate: false,
          ledgerId: ledger.salesAgentCommissionLedgerId,
        },
        deliveryIds,
      };
    }, {
      maxWait: 15_000,
      timeout: 30_000,
    });
    if ('result' in transactionResult) {
      await deliverSalesAgentEmails(transactionResult.deliveryIds);
      return transactionResult.result;
    }
    return transactionResult;
  } catch (error) {
    if (!isUniqueCollision(error)) throw error;
    return resolvePaymentCollision(input, claimedAmount);
  }
}

/**
 * @description Construye la huella inmutable del evento idempotente.
 * @param {ConfirmSalesAgentTenantPaymentInput} input - Identidad del evento.
 * @param {string} amount - Monto normalizado o marcador server.
 * @returns {string} Huella persistible.
 */
function buildFingerprint(
  input: ConfirmSalesAgentTenantPaymentInput,
  paymentCycleEndsAt: Date,
  amount: string,
): string {
  return [
    input.tenantId,
    input.tenantLicenseId,
    paymentCycleEndsAt.toISOString(),
    amount,
  ].join('|');
}

type ExistingPayment = {
  immutableFingerprint: string;
  commissionLedger: { salesAgentCommissionLedgerId: string } | null;
};

/**
 * @description Valida una repetición contra la huella canónica exacta.
 * @param {ExistingPayment} existing - Pago ganador persistido.
 * @param {string} fingerprint - Huella derivada del estado vigente.
 * @param {boolean} sameIdempotencyKey - Indica repetición de la misma clave.
 * @returns {ConfirmSalesAgentTenantPaymentResult} Duplicado sin nuevo crédito.
 */
function resolveDuplicate(
  existing: ExistingPayment,
  fingerprint: string,
  sameIdempotencyKey: boolean,
): ConfirmSalesAgentTenantPaymentResult {
  if (existing.immutableFingerprint !== fingerprint) {
    const code = sameIdempotencyKey ? 'IDEMPOTENCY_CONFLICT' : 'PAYMENT_ALREADY_CONFIRMED';
    throw new ActionError('El pago no coincide con el evento confirmado', code);
  }
  if (!existing.commissionLedger) {
    throw new ActionError('El pago confirmado no tiene comisión asociada', 'PAYMENT_INCOMPLETE');
  }
  return {
    credited: false,
    duplicate: true,
    ledgerId: existing.commissionLedger.salesAgentCommissionLedgerId,
  };
}

/**
 * @description Relee el estado canónico después de una carrera de unicidad.
 * @param {ConfirmSalesAgentTenantPaymentInput} input - Solicitud original.
 * @param {Prisma.Decimal | undefined} claimedAmount - Monto opcional normalizado.
 * @returns {Promise<ConfirmSalesAgentTenantPaymentResult>} Ganador idempotente.
 */
async function resolvePaymentCollision(
  input: ConfirmSalesAgentTenantPaymentInput,
  claimedAmount: Prisma.Decimal | undefined,
): Promise<ConfirmSalesAgentTenantPaymentResult> {
  return prisma.$transaction(async (tx) => {
    const license = await tx.tenantLicense.findFirst({
      where: {
        tenantId: input.tenantId,
        activa: true,
        isDemo: false,
        isAdminTest: false,
        expiracion: { gt: new Date() },
      },
      include: { plan: { select: { precio: true } } },
      orderBy: [{ inicio: 'desc' }, { createdAt: 'desc' }],
    });
    if (!license || license.tenantLicenseId !== input.tenantLicenseId) {
      throw new ActionError('La licencia seleccionada no es la vigente', 'LICENSE_NOT_CURRENT');
    }
    const expectedAmount = new Prisma.Decimal(
      license.finalPriceUsd ?? license.listPriceUsd ?? license.plan?.precio ?? 0,
    ).toDecimalPlaces(2);
    const paidAmount = claimedAmount ?? expectedAmount;
    if (!paidAmount.equals(expectedAmount)) {
      throw new ActionError('El monto pagado no coincide con el monto exigible', 'PAYMENT_AMOUNT_MISMATCH');
    }
    const fingerprint = buildFingerprint(input, license.expiracion, paidAmount.toFixed(2));
    const winnerByKey = await tx.tenantLicensePayment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: {
        immutableFingerprint: true,
        commissionLedger: { select: { salesAgentCommissionLedgerId: true } },
      },
    });
    if (winnerByKey) return resolveDuplicate(winnerByKey, fingerprint, true);
    const winnerByCycle = await tx.tenantLicensePayment.findUnique({
      where: {
        tenantLicenseId_paymentCycleEndsAt: {
          tenantLicenseId: license.tenantLicenseId,
          paymentCycleEndsAt: license.expiracion,
        },
      },
      select: {
        immutableFingerprint: true,
        commissionLedger: { select: { salesAgentCommissionLedgerId: true } },
      },
    });
    if (!winnerByCycle) {
      throw new ActionError('No se pudo resolver la confirmación concurrente', 'PAYMENT_CONFLICT');
    }
    return resolveDuplicate(winnerByCycle, fingerprint, false);
  });
}

/**
 * @description Detecta una colisión única Prisma.
 * @param {unknown} error - Error de persistencia.
 * @returns {boolean} True para P2002.
 */
function isUniqueCollision(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error &&
    (error as { code?: string }).code === 'P2002');
}
