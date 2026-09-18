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

describe('mobile exchange monedas route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns exchange currencies ordered by name', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(prisma.moneda.findMany).mockResolvedValue([
      { monedaId: 'cup', nombre: 'CUP' },
      { monedaId: 'usd', nombre: 'USD' },
    ] as never);

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/exchange/monedas', {
      headers: { authorization: 'Bearer mobile-access' },
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(prisma.moneda.findMany).toHaveBeenCalledWith({ orderBy: { nombre: 'asc' } });
  });
});
