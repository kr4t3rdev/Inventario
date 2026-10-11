import { Prisma } from '@/generated/prisma';
import { prismaPlatform as prisma } from '@/lib/db/platform-prisma';
import { ActionError } from '@/lib/server-actions';
import { addDays } from '@/lib/date-utils';
import { resolveLicenseDurationDays } from '@/lib/services/license-duration';
import { resolveLicensePricing } from '@/lib/services/plan-pricing';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { confirmSalesAgentTenantPaymentInTx } from '@/features/sales-agent/services/payment-service';
import { deliverSalesAgentEmails } from '@/features/sales-agent/services/notification-service';
import {
  hashRenewalKey,
  fingerprintRenewalPayload,
  isRenewalReceiptUniqueViolation,
  snapshotRenewalOutcome,
  reviveRenewalOutcome,
  type RenewalPayloadFingerprintInput,
} from './renew-licencia-idempotency';

/**
 * @description Entrada canónica del servicio de renovación de licencias,
 * compartido por la acción web del panel admin y el adaptador mobile.
 */
export interface RenewLicenciaServiceInput {
  tenantLicenseId: string;
  /** Plan destino (web lo exige; mobile puede omitirlo y usa el plan actual). */
  planId?: string;
  /** Override de duración en días (solo mobile, máx. 3650). */
  durationDaysOverride?: number;
  /** Registra pago presencial (solo web). */
  registerPayment?: boolean;
  amountPaidUsd?: number;
  /**
   * Clave de idempotencia de la operación completa. Si está presente, la
   * renovación queda protegida por un recibo persistido: los replays
   * devuelven el outcome original sin extender la vigencia.
   */
  idempotencyKey?: string;
  /** Web exige membresías activas (TENANT_NOT_ACTIVE); mobile preserva su contrato legado. */
  requireActiveMembership: boolean;
  via: 'web-admin' | 'mobile-admin';
  actingAdminId: string;
}

/**
 * @description Resultado comprometido de una renovación. Idéntico al contrato
 * previo de renewLicenciaAction para no romper consumidores existentes.
 */
export interface RenewLicenciaOutcome {
  tenantLicenseId: string;
  newExpiracion: Date;
  newPlanId: string;
  previousExpiracion: Date;
  previousPlanId: string | null;
  registeredPaymentId: string | null;
  duplicate: boolean;
  commissionCredited: boolean;
}

/**
 * @description Renueva la vigencia de una TenantLicense en una transacción
 * única e idempotente. La renovación extiende desde la expiración actual (o
 * desde now si está vencida), reactiva licencias inactivas, sincroniza los
 * límites del plan y el `expiresAt` de los usuarios del tenant, detecta la
 * atribución por referido DENTRO de la transacción (independiente del pago),
 * registra el pago presencial o la comisión del gestor de ventas dentro de la
 * misma transacción y persiste un recibo inmutable cuando se provee clave de
 * idempotencia.
 *
 * Garantías de concurrencia:
 * - Lock pesimista (SELECT ... FOR UPDATE) sobre la fila de la licencia: dos
 *   operaciones sobre la misma licencia se serializan.
 * - Replay por recibo (tenantId+keyHash): misma clave y mismo payload devuelve
 *   el outcome original; payload distinto se rechaza con IDEMPOTENCY_CONFLICT.
 * - Clave de pago ajena (otra licencia/tenant) se rechaza con
 *   IDEMPOTENCY_CONFLICT antes de escribir nada.
 * - Renovaciones sin clave preservan el contrato legado (no idempotentes).
 *
 * @param {RenewLicenciaServiceInput} input - Solicitud validada por el caller.
 * @returns {Promise<RenewLicenciaOutcome>} Outcome comprometido.
 */
