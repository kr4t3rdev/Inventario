import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    factura: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

let currentRole = 'admin';
let currentFeatures: Record<string, boolean> = {};

vi.mock('@/lib/prisma', async () => {
  const actual = await vi.importActual('@/lib/prisma');
  return { ...actual, default: prismaMock, prisma: prismaMock };
});

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

import { GET as listInvoices } from '../route';
import { GET as getInvoice } from '../[id]/route';

const invoice = {
  idFactura: 'invoice-1',
  tenantId: 'tenant-1',
  numeroConsecutivo: 1,
  serieId: 'serie-1',
  numeroFactura: 'FAC-000001',
  tipoDocumento: 'FACTURA',
  ventaId: 'sale-1',
  clienteId: 'client-1',
  cliente: { clienteId: 'client-1', nombre: 'Comercial Norte' },
  serie: { serieId: 'serie-1', prefijo: 'FAC', descripcion: null },
  venta: null,
  subtotal: '100.00',
  impuestos: '10.00',
  descuento: '0.00',
  total: '110.00',
  cargoTransporte: '0.00',
  tasaCambio: '1.00',
  estado: 'PENDIENTE',
  fechaEmision: new Date('2026-08-01T12:00:00.000Z'),
  fechaVencimiento: new Date('2026-08-31T12:00:00.000Z'),
  observaciones: null,
  createdAt: new Date('2026-08-01T12:00:00.000Z'),
  updatedAt: new Date('2026-08-02T12:00:00.000Z'),
};

describe('Mobile API: invoicing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRole = 'admin';
    currentFeatures = {};
  });

  it('lists tenant invoices with filters and pagination', async () => {
    prismaMock.factura.findMany.mockResolvedValue([invoice]);
    prismaMock.factura.count.mockResolvedValue(1);

    const response = await listInvoices(new NextRequest(
      'http://localhost/api/mobile/invoicing?search=FAC&estado=PENDIENTE&page=1&limit=20',
    ));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.factura.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1', estado: 'PENDIENTE' }),
      skip: 0,
      take: 20,
    }));
    expect(data.items[0]).toMatchObject({
      facturaId: 'invoice-1',
      numeroFactura: 'FAC-000001',
      clienteNombre: 'Comercial Norte',
      estado: 'PENDIENTE',
      total: 110,
    });
    expect(data.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it('gets an invoice only inside the authenticated tenant', async () => {
    prismaMock.factura.findFirst.mockResolvedValue(invoice);

    const response = await getInvoice(
      new NextRequest('http://localhost/api/mobile/invoicing/invoice-1'),
      { params: Promise.resolve({ id: 'invoice-1' }) },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.factura.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { idFactura: 'invoice-1', tenantId: 'tenant-1' },
    }));
  });

  it('returns 404 when the invoice is outside the tenant', async () => {
    prismaMock.factura.findFirst.mockResolvedValue(null);

    const response = await getInvoice(
      new NextRequest('http://localhost/api/mobile/invoicing/missing'),
      { params: Promise.resolve({ id: 'missing' }) },
    );

    expect(response.status).toBe(404);
  });

  it('preserves the existing facturacion feature gate', async () => {
    currentRole = 'dependiente';
    currentFeatures = { facturacion: false };

    const response = await listInvoices(
      new NextRequest('http://localhost/api/mobile/invoicing'),
    );

    expect(response.status).toBe(403);
    expect(prismaMock.factura.findMany).not.toHaveBeenCalled();
  });
});
