import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    oferta: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', async () => {
  const actual = await vi.importActual('@/lib/prisma');
  return { ...actual, default: prismaMock, prisma: prismaMock };
});

let currentRole = 'admin';
let currentFeatures: Record<string, boolean> = {};

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(async () => ({
    user: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: currentRole,
      planFeatures: currentFeatures,
    },
  })),
}));

import { GET as listOffers } from '../route';
import { GET as getOffer } from '../[id]/route';

const offer = {
  id: 'offer-1',
  tenantId: 'tenant-1',
  numeroOferta: 'OF-000001',
  clienteId: 'client-1',
  cliente: { clienteId: 'client-1', nombre: 'Comercial Norte' },
  fechaEmision: new Date('2026-08-01T12:00:00.000Z'),
  fechaVencimiento: new Date('2026-08-31T12:00:00.000Z'),
  estado: 'PENDIENTE',
  subtotal: '100.00',
  impuestos: '10.00',
  total: '110.00',
  observaciones: null,
  createdAt: new Date('2026-08-01T12:00:00.000Z'),
  updatedAt: new Date('2026-08-02T12:00:00.000Z'),
  items: [],
};

describe('Mobile API: offers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRole = 'admin';
    currentFeatures = {};
  });

  it('lists tenant offers using the real Oferta domain shape', async () => {
    prismaMock.oferta.findMany.mockResolvedValue([offer]);

    const response = await listOffers(new NextRequest('http://localhost/api/mobile/offers'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.oferta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
    expect(data.items[0]).toMatchObject({
      ofertaId: 'offer-1',
      numeroOferta: 'OF-000001',
      clienteId: 'client-1',
      clienteNombre: 'Comercial Norte',
      estado: 'PENDIENTE',
      subtotal: 100,
      impuestos: 10,
      total: 110,
    });
  });

  it('gets an offer only inside the authenticated tenant', async () => {
    prismaMock.oferta.findFirst.mockResolvedValue(offer);

    const response = await getOffer(
      new NextRequest('http://localhost/api/mobile/offers/offer-1'),
      { params: Promise.resolve({ id: 'offer-1' }) },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.oferta.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'offer-1', tenantId: 'tenant-1' } }),
    );
  });

  it('returns 404 when the offer is outside the tenant', async () => {
    prismaMock.oferta.findFirst.mockResolvedValue(null);

    const response = await getOffer(
      new NextRequest('http://localhost/api/mobile/offers/missing'),
      { params: Promise.resolve({ id: 'missing' }) },
    );

    expect(response.status).toBe(404);
  });

  it('preserves the existing ofertas feature gate for non-admin users', async () => {
    currentRole = 'dependiente';
    currentFeatures = { ofertas: false };

    const response = await listOffers(new NextRequest('http://localhost/api/mobile/offers'));

    expect(response.status).toBe(403);
    expect(prismaMock.oferta.findMany).not.toHaveBeenCalled();
  });
});
