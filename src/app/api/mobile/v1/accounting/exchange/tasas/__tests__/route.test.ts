import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    moneda: {
      findMany: vi.fn(),
    },
    tasaCambio: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { contabilidad: true },
};

describe('mobile exchange tasas route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns principal currency and latest exchange rates', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(prisma.moneda.findMany).mockResolvedValue([
      { monedaId: 'cup', nombre: 'CUP', esPrincipal: true },
      { monedaId: 'usd', nombre: 'USD', esPrincipal: false },
    ] as never);
    vi.mocked(prisma.tasaCambio.findMany).mockResolvedValue([
      {
        tasaId: 't1',
        monedaOrigenId: 'usd',
        monedaDestino: 'CUP',
        tasa: '24',
        fechaVigencia: new Date('2026-06-22T00:00:00.000Z'),
      },
    ] as never);

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/exchange/tasas', {
      headers: { authorization: 'Bearer mobile-access' },
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.monedaPrincipal.monedaId).toBe('cup');
    expect(data.data.tasas).toHaveLength(1);
    expect(prisma.tasaCambio.findMany).toHaveBeenCalledWith({
      orderBy: { fechaVigencia: 'desc' },
      take: 50,
    });
  });
});
