import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/lib/prisma';
import {
  createSalesAgentEvent,
  deliverSalesAgentEmails,
} from '../notification-service';
import { confirmSalesAgentPayout } from '../payout-service';

vi.mock('../notification-service', () => ({
  createSalesAgentEvent: vi.fn().mockResolvedValue('delivery-1'),
  deliverSalesAgentEmails: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: vi.fn(), salesAgentPayout: { findUnique: vi.fn() } },
}));

vi.mock('@/lib/db/platform-prisma', async () => {
  const { prisma } = await import('@/lib/prisma');
  return { prismaPlatform: prisma, default: prisma };
});

describe('confirmSalesAgentPayout', () => {
  const findAgent = vi.fn();
  const findPayout = vi.fn();
  const updateBalance = vi.fn();
  const createPayout = vi.fn();
  const createAudit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    findAgent.mockResolvedValue({
      userId: 'agent-1',
      role: 'salesAgent',
      isActive: true,
      salesAgentProfile: { status: 'active' },
      salesAgentBalance: { availableUsd: '100.00', paidUsd: '20.00' },
    });
    findPayout.mockResolvedValue(null);
    updateBalance.mockResolvedValue({ count: 1 });
    createPayout.mockResolvedValue({
      salesAgentPayoutId: 'payout-1',
      amountUsd: '40.00',
      exchangeRateCupPerUsd: '320.0000',
      amountCup: '12800.00',
      status: 'paid',
      processedAt: new Date('2026-07-27T20:00:00.000Z'),
    });
    createAudit.mockResolvedValue({ auditLogId: 'audit-1' });
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback({
      user: { findUnique: findAgent },
      salesAgentPayout: { findUnique: findPayout, create: createPayout },
      salesAgentBalance: { updateMany: updateBalance },
      auditLog: { create: createAudit },
    } as never));
  });

  it('confirms a partial payout with immutable CUP conversion snapshot', async () => {
    const result = await confirmSalesAgentPayout({
      userId: 'agent-1',
      amountUsd: 40,
      exchangeRateCupPerUsd: 320,
      notes: 'Paid in person',
      idempotencyKey: 'payout-1',
      processedByAdminId: 'admin-1',
    });

    expect(result).toMatchObject({ duplicate: false, amountCup: '12800.00' });
    expect(updateBalance).toHaveBeenCalledWith({
      where: { userId: 'agent-1', availableUsd: { gte: expect.anything() } },
      data: {
        availableUsd: { decrement: expect.anything() },
        paidUsd: { increment: expect.anything() },
      },
    });
    expect(createPayout).toHaveBeenCalledWith({ data: expect.objectContaining({
      amountUsd: expect.anything(),
      exchangeRateCupPerUsd: expect.anything(),
      amountCup: expect.anything(),
      status: 'paid',
      processedByAdminId: 'admin-1',
      idempotencyKey: 'payout-1',
      immutableFingerprint: 'agent-1|40.00|320.0000|Paid in person',
    }) });
    expect(createAudit).toHaveBeenCalledOnce();
    expect(createSalesAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'agent-1',
      eventType: 'payout_partial',
    }));
    expect(deliverSalesAgentEmails).toHaveBeenCalledWith(['delivery-1']);
  });

  it('allows a full payout', async () => {
    await expect(confirmSalesAgentPayout({
      userId: 'agent-1',
      amountUsd: 100,
      exchangeRateCupPerUsd: 300,
      idempotencyKey: 'full-1',
      processedByAdminId: 'admin-1',
    })).resolves.toMatchObject({ duplicate: false });
    expect(createSalesAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'payout_full',
    }));
  });

  it('rejects over-balance and a lost concurrent conditional update', async () => {
    await expect(confirmSalesAgentPayout({
      userId: 'agent-1',
      amountUsd: 101,
      exchangeRateCupPerUsd: 300,
      idempotencyKey: 'over-1',
      processedByAdminId: 'admin-1',
    })).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });

    updateBalance.mockResolvedValueOnce({ count: 0 });
    await expect(confirmSalesAgentPayout({
      userId: 'agent-1',
      amountUsd: 60,
      exchangeRateCupPerUsd: 300,
      idempotencyKey: 'race-1',
      processedByAdminId: 'admin-1',
    })).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    expect(createPayout).not.toHaveBeenCalled();
  });

  it('returns exact idempotent replay and rejects a conflicting fingerprint', async () => {
    findPayout.mockResolvedValueOnce({
      immutableFingerprint: 'agent-1|40.00|320.0000|Paid in person',
      salesAgentPayoutId: 'payout-existing',
      amountCup: '12800.00',
      status: 'paid',
    });
    await expect(confirmSalesAgentPayout({
      userId: 'agent-1',
      amountUsd: 40,
      exchangeRateCupPerUsd: 320,
      notes: 'Paid in person',
      idempotencyKey: 'payout-1',
      processedByAdminId: 'admin-1',
    })).resolves.toMatchObject({ duplicate: true, payoutId: 'payout-existing' });

    findPayout.mockResolvedValueOnce({
      immutableFingerprint: 'agent-1|50.00|320.0000|',
      salesAgentPayoutId: 'payout-existing',
    });
    await expect(confirmSalesAgentPayout({
      userId: 'agent-1',
      amountUsd: 40,
      exchangeRateCupPerUsd: 320,
      idempotencyKey: 'payout-1',
      processedByAdminId: 'admin-1',
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('rejects inactive and non-sales-agent identities', async () => {
    findAgent.mockResolvedValueOnce({
      role: 'salesAgent',
      isActive: false,
      salesAgentProfile: { status: 'active' },
      salesAgentBalance: { availableUsd: '100.00' },
    });
    await expect(confirmSalesAgentPayout({
      userId: 'agent-1',
      amountUsd: 10,
      exchangeRateCupPerUsd: 300,
      idempotencyKey: 'inactive',
      processedByAdminId: 'admin-1',
    })).rejects.toMatchObject({ code: 'SALES_AGENT_NOT_ACTIVE' });
  });
});
