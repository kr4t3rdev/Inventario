import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { findMany, count, findFirst } = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(async () => ({ user: { tenantId: 'tenant-1' } })),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    compraDocumento: { findMany, count, findFirst },
  },
}));

import { GET as listCompras } from '../route';
import { GET as getCompra } from '../[id]/route';

const compra = {
  compraDocumentoId: 'compra-1',
  proveedorId: 'proveedor-1',
  numeroFactura: 'F-1',
  fechaCompra: new Date('2026-01-15T00:00:00.000Z'),
  estado: 'PAGADA',
  tipoOperacion: 'REGULAR',
  formaPago: 'PAGO_COMPLETO',
  total: 125,
  descripcion: 'Recepción',
  createdAt: new Date('2026-01-15T00:00:00.000Z'),
  proveedor: { vendorId: 'proveedor-1', nombre: 'Proveedor' },
  items: [{
    compraDocumentoItemId: 'item-1',
    productoId: 'producto-1',
    cantidad: 5,
    precioUnitario: 25,
    totalLinea: 125,
    producto: { id: 'producto-1', nombre: 'Producto' },
  }],
};

describe('mobile purchase read routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps list fields to the persisted purchase document model', async () => {
    findMany.mockResolvedValue([compra]);
    count.mockResolvedValue(1);

    const response = await listCompras(new Request('http://localhost/api/mobile/v1/compras'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0]).toMatchObject({
      compraId: 'compra-1',
      subtotal: 125,
      impuestos: 0,
      total: 125,
    });
  });

  it('maps detail ids, line totals, and description from persisted fields', async () => {
    findFirst.mockResolvedValue(compra);

    const response = await getCompra(
      new NextRequest('http://localhost/api/mobile/v1/compras/compra-1'),
      { params: Promise.resolve({ id: 'compra-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.compra).toMatchObject({
      compraId: 'compra-1',
      subtotal: 125,
      descuento: 0,
      observaciones: 'Recepción',
      items: [{ itemId: 'item-1', subtotal: 125 }],
    });
  });
});
