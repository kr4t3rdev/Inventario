import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { GET } from '../route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantLicense: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/platform-prisma', async () => {
  const { prisma } = await import('@/lib/prisma');
  return { prismaPlatform: prisma, default: prisma };
});

describe('cron demos route', () => {
  const previousCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  afterAll(() => {
    process.env.CRON_SECRET = previousCronSecret;
  });

  it('rechaza requests sin secret válido', async () => {
    const request = new NextRequest('http://localhost/api/cron/demos', {
      method: 'GET',
      headers: { 'x-cron-secret': 'wrong-secret' },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('desactiva demos expiradas cuando el secret es válido', async () => {
    vi.mocked(prisma.tenantLicense.findMany).mockResolvedValue([
      {
        tenantLicenseId: 'lic-demo-1',
        tenantId: 'tenant-1',
        expiracion: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        tenantLicenseId: 'lic-demo-2',
        tenantId: 'tenant-2',
        expiracion: new Date('2026-06-02T00:00:00.000Z'),
      },
    ] as never);
    vi.mocked(prisma.tenantLicense.updateMany).mockResolvedValue({ count: 2 } as never);

    const request = new NextRequest('http://localhost/api/cron/demos', {
      method: 'GET',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.tenantLicense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isDemo: true,
          activa: true,
          expiracion: expect.any(Object),
        }),
      }),
    );
    expect(prisma.tenantLicense.updateMany).toHaveBeenCalledWith({
      where: {
        tenantLicenseId: {
          in: ['lic-demo-1', 'lic-demo-2'],
        },
      },
      data: {
        activa: false,
      },
    });
    expect(data).toEqual({
      scanned: 2,
      deactivated: 2,
    });
  });

  it('retorna cero cuando no hay demos expiradas', async () => {
    vi.mocked(prisma.tenantLicense.findMany).mockResolvedValue([] as never);

    const request = new NextRequest('http://localhost/api/cron/demos', {
      method: 'GET',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.tenantLicense.updateMany).not.toHaveBeenCalled();
    expect(data).toEqual({
      scanned: 0,
      deactivated: 0,
    });
  });
});
