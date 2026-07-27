import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import {
  cleanupSalesAgentEmailDeliveries,
  createSalesAgentEvent,
  deliverSalesAgentEmail,
  deliverSalesAgentEmails,
  processDueSalesAgentEmailDeliveries,
} from '../notification-service';

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    salesAgentEmailDelivery: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe('sales-agent notification email delivery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses an absolute safe CTA only when a canonical public origin is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');
    vi.mocked(prisma.salesAgentEmailDelivery.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.salesAgentEmailDelivery.findUnique).mockResolvedValue({
      salesAgentEmailDeliveryId: 'delivery-link',
      status: 'processing',
      attempts: 0,
      notification: {
        title: 'Nueva comisión',
        message: 'Generaste una comisión.',
        user: { email: 'agent@test.com', name: 'Agent' },
      },
    } as never);
    vi.mocked(sendEmail).mockResolvedValue({ id: 'provider-1' } as never);

    await deliverSalesAgentEmail('delivery-link');

    expect(sendEmail).toHaveBeenCalledWith(
      'agent@test.com',
      'Nueva comisión',
      expect.stringContaining('href="https://app.example.com/sales-agent/referidos"'),
    );
  });

  it('omits the CTA link when no safe public origin exists', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.mocked(prisma.salesAgentEmailDelivery.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.salesAgentEmailDelivery.findUnique).mockResolvedValue({
      salesAgentEmailDeliveryId: 'delivery-no-link',
      status: 'processing',
      attempts: 0,
      notification: {
        title: 'Nueva comisión',
        message: 'Generaste una comisión.',
        user: { email: 'agent@test.com', name: 'Agent' },
      },
    } as never);
    vi.mocked(sendEmail).mockResolvedValue({ id: 'provider-1' } as never);

    await deliverSalesAgentEmail('delivery-no-link');

    const html = vi.mocked(sendEmail).mock.calls[0][2];
    expect(html).not.toContain('href=');
    expect(html).toContain('Ingresá a tu panel de referidos');
  });

  it('persists an owned notification and durable email row in the caller transaction', async () => {
    const notificationCreate = vi.fn().mockResolvedValue({ id: 'notification-1' });
    const deliveryCreate = vi.fn().mockResolvedValue({
      salesAgentEmailDeliveryId: 'delivery-1',
    });

    const result = await createSalesAgentEvent({
      tx: {
        notification: { create: notificationCreate },
        salesAgentEmailDelivery: { create: deliveryCreate },
      },
      userId: 'agent-1',
      eventType: 'commission_generated',
      title: 'Nueva comisión',
      message: 'Generaste una comisión de USD 3.00.',
      emailPayload: { amountUsd: '3.00' },
    } as never);

    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'agent-1',
        link: '/sales-agent/referidos',
      }),
    });
    expect(deliveryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        notificationId: 'notification-1',
        status: 'pending',
      }),
    });
    expect(result).toBe('delivery-1');
  });

  it('records a retryable failure when the existing email abstraction returns null', async () => {
    vi.mocked(prisma.salesAgentEmailDelivery.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.salesAgentEmailDelivery.findUnique).mockResolvedValue({
      salesAgentEmailDeliveryId: 'delivery-1',
      eventType: 'payout_paid',
      payload: { amountUsd: '40.00', amountCup: '12800.00', rate: '320.0000' },
      status: 'processing',
      attempts: 0,
      notification: {
        title: 'Pago confirmado',
        message: 'Recibiste USD 40.00.',
        user: { email: 'agent@test.com', name: 'Agent' },
      },
    } as never);
    vi.mocked(sendEmail).mockResolvedValue(null);

    await deliverSalesAgentEmail('delivery-1');

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(prisma.salesAgentEmailDelivery.update).toHaveBeenCalledWith({
      where: { salesAgentEmailDeliveryId: 'delivery-1' },
      data: expect.objectContaining({
        status: 'failed',
        attempts: { increment: 1 },
        lastError: expect.any(String),
        nextAttemptAt: expect.any(Date),
      }),
    });
  });

  it('never propagates post-commit delivery failures to the committed operation', async () => {
    vi.mocked(prisma.salesAgentEmailDelivery.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.salesAgentEmailDelivery.findUnique)
      .mockRejectedValueOnce(new Error('database temporarily unavailable'));

    await expect(deliverSalesAgentEmails(['delivery-1'])).resolves.toBeUndefined();
  });

  it('allows only one immediate post-commit sender to claim a delivery', async () => {
    vi.mocked(prisma.salesAgentEmailDelivery.updateMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    vi.mocked(prisma.salesAgentEmailDelivery.findUnique).mockResolvedValue({
      salesAgentEmailDeliveryId: 'delivery-1',
      status: 'processing',
      attempts: 0,
      notification: {
        title: 'Nueva comisión',
        message: 'Generaste una comisión.',
        user: { email: 'agent@test.com', name: 'Agent' },
      },
    } as never);
    vi.mocked(sendEmail).mockResolvedValue({ id: 'provider-1' } as never);

    await Promise.all([
      deliverSalesAgentEmail('delivery-1'),
      deliverSalesAgentEmail('delivery-1'),
    ]);

    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('claims and sends only due rows, leaving concurrent claims to the winner', async () => {
    vi.mocked(prisma.salesAgentEmailDelivery.findMany).mockResolvedValue([
      { salesAgentEmailDeliveryId: 'delivery-1' },
      { salesAgentEmailDeliveryId: 'delivery-2' },
    ] as never);
    vi.mocked(prisma.salesAgentEmailDelivery.updateMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    vi.mocked(prisma.salesAgentEmailDelivery.findUnique).mockResolvedValue({
      salesAgentEmailDeliveryId: 'delivery-1',
      status: 'processing',
      attempts: 0,
      notification: {
        title: 'Nueva comisión',
        message: 'Generaste una comisión.',
        user: { email: 'agent@test.com', name: 'Agent' },
      },
    } as never);
    vi.mocked(sendEmail).mockResolvedValue({ id: 'provider-1' } as never);

    const result = await processDueSalesAgentEmailDeliveries({
      now: new Date('2026-07-27T12:00:00.000Z'),
    });

    expect(result).toEqual({ scanned: 2, claimed: 1, sent: 1, failed: 0 });
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('reclaims a stale processing row after a worker crash and schedules provider failures', async () => {
    vi.mocked(prisma.salesAgentEmailDelivery.findMany).mockResolvedValue([
      { salesAgentEmailDeliveryId: 'delivery-stale' },
    ] as never);
    vi.mocked(prisma.salesAgentEmailDelivery.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.salesAgentEmailDelivery.findUnique).mockResolvedValue({
      salesAgentEmailDeliveryId: 'delivery-stale',
      status: 'processing',
      attempts: 1,
      notification: {
        title: 'Pago',
        message: 'Pago confirmado.',
        user: { email: 'agent@test.com', name: 'Agent' },
      },
    } as never);
    vi.mocked(sendEmail).mockResolvedValue(null);

    const result = await processDueSalesAgentEmailDeliveries({
      now: new Date('2026-07-27T12:00:00.000Z'),
    });

    expect(result.failed).toBe(1);
    expect(prisma.salesAgentEmailDelivery.update).toHaveBeenCalledWith({
      where: { salesAgentEmailDeliveryId: 'delivery-stale' },
      data: expect.objectContaining({
        status: 'failed',
        attempts: { increment: 1 },
        nextAttemptAt: expect.any(Date),
      }),
    });
  });

  it('does not claim rows that reached the maximum attempt count', async () => {
    vi.mocked(prisma.salesAgentEmailDelivery.findMany).mockResolvedValue([]);

    await processDueSalesAgentEmailDeliveries({
      now: new Date('2026-07-27T12:00:00.000Z'),
      maxAttempts: 5,
    });

    expect(prisma.salesAgentEmailDelivery.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ attempts: { lt: 5 } }),
      orderBy: { nextAttemptAt: 'asc' },
      select: { salesAgentEmailDeliveryId: true },
      take: 50,
    });
  });

  it('deletes only old sent or terminal delivery metadata and preserves notifications', async () => {
    vi.mocked(prisma.salesAgentEmailDelivery.deleteMany).mockResolvedValue({ count: 4 });

    const result = await cleanupSalesAgentEmailDeliveries({
      now: new Date('2026-07-27T12:00:00.000Z'),
    });

    expect(result).toEqual({ deleted: 4 });
    expect(prisma.salesAgentEmailDelivery.deleteMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['sent', 'dead'] },
        updatedAt: { lt: new Date('2026-04-28T12:00:00.000Z') },
      },
    });
  });
});