export async function renewTenantLicense(
  input: RenewLicenciaServiceInput,
): Promise<RenewLicenciaOutcome> {
  // Invariante de dominio: registrar pago exige clave de idempotencia. El
  // schema web la valida con Zod, pero el servicio la impone para cualquier
  // caller futuro (los casts `as string` de abajo descansan aquí).
  if (input.registerPayment === true && !input.idempotencyKey) {
    throw new ActionError(
      'La clave de idempotencia es requerida para registrar el pago',
      'VALIDATION_ERROR',
    );
  }
  const keyHash = input.idempotencyKey ? hashRenewalKey(input.idempotencyKey) : null;

  let deliveryIds: string[] = [];
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // 1. Lock pesimista: serializa operaciones concurrentes sobre la misma licencia
      await tx.$queryRaw<Array<{ tenantLicenseId: string }>>`
        SELECT "tenantLicenseId" FROM tenant_licenses
        WHERE "tenantLicenseId" = ${input.tenantLicenseId} FOR UPDATE`;

      const [license, newPlan, activeMembership] = await Promise.all([
        tx.tenantLicense.findUnique({
          where: { tenantLicenseId: input.tenantLicenseId },
          include: { plan: true },
        }),
        input.planId
          ? tx.plan.findUnique({ where: { planId: input.planId } })
          : Promise.resolve(null),
        input.requireActiveMembership
          ? tx.tenantMembership.findFirst({
              where: {
                tenant: { licencias: { some: { tenantLicenseId: input.tenantLicenseId } } },
                isActive: true,
                user: { isActive: true },
              },
              select: { membershipId: true, userId: true, tenantId: true },
            })
          : Promise.resolve(null),
      ]);

      if (!license)
        throw new ActionError('Licencia no encontrada', 'NOT_FOUND');
      if (input.planId && !newPlan)
        throw new ActionError('Plan no encontrado', 'PLAN_NOT_FOUND');
      if (input.requireActiveMembership && !activeMembership)
        throw new ActionError('El tenant no tiene miembros activos', 'TENANT_NOT_ACTIVE');

      const targetPlan = newPlan ?? license.plan;
      if (!targetPlan) {
        throw new ActionError(
          'La licencia no tiene un plan asociado',
          'VALIDATION_ERROR',
        );
      }

      const registerPayment = input.registerPayment === true;

      // 2. Replay por recibo ANTES de cualquier escritura
      let fingerprint: string | null = null;
      if (keyHash) {
        const fingerprintPayload: RenewalPayloadFingerprintInput = {
          tenantLicenseId: license.tenantLicenseId,
          planId: targetPlan.planId,
          registerPayment,
          // Normalizar a 2 decimales: la validación del pago redondea igual,
          // así 40.001 y 40 comparten huella (mismo resultado de negocio)
          amountPaidUsd: normalizedFingerprintAmount(input.amountPaidUsd),
          durationDays: input.durationDaysOverride ?? null,
        };
        fingerprint = fingerprintRenewalPayload(fingerprintPayload);
        const receipt = await tx.licenseRenewalOperation.findUnique({
          where: {
            tenantId_keyHash: { tenantId: license.tenantId, keyHash },
          },
          select: { payloadFingerprint: true, responseSnapshot: true },
        });
        if (receipt) {
          if (receipt.payloadFingerprint !== fingerprint) {
            throw new ActionError(
              'La renovación no coincide con la operación confirmada',
              'IDEMPOTENCY_CONFLICT',
            );
          }
          const revived = reviveRenewalOutcome(receipt.responseSnapshot);
          return {
            tenantLicenseId: revived.tenantLicenseId,
            newExpiracion: new Date(revived.newExpiracion),
            newPlanId: revived.newPlanId,
            previousExpiracion: new Date(revived.previousExpiracion),
            previousPlanId: revived.previousPlanId,
            registeredPaymentId: revived.registeredPaymentId,
            duplicate: true,
            commissionCredited: revived.commissionCredited,
          };
        }
      }

      // 3. Atribución por referido DENTRO de la tx, independiente del pago
      const [salesAgentRef, affiliateRef] = await Promise.all([
        tx.salesAgentReferral.findUnique({
          where: { referredTenantId: license.tenantId },
          select: { salesAgentReferralId: true },
        }),
        tx.affiliateReferral.findUnique({
          where: { referredTenantId: license.tenantId },
          select: { referralId: true },
        }),
      ]);
      const salesAgentReferred = Boolean(salesAgentRef);
      const referred = salesAgentReferred || Boolean(affiliateRef);

      // 4. Duración, fechas y pricing se calculan una sola vez
      const durationDays = resolveLicenseDurationDays(
        targetPlan.duracionDias,
        input.durationDaysOverride,
      );
      if (!durationDays) {
        throw new ActionError(
          'No se pudo resolver la duración de la licencia',
          'VALIDATION_ERROR',
        );
      }
      const now = new Date();
      const baseExpiracion =
        license.expiracion.getTime() > now.getTime() ? license.expiracion : now;
      const newExpiracion = addDays(baseExpiracion, durationDays);
      const samePlan = targetPlan.planId === license.planId;
      const pricing = resolveLicensePricing(Number(targetPlan.precio), referred);

      // 5. Pago presencial (no gestor): replay legado e importe se validan
      //    ANTES de extender la licencia
      let registeredPaymentId: string | null = null;
      let duplicate = false;
      if (registerPayment && !salesAgentReferred && input.idempotencyKey) {
        const existingPayment = await tx.tenantLicensePayment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: {
            tenantLicensePaymentId: true,
            tenantId: true,
            tenantLicenseId: true,
            paymentCycleEndsAt: true,
          },
        });
        if (existingPayment) {
          if (
            existingPayment.tenantLicenseId !== license.tenantLicenseId ||
            existingPayment.tenantId !== license.tenantId
          ) {
            throw new ActionError(
              'La clave de pago pertenece a otra licencia',
              'IDEMPOTENCY_CONFLICT',
            );
          }
          // Pago legado (pre-recibos): el ciclo persistido ES la renovación original
          return {
            tenantLicenseId: license.tenantLicenseId,
            newExpiracion: existingPayment.paymentCycleEndsAt,
            newPlanId: license.planId ?? targetPlan.planId,
            previousExpiracion: license.expiracion,
            previousPlanId: license.planId ?? null,
            registeredPaymentId: existingPayment.tenantLicensePaymentId,
            duplicate: true,
            commissionCredited: false,
          };
        }
        const expectedAmount = new Prisma.Decimal(
          pricing.finalPriceUsd,
        ).toDecimalPlaces(2);
        const paidAmount =
          input.amountPaidUsd !== undefined
            ? new Prisma.Decimal(input.amountPaidUsd).toDecimalPlaces(2)
            : expectedAmount;
        if (!paidAmount.equals(expectedAmount)) {
          throw new ActionError(
            'El monto pagado no coincide con el monto exigible',
            'PAYMENT_AMOUNT_MISMATCH',
          );
        }
      }

      // 6. Extensión de la licencia + sincronización de usuarios
      const updated = await tx.tenantLicense.update({
        where: { tenantLicenseId: license.tenantLicenseId },
        data: {
          planId: targetPlan.planId,
          expiracion: newExpiracion,
          activa: true,
          maxUsuarios: targetPlan.maxUsuarios,
          maxAlmacenes: targetPlan.maxAlmacenes,
          maxProductos: targetPlan.maxProductos,
          maxClientes: targetPlan.maxClientes,
          features: samePlan
            ? (license.features as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          featureOverrides: samePlan ? (license.featureOverrides ?? {}) : {},
          ...pricing,
        },
      });

      await tx.user.updateMany({
        where: {
          tenantMemberships: {
            some: { tenantId: license.tenantId, isActive: true },
          },
          isActive: true,
        } as never,
        data: { expiresAt: newExpiracion, isActive: true },
      });

      // 7. Pago presencial (no gestor) o comisión del gestor, dentro de la tx
      let commissionCredited = false;
      if (registerPayment && salesAgentReferred) {
        const agentOutcome = await confirmSalesAgentTenantPaymentInTx(tx, {
          tenantId: license.tenantId,
          tenantLicenseId: license.tenantLicenseId,
          idempotencyKey: input.idempotencyKey as string,
          amountPaidUsd:
            input.amountPaidUsd !== undefined
              ? input.amountPaidUsd
              : pricing.finalPriceUsd,
          confirmedByAdminId: input.actingAdminId,
          expectedExpiration: newExpiracion,
          paymentKind: 'renewal',
        });
        deliveryIds = agentOutcome.deliveryIds;
        commissionCredited = agentOutcome.result.credited;
        duplicate = agentOutcome.result.duplicate;
        registeredPaymentId = agentOutcome.result.paymentId;
      } else if (registerPayment && !salesAgentReferred) {
        const expectedAmount = new Prisma.Decimal(
          pricing.finalPriceUsd,
        ).toDecimalPlaces(2);
        const paidAmount =
          input.amountPaidUsd !== undefined
            ? new Prisma.Decimal(input.amountPaidUsd).toDecimalPlaces(2)
            : expectedAmount;
        const payment = await tx.tenantLicensePayment.create({
          data: {
            tenantId: license.tenantId,
            tenantLicenseId: updated.tenantLicenseId,
            paymentKind: 'renewal',
            expectedAmountUsd: expectedAmount,
            amountPaidUsd: paidAmount,
            idempotencyKey: input.idempotencyKey as string,
            immutableFingerprint: input.idempotencyKey as string,
            paymentCycleEndsAt: newExpiracion,
            licenseExpirationSnapshot: newExpiracion,
            confirmedByAdminId: input.actingAdminId,
            status: 'confirmed',
          },
        });
        registeredPaymentId = payment.tenantLicensePaymentId;
      }

      // 8. Auditoría transaccional con el diff completo
      await AuditLogService.logStrict(
        {
          accion: 'UPDATE',
          entidad: 'TENANT_LICENSE',
          entidadId: updated.tenantLicenseId,
          usuarioId: input.actingAdminId,
          detalles: {
            tenantId: license.tenantId,
            previousExpiracion: license.expiracion.toISOString(),
            newExpiracion: newExpiracion.toISOString(),
            previousPlanId: license.planId,
            newPlanId: targetPlan.planId,
            registerPayment,
            registeredPaymentId,
            via: input.via,
          },
        },
        tx,
      );

      // 9. Recibo inmutable de la operación (solo con clave)
      if (keyHash && fingerprint) {
        await tx.licenseRenewalOperation.create({
          data: {
            tenantId: license.tenantId,
            keyHash,
            payloadFingerprint: fingerprint,
            tenantLicenseId: updated.tenantLicenseId,
            responseSnapshot: snapshotRenewalOutcome({
              tenantLicenseId: updated.tenantLicenseId,
              newPlanId: targetPlan.planId,
              previousPlanId: license.planId ?? null,
              newExpiracion: newExpiracion.toISOString(),
              previousExpiracion: license.expiracion.toISOString(),
              registeredPaymentId,
              commissionCredited,
            }),
          },
        });
      }

      return {
        tenantLicenseId: updated.tenantLicenseId,
        newExpiracion,
        newPlanId: targetPlan.planId,
        previousExpiracion: license.expiracion,
        previousPlanId: license.planId ?? null,
        registeredPaymentId,
        duplicate,
        commissionCredited,
      };
    }, {
      // El lock de fila puede bloquear a un concurrente todo su presupuesto
      // de transacción; margen simétrico al del servicio de pagos.
      maxWait: 15_000,
      timeout: 30_000,
    });

    // 10. Emails del gestor: post-commit, best-effort
    if (deliveryIds.length > 0) {
      await deliverSalesAgentEmails(deliveryIds);
    }
    return outcome;
  } catch (error) {
    if (!isUniqueCollision(error) || !input.idempotencyKey || !keyHash) throw error;
    // Carrera de unicidad (recibo o pago): resolver contra el ganador persistido
    return resolveRenewalCollision(input, keyHash);
  }
}

