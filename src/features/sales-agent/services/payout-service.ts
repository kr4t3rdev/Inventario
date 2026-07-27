import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';

import { calculateSalesAgentPayout } from './commission-service';
import {
  createSalesAgentEvent,
  deliverSalesAgentEmails,
} from './notification-service';

export interface ConfirmSalesAgentPayoutInput {
  userId: string;
  amountUsd: Prisma.Decimal.Value;
  exchangeRateCupPerUsd: Prisma.Decimal.Value;
  notes?: string;
  idempotencyKey: string;
  processedByAdminId: string;
}

/**
 * @description Confirma un pago presencial contra el saldo autoritativo del Gestor.
 * @param {ConfirmSalesAgentPayoutInput} input - Solicitud validada y administrador actor.
 * @returns {Promise<object>} Snapshot persistido o replay idempotente.
 */
export async function confirmSalesAgentPayout(input: ConfirmSalesAgentPayoutInput) {
  const amountUsd = new Prisma.Decimal(input.amountUsd).toDecimalPlaces(2);
  const rate = new Prisma.Decimal(input.exchangeRateCupPerUsd).toDecimalPlaces(4);
  const notes = input.notes?.trim() || null;
  if (!amountUsd.gt(0) || !rate.gt(0)) {
    throw new ActionError('Monto y tasa deben ser mayores que cero', 'VALIDATION_ERROR');
  }
  const fingerprint = [
    input.userId,
    amountUsd.toFixed(2),
    rate.toFixed(4),
    notes ?? '',
  ].join('|');

  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
    const existing = await tx.salesAgentPayout.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.immutableFingerprint !== fingerprint) {
        throw new ActionError('La clave ya fue usada con otros datos', 'IDEMPOTENCY_CONFLICT');
      }
      return {
        duplicate: true,
        payoutId: existing.salesAgentPayoutId,
        amountCup: existing.amountCup.toString(),
        status: existing.status,
      };
    }

    const agent = await tx.user.findUnique({
      where: { userId: input.userId },
      select: {
        userId: true,
        role: true,
        isActive: true,
        salesAgentProfile: { select: { status: true } },
        salesAgentBalance: { select: { availableUsd: true, paidUsd: true } },
      },
    });
    if (
      !agent ||
      agent.role !== 'salesAgent' ||
      !agent.isActive ||
      agent.salesAgentProfile?.status !== 'active'
    ) {
      throw new ActionError('El Gestor no está activo', 'SALES_AGENT_NOT_ACTIVE');
    }
    if (!agent.salesAgentBalance) {
      throw new ActionError('El Gestor no tiene saldo disponible', 'INSUFFICIENT_BALANCE');
    }

    let snapshot;
    try {
      snapshot = calculateSalesAgentPayout({
        amountUsd,
        availableBalanceUsd: agent.salesAgentBalance.availableUsd,
        exchangeRateCupPerUsd: rate,
      });
    } catch {
      throw new ActionError('El monto excede el saldo disponible', 'INSUFFICIENT_BALANCE');
    }

    const updated = await tx.salesAgentBalance.updateMany({
      where: { userId: input.userId, availableUsd: { gte: amountUsd } },
      data: {
        availableUsd: { decrement: amountUsd },
        paidUsd: { increment: amountUsd },
      },
    });
    if (updated.count !== 1) {
      throw new ActionError('El saldo cambió; actualizá e intentá nuevamente', 'INSUFFICIENT_BALANCE');
    }

    const payout = await tx.salesAgentPayout.create({
      data: {
        salesAgentUserId: input.userId,
        amountUsd,
        exchangeRateCupPerUsd: rate,
        amountCup: snapshot.amountCup,
        status: 'paid',
        processedAt: new Date(),
        processedByAdminId: input.processedByAdminId,
        adminNotes: notes,
        idempotencyKey: input.idempotencyKey,
        immutableFingerprint: fingerprint,
      },
    });
    await AuditLogService.logStrict({
      accion: 'CREATE',
      entidad: 'SALES_AGENT_PAYOUT',
      entidadId: payout.salesAgentPayoutId,
      usuarioId: input.processedByAdminId,
      detalles: {
        salesAgentUserId: input.userId,
        amountUsd: amountUsd.toFixed(2),
        exchangeRateCupPerUsd: rate.toFixed(4),
        amountCup: snapshot.amountCup.toFixed(2),
        idempotencyKey: input.idempotencyKey,
      },
    }, tx);
    const isFullPayout = amountUsd.equals(agent.salesAgentBalance.availableUsd);
    const deliveryId = await createSalesAgentEvent({
      tx,
      userId: input.userId,
      eventType: isFullPayout ? 'payout_full' : 'payout_partial',
      title: isFullPayout ? 'Pago total confirmado' : 'Pago parcial confirmado',
      message:
        `Recibiste USD ${amountUsd.toFixed(2)} (CUP ${snapshot.amountCup.toFixed(2)} ` +
        `a ${rate.toFixed(4)} CUP/USD).`,
      emailPayload: {
        amountUsd: amountUsd.toFixed(2),
        amountCup: snapshot.amountCup.toFixed(2),
        rate: rate.toFixed(4),
      },
    });

    return {
      result: {
        duplicate: false,
        payoutId: payout.salesAgentPayoutId,
        amountCup: snapshot.amountCup.toFixed(2),
        status: payout.status,
      },
      deliveryIds: [deliveryId],
    };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if ('result' in transactionResult && transactionResult.deliveryIds) {
      await deliverSalesAgentEmails(transactionResult.deliveryIds);
      return transactionResult.result;
    }
    return transactionResult;
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'P2002'
    ) {
      throw error;
    }
    const winner = await prisma.salesAgentPayout.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (!winner || winner.immutableFingerprint !== fingerprint) {
      throw new ActionError('La clave ya fue usada con otros datos', 'IDEMPOTENCY_CONFLICT');
    }
    return {
      duplicate: true,
      payoutId: winner.salesAgentPayoutId,
      amountCup: winner.amountCup.toString(),
      status: winner.status,
    };
  }
}
