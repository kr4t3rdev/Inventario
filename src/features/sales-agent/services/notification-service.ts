import type { Prisma } from '@/generated/prisma';
import { sendEmail } from '@/lib/email';
import { prismaPlatform as prisma } from '@/lib/db/platform-prisma';
import { getConfiguredPublicAppUrl } from '../public-url';

const DASHBOARD_LINK = '/sales-agent/referidos';
const RETRY_DELAY_MS = 15 * 60 * 1000;
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETENTION_DAYS = 90;

interface SalesAgentEventInput {
  tx: Prisma.TransactionClient;
  userId: string;
  eventType: string;
  title: string;
  message: string;
  emailPayload?: Prisma.InputJsonValue;
}

/**
 * @description Persiste una notificación owner-only y su entrega de email en la misma transacción.
 * @param {SalesAgentEventInput} input - Evento mínimo y transaction client.
 * @returns {Promise<string>} ID durable de entrega.
 */
export async function createSalesAgentEvent(input: SalesAgentEventInput): Promise<string> {
  const notification = await input.tx.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.eventType,
      prioridad: 'normal',
      link: DASHBOARD_LINK,
    },
  });
  const delivery = await input.tx.salesAgentEmailDelivery.create({
    data: {
      notificationId: notification.id,
      eventType: input.eventType,
      payload: input.emailPayload ?? {},
      status: 'pending',
    },
  });
  return delivery.salesAgentEmailDeliveryId;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

/**
 * @description Intenta una entrega post-commit y deja estado reintentable ante cualquier fallo.
 * @param {string} deliveryId - ID durable del outbox.
 * @returns {Promise<'sent' | 'failed' | 'skipped'>} Resultado durable del intento.
 */
export async function deliverSalesAgentEmail(
  deliveryId: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  alreadyClaimed = false,
): Promise<'sent' | 'failed' | 'skipped'> {
  if (!alreadyClaimed) {
    const now = new Date();
    const claim = await prisma.salesAgentEmailDelivery.updateMany({
      where: {
        salesAgentEmailDeliveryId: deliveryId,
        status: { in: ['pending', 'failed'] },
        attempts: { lt: maxAttempts },
        nextAttemptAt: { lte: now },
      },
      data: { status: 'processing', claimedAt: now },
    });
    if (claim.count !== 1) return 'skipped';
  }

  const delivery = await prisma.salesAgentEmailDelivery.findUnique({
    where: { salesAgentEmailDeliveryId: deliveryId },
    include: {
      notification: {
        select: {
          title: true,
          message: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
  });
  if (!delivery || delivery.status !== 'processing') return 'skipped';

  const publicOrigin = getConfiguredPublicAppUrl();
  const cta = publicOrigin
    ? `<p><a href="${publicOrigin}${DASHBOARD_LINK}">Ver panel de referidos</a></p>`
    : '<p>Ingresa a tu panel de referidos para ver los detalles.</p>';
  const html = [
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">',
    `<h2>${escapeHtml(delivery.notification.title)}</h2>`,
    `<p>${escapeHtml(delivery.notification.message)}</p>`,
    cta,
    '</div>',
  ].join('');

  try {
    const result = await sendEmail(
      delivery.notification.user.email,
      delivery.notification.title,
      html,
    );
    if (!result) throw new Error('Email provider did not accept the message');
    await prisma.salesAgentEmailDelivery.update({
      where: { salesAgentEmailDeliveryId: deliveryId },
      data: {
        status: 'sent',
        attempts: { increment: 1 },
        messageId: result.id,
        lastError: null,
        claimedAt: null,
        sentAt: new Date(),
      },
    });
    return 'sent';
  } catch (error) {
    const attemptsAfterFailure = delivery.attempts + 1;
    await prisma.salesAgentEmailDelivery.update({
      where: { salesAgentEmailDeliveryId: deliveryId },
      data: {
        status: attemptsAfterFailure >= maxAttempts ? 'dead' : 'failed',
        attempts: { increment: 1 },
        claimedAt: null,
        lastError: error instanceof Error ? error.message.slice(0, 500) : 'Unknown email error',
        nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
      },
    });
    return 'failed';
  }
}

/**
 * @description Ejecuta entregas post-commit sin propagar fallos al flujo financiero.
 * @param {string[]} deliveryIds - IDs creados dentro de la transacción ya confirmada.
 * @returns {Promise<void>} Resultado best-effort con fallo durable por entrega.
 */
export async function deliverSalesAgentEmails(deliveryIds: string[]): Promise<void> {
  await Promise.allSettled(
    deliveryIds.map((deliveryId) => deliverSalesAgentEmail(deliveryId)),
  );
}

interface ProcessDueDeliveryOptions {
  now?: Date;
  batchSize?: number;
  maxAttempts?: number;
}

/**
 * @description Reclama de forma atómica entregas vencidas y recupera claims abandonados.
 * @param {ProcessDueDeliveryOptions} options - Reloj, lote y límite de intentos.
 * @returns {Promise<object>} Contadores del procesamiento.
 */
export async function processDueSalesAgentEmailDeliveries(
  options: ProcessDueDeliveryOptions = {},
): Promise<{ scanned: number; claimed: number; sent: number; failed: number }> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? 50;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const staleClaimBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MS);
  const claimable: Prisma.SalesAgentEmailDeliveryWhereInput = {
    attempts: { lt: maxAttempts },
    OR: [
      { status: { in: ['pending', 'failed'] }, nextAttemptAt: { lte: now } },
      { status: 'processing', claimedAt: { lt: staleClaimBefore } },
    ],
  };
  const dueRows = await prisma.salesAgentEmailDelivery.findMany({
    where: claimable,
    orderBy: { nextAttemptAt: 'asc' },
    select: { salesAgentEmailDeliveryId: true },
    take: batchSize,
  });

  let claimed = 0;
  let sent = 0;
  let failed = 0;
  for (const row of dueRows) {
    const claim = await prisma.salesAgentEmailDelivery.updateMany({
      where: {
        salesAgentEmailDeliveryId: row.salesAgentEmailDeliveryId,
        ...claimable,
      },
      data: { status: 'processing', claimedAt: now },
    });
    if (claim.count !== 1) continue;
    claimed += 1;
    const outcome = await deliverSalesAgentEmail(
      row.salesAgentEmailDeliveryId,
      maxAttempts,
      true,
    );
    if (outcome === 'sent') sent += 1;
    else if (outcome === 'failed') failed += 1;
  }
  return { scanned: dueRows.length, claimed, sent, failed };
}

interface CleanupDeliveryOptions {
  now?: Date;
  retentionDays?: number;
}

/**
 * @description Elimina sólo metadata de entrega sent/dead más antigua que 90 días por defecto.
 * Las notificaciones financieras y el ledger se preservan.
 * @param {CleanupDeliveryOptions} options - Reloj y retención configurable.
 * @returns {Promise<{deleted: number}>} Cantidad de filas de entrega eliminadas.
 */
export async function cleanupSalesAgentEmailDeliveries(
  options: CleanupDeliveryOptions = {},
): Promise<{ deleted: number }> {
  const now = options.now ?? new Date();
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.salesAgentEmailDelivery.deleteMany({
    where: {
      status: { in: ['sent', 'dead'] },
      updatedAt: { lt: cutoff },
    },
  });
  return { deleted: result.count };
}
