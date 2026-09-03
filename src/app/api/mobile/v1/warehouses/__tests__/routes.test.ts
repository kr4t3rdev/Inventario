import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    almacen: {
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

const almacen = {
  almacenId: 'almacen-1',
  nombre: 'Almacén Central',
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

describe('mobile warehouses routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticated();
  });

  it('lists tenant warehouses as { items }', async () => {
    vi.mocked(prisma.almacen.findMany).mockResolvedValue([almacen] as never);

    const response = await listGET(buildRequest('/warehouses'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({ almacenId: 'almacen-1', nombre: 'Almacén Central' });
    expect(prisma.almacen.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1' },
    }));
  });

  it('rejects listing without tenant context', async () => {
    authenticated(null);

    const response = await listGET(buildRequest('/warehouses'));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'TENANT_REQUIRED' });
  });

  it('creates a warehouse and returns it', async () => {
    vi.mocked(prisma.almacen.create).mockResolvedValue(almacen as never);

    const response = await createPOST(buildRequest('/warehouses/create', { nombre: 'Almacén Central' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ almacenId: 'almacen-1' });
  });

  it('rejects creation without a name', async () => {
    const response = await createPOST(buildRequest('/warehouses/create', { nombre: '' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.almacen.create).not.toHaveBeenCalled();
  });

  it('returns a warehouse by id scoped to the tenant', async () => {
    vi.mocked(prisma.almacen.findFirst).mockResolvedValue(almacen as never);

    const response = await getById(buildRequest('/warehouses/almacen-1'), context('almacen-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ almacenId: 'almacen-1' });
    expect(prisma.almacen.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { almacenId: 'almacen-1', tenantId: 'tenant-1' },
    }));
  });

  it('returns 404 for an unknown warehouse id', async () => {
    vi.mocked(prisma.almacen.findFirst).mockResolvedValue(null);

    const response = await getById(buildRequest('/warehouses/missing'), context('missing'));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('updates a warehouse by id', async () => {
    vi.mocked(prisma.almacen.findFirst).mockResolvedValue(almacen as never);
    vi.mocked(prisma.almacen.update).mockResolvedValue({ ...almacen, nombre: 'Nuevo' } as never);

    const response = await updateById(buildRequest('/warehouses/almacen-1', { nombre: 'Nuevo' }), context('almacen-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ nombre: 'Nuevo' });
  });

  it('returns 404 when updating an unknown warehouse', async () => {
    vi.mocked(prisma.almacen.findFirst).mockResolvedValue(null);

    const response = await updateById(buildRequest('/warehouses/missing', { nombre: 'Nuevo' }), context('missing'));

    expect(response.status).toBe(404);
    expect(prisma.almacen.update).not.toHaveBeenCalled();
  });

  it('deletes a warehouse by id with confirmation', async () => {
    vi.mocked(prisma.almacen.findFirst).mockResolvedValue(almacen as never);
    vi.mocked(prisma.almacen.delete).mockResolvedValue(almacen as never);

    const response = await deleteById(buildRequest('/warehouses/almacen-1'), context('almacen-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ id: 'almacen-1', eliminado: true });
  });

  it('returns 404 when deleting an unknown warehouse', async () => {
    vi.mocked(prisma.almacen.findFirst).mockResolvedValue(null);

    const response = await deleteById(buildRequest('/warehouses/missing'), context('missing'));

    expect(response.status).toBe(404);
    expect(prisma.almacen.delete).not.toHaveBeenCalled();
  });

  it('propagates authentication failures without touching the database', async () => {
    unauthenticated();

    const response = await listGET(buildRequest('/warehouses'));

    expect(response.status).toBe(401);
    expect(prisma.almacen.findMany).not.toHaveBeenCalled();
  });
});
