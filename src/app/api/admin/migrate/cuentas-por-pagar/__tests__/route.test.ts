import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { GET } from '../route';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaPorPagar: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('admin migrate cuentas por pagar - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite acceso a roles legacy de admin', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware');
    const { prisma } = await import('@/lib/prisma');

    vi.mocked(authenticateUser).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    vi.mocked(prisma.cuentaPorPagar.count).mockResolvedValue(0);
    vi.mocked(prisma.cuentaPorPagar.findMany).mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/admin/migrate/cuentas-por-pagar');
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it('deniega acceso si el rol no es administrador', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware');

    vi.mocked(authenticateUser).mockResolvedValue({ user: { role: 'regularUser' } } as never);

    const request = new NextRequest('http://localhost/api/admin/migrate/cuentas-por-pagar');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('administradores');
  });
});