/**
 * @description Cotización de servidor para una renovación: usa exactamente la
 * misma lógica de pricing (con descuento por referido detectado en el
 * momento), duración y fechas que ejecutará `renewTenantLicense`, de modo que
 * lo que el admin ve en el dialog coincida con lo que el servidor cobrará.
 * Es de solo lectura: no bloquea filas ni persiste nada.
 * @param {string} tenantLicenseId - Licencia a renovar.
 * @param {string} planId - Plan destino seleccionado.
 * @returns {Promise<RenewalQuote>} Precio final/de lista, duración y vista previa de expiración.
 */
export async function quoteRenewalLicense(
  tenantLicenseId: string,
  planId: string,
): Promise<RenewalQuote> {
  const [license, plan] = await Promise.all([
    prisma.tenantLicense.findUnique({
      where: { tenantLicenseId },
      select: { tenantLicenseId: true, tenantId: true, expiracion: true },
    }),
    prisma.plan.findUnique({ where: { planId } }),
  ]);

  if (!license) throw new ActionError('Licencia no encontrada', 'NOT_FOUND');
  if (!plan) throw new ActionError('Plan no encontrado', 'PLAN_NOT_FOUND');

  const [salesAgentRef, affiliateRef] = await Promise.all([
    prisma.salesAgentReferral.findUnique({
      where: { referredTenantId: license.tenantId },
      select: { salesAgentReferralId: true },
    }),
    prisma.affiliateReferral.findUnique({
      where: { referredTenantId: license.tenantId },
      select: { referralId: true },
    }),
  ]);
  const esReferido = Boolean(salesAgentRef || affiliateRef);

  const durationDays = resolveLicenseDurationDays(plan.duracionDias);
  if (!durationDays) {
    throw new ActionError(
      'No se pudo resolver la duración de la licencia',
      'VALIDATION_ERROR',
    );
  }

  const now = new Date();
  const baseExpiracion =
    license.expiracion.getTime() > now.getTime() ? license.expiracion : now;
  const newExpiracion = addDays(baseExpiracion, durationDays);
  const pricing = resolveLicensePricing(Number(plan.precio), esReferido);

  return {
    tenantLicenseId: license.tenantLicenseId,
    planId: plan.planId,
    listPriceUsd: pricing.listPriceUsd,
    finalPriceUsd: pricing.finalPriceUsd,
    duracionDias: durationDays,
    newExpiracion: newExpiracion.toISOString(),
    esReferido,
  };
}

