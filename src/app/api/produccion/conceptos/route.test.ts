import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    gastosDE: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: vi.fn((handler) => async (request: NextRequest) =>
    handler(request, {}, { userId: 'u1', tenantId: 'tenant-prod-1', tenantRole: 'manager' }),
  ),
}));

describe('/api/produccion/conceptos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve conceptos filtrados por tenant', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { GET } = await import('./route');

    vi.mocked(prisma.gastosDE.findMany).mockResolvedValue([
      { tipo: 'Transporte' },
      { tipo: 'Publicidad' },
    ] as never);

    const response = await GET(new NextRequest('http://localhost/api/produccion/conceptos'), {});
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(['Publicidad', 'Transporte', 'Otro']);
    expect(prisma.gastosDE.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-prod-1' },
      select: { tipo: true },
      distinct: ['tipo'],
    });
  });
});
