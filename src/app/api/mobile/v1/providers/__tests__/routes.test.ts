import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vendor: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { GET as listGET } from '../route';
import { POST as createPOST } from '../create/route';
import { DELETE as deleteById, GET as getById, PUT as updateById } from '../[id]/route';

const vendor = {
  vendorId: 'vendor-1',
  nombre: 'Proveedor Uno',
  contacto: 'Contacto',
  direccion: 'Calle 1',
  telefono: '555-0100',
  cuentaCUP: null,
  cuentaUSD: null,
  logo: null,
  contrato: null,
  vendorCode: 'V-001',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

function authenticated(tenantId: string | null = 'tenant-1'): void {
  vi.mocked(authenticateUser).mockResolvedValue({ user: { tenantId } } as never);
}

function unauthenticated(): void {
  vi.mocked(authenticateUser).mockResolvedValue(
    NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
  );
}

function buildRequest(path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/mobile/v1${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });

describe('mobile providers routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticated();
  });

  it('lists tenant providers as { items }', async () => {
    vi.mocked(prisma.vendor.findMany).mockResolvedValue([vendor] as never);

    const response = await listGET(buildRequest('/providers'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({ vendorId: 'vendor-1', nombre: 'Proveedor Uno' });
    expect(prisma.vendor.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1' },
    }));
  });

  it('rejects listing without tenant context', async () => {
    authenticated(null);

    const response = await listGET(buildRequest('/providers'));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'TENANT_REQUIRED' });
  });

  it('creates a provider and returns it', async () => {
    vi.mocked(prisma.vendor.create).mockResolvedValue(vendor as never);

    const response = await createPOST(buildRequest('/providers/create', { nombre: 'Proveedor Uno' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ vendorId: 'vendor-1' });
  });

  it('rejects creation without a name', async () => {
    const response = await createPOST(buildRequest('/providers/create', { nombre: '' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.vendor.create).not.toHaveBeenCalled();
  });

  it('returns a provider by id scoped to the tenant', async () => {
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue(vendor as never);

    const response = await getById(buildRequest('/providers/vendor-1'), context('vendor-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ vendorId: 'vendor-1' });
    expect(prisma.vendor.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { vendorId: 'vendor-1', tenantId: 'tenant-1' },
    }));
  });

  it('returns 404 for an unknown provider id', async () => {
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue(null);

    const response = await getById(buildRequest('/providers/missing'), context('missing'));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('updates a provider by id', async () => {
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue(vendor as never);
    vi.mocked(prisma.vendor.update).mockResolvedValue({ ...vendor, nombre: 'Nuevo' } as never);

    const response = await updateById(buildRequest('/providers/vendor-1', { nombre: 'Nuevo' }), context('vendor-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ nombre: 'Nuevo' });
  });

  it('returns 404 when updating an unknown provider', async () => {
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue(null);

    const response = await updateById(buildRequest('/providers/missing', { nombre: 'Nuevo' }), context('missing'));

    expect(response.status).toBe(404);
    expect(prisma.vendor.update).not.toHaveBeenCalled();
  });

  it('deletes a provider by id with confirmation', async () => {
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue(vendor as never);
    vi.mocked(prisma.vendor.delete).mockResolvedValue(vendor as never);

    const response = await deleteById(buildRequest('/providers/vendor-1'), context('vendor-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ id: 'vendor-1', eliminado: true });
  });

  it('returns 404 when deleting an unknown provider', async () => {
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue(null);

    const response = await deleteById(buildRequest('/providers/missing'), context('missing'));

    expect(response.status).toBe(404);
    expect(prisma.vendor.delete).not.toHaveBeenCalled();
  });

  it('propagates authentication failures without touching the database', async () => {
    unauthenticated();

    const response = await listGET(buildRequest('/providers'));

    expect(response.status).toBe(401);
    expect(prisma.vendor.findMany).not.toHaveBeenCalled();
  });
});