/**
 * @description Cotización serializable de una renovación para el panel admin.
 */
export interface RenewalQuote {
  tenantLicenseId: string;
  planId: string;
  listPriceUsd: number;
  finalPriceUsd: number;
  duracionDias: number;
  /** ISO string de la expiración prevista. */
  newExpiracion: string;
  esReferido: boolean;
}

/**
 * @description Relee el estado canónico después de una carrera de unicidad y
 * resuelve el replay contra el ganador persistido.
 * @param {RenewLicenciaServiceInput} input - Solicitud original.
 * @param {string} keyHash - Hash de la clave de idempotencia.
 * @returns {Promise<RenewLicenciaOutcome>} Outcome del ganador.
 */
async function resolveRenewalCollision(
  input: RenewLicenciaServiceInput,
  keyHash: string,
): Promise<RenewLicenciaOutcome> {
  const license = await prisma.tenantLicense.findUnique({
    where: { tenantLicenseId: input.tenantLicenseId },
    select: { tenantId: true, planId: true, expiracion: true },
  });
  if (!license) {
    throw new ActionError('Licencia no encontrada', 'NOT_FOUND');
  }
  const receipt = await prisma.licenseRenewalOperation.findUnique({
    where: { tenantId_keyHash: { tenantId: license.tenantId, keyHash } },
    select: { payloadFingerprint: true, responseSnapshot: true },
  });
  if (receipt) {
    const targetPlanId = input.planId ?? license.planId ?? '';
    const fingerprint = fingerprintRenewalPayload({
      tenantLicenseId: input.tenantLicenseId,
      planId: targetPlanId,
      registerPayment: input.registerPayment === true,
      amountPaidUsd: normalizedFingerprintAmount(input.amountPaidUsd),
      durationDays: input.durationDaysOverride ?? null,
    });
    if (receipt.payloadFingerprint !== fingerprint) {
      throw new ActionError(
        'La renovación no coincide con la operación confirmada',
        'IDEMPOTENCY_CONFLICT',
      );
    }
    const revived = reviveRenewalOutcome(receipt.responseSnapshot);
    return {
      tenantLicenseId: revived.tenantLicenseId,
      newExpiracion: new Date(revived.newExpiracion),
      newPlanId: revived.newPlanId,
      previousExpiracion: new Date(revived.previousExpiracion),
      previousPlanId: revived.previousPlanId,
      registeredPaymentId: revived.registeredPaymentId,
      duplicate: true,
      commissionCredited: revived.commissionCredited,
    };
  }
  const payment = await prisma.tenantLicensePayment.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: {
      tenantId: true,
      tenantLicenseId: true,
      tenantLicensePaymentId: true,
      paymentCycleEndsAt: true,
    },
  });
  if (payment && payment.tenantLicenseId === input.tenantLicenseId) {
    return {
      tenantLicenseId: input.tenantLicenseId,
      newExpiracion: payment.paymentCycleEndsAt,
      newPlanId: license.planId ?? '',
      previousExpiracion: license.expiracion,
      previousPlanId: license.planId ?? null,
      registeredPaymentId: payment.tenantLicensePaymentId,
      duplicate: true,
      commissionCredited: false,
    };
  }
  throw new ActionError(
    'No se pudo resolver la renovación concurrente',
    'IDEMPOTENCY_CONFLICT',
  );
}

/**
 * @description Normaliza el monto para la huella de idempotencia con la misma
 * precisión (2 decimales) que la validación del pago, de modo que montos
 * sub-centavo equivalentes compartan huella.
 * @param {number | undefined} amount - Monto crudo del request.
 * @returns {number | null} Monto normalizado o null si no se especificó.
 */
function normalizedFingerprintAmount(amount: number | undefined): number | null {
  if (amount === undefined || amount === null) return null;
  return Number(new Prisma.Decimal(amount).toDecimalPlaces(2).toString());
}

/**
 * @description Detecta una colisión de unicidad de Prisma (P2002), sea del
 * recibo de renovación o del pago.
 * @param {unknown} error - Error de persistencia.
 * @returns {boolean} True para P2002.
 */
function isUniqueCollision(error: unknown): boolean {
  if (isRenewalReceiptUniqueViolation(error)) return true;
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002',
  );
}
