import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  default: {
    transferenciaBancaria: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';
import { GET } from '../route';

describe('api/contabilidad/transferencias route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/contabilidad/transferencias'));
    expect(response.status).toBe(401);
  });

  it('returns 403 when transferencias bancarias are disabled in the plan', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        userId: 'u-1',
        role: 'user',
        tenantRole: 'economico',
        planName: 'Básico',
        planFeatures: {
          contabilidad: true,
          'transferencias-bancarias': false,
        },
      },
    } as never);

    const response = await GET(new NextRequest('http://localhost/api/contabilidad/transferencias'));

    expect(response.status).toBe(403);
  });

  it('keeps legacy access for professional tenants while the new flag is being backfilled', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        userId: 'u-2',
        role: 'user',
        tenantRole: 'economico',
        planName: 'Profesional',
        planFeatures: {
          contabilidad: true,
        },
      },
    } as never);

    vi.mocked(prisma.transferenciaBancaria.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.transferenciaBancaria.count).mockResolvedValue(0 as never);

    const response = await GET(new NextRequest('http://localhost/api/contabilidad/transferencias'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transferencias).toEqual([]);
  });
});
