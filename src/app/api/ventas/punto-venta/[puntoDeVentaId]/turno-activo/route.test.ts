import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    turnoPuntoVenta: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: vi.fn((handler) => (request: NextRequest, context: unknown) =>
    handler(request, context, {
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      isActive: true,
      tenantId: 'tenant-1',
      planFeatures: { 'turnos-pos': true },
    }),
  ),
}));

import { prisma } from '@/lib/prisma';
import { GET } from './route';

describe('/api/ventas/punto-venta/[puntoDeVentaId]/turno-activo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the tenant-scoped active shift for the selected POS', async () => {
    vi.mocked(prisma.turnoPuntoVenta.findFirst).mockResolvedValue({
      id: 'turno-1',
      estado: 'ABIERTO',
      puntoDeVentaId: 'pv-1',
      ventas: [{ total: 500 }],
      _count: { ventas: 1 },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/ventas/punto-venta/pv-1/turno-activo'),
      { params: Promise.resolve({ puntoDeVentaId: 'pv-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.turno).toMatchObject({ id: 'turno-1', estado: 'ABIERTO' });
    expect(prisma.turnoPuntoVenta.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          puntoDeVentaId: 'pv-1',
          tenantId: 'tenant-1',
          estado: 'ABIERTO',
        }),
      }),
    );
  });

  it('returns null when there is no active shift', async () => {
    vi.mocked(prisma.turnoPuntoVenta.findFirst).mockResolvedValue(null as never);

    const response = await GET(
      new NextRequest('http://localhost/api/ventas/punto-venta/pv-1/turno-activo'),
      { params: Promise.resolve({ puntoDeVentaId: 'pv-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.turno).toBeNull();
  });
});
