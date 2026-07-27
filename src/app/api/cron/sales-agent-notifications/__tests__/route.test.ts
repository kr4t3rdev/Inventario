import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupSalesAgentEmailDeliveries,
  processDueSalesAgentEmailDeliveries,
} from '@/features/sales-agent/services/notification-service';
import { GET } from '../route';

vi.mock('@/features/sales-agent/services/notification-service', () => ({
  cleanupSalesAgentEmailDeliveries: vi.fn(),
  processDueSalesAgentEmailDeliveries: vi.fn(),
}));

describe('sales-agent notification cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    vi.mocked(processDueSalesAgentEmailDeliveries).mockResolvedValue({
      scanned: 1,
      claimed: 1,
      sent: 1,
      failed: 0,
    });
    vi.mocked(cleanupSalesAgentEmailDeliveries).mockResolvedValue({ deleted: 2 });
  });

  afterEach(() => vi.unstubAllEnvs());

  it('fails closed when the cron secret is missing', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const response = await GET(new NextRequest('http://localhost/api/cron/sales-agent-notifications'));

    expect(response.status).toBe(401);
    expect(processDueSalesAgentEmailDeliveries).not.toHaveBeenCalled();
  });

  it('requires the configured bearer secret', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/cron/sales-agent-notifications',
      { headers: { authorization: 'Bearer wrong' } },
    ));

    expect(response.status).toBe(401);
  });

  it('processes retries and retention for an authorized cron request', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/cron/sales-agent-notifications',
      { headers: { authorization: 'Bearer cron-secret' } },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      delivery: { sent: 1 },
      cleanup: { deleted: 2 },
    });
  });
});
