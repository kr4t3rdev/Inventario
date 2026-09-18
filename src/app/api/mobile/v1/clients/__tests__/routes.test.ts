import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: {
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

const cliente = {
  clienteId: 'cliente-1',
  nombre: 'Cliente Uno',
  direccion: 'Calle 1',
  telefono: '555-0100',
  logoUrl: null,
  numeroCuentaCUP: null,
  numeroCuentaUSD: null,
  numeroContrato: null,
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

describe('mobile clients routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticated();
  });

  it('lists tenant clients as { items }', async () => {
    vi.mocked(prisma.cliente.findMany).mockResolvedValue([cliente] as never);

    const response = await listGET(buildRequest('/clients'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({ clienteId: 'cliente-1', nombre: 'Cliente Uno' });
    expect(prisma.cliente.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1' },
    }));
  });

  it('rejects listing without tenant context', async () => {
    authenticated(null);

    const response = await listGET(buildRequest('/clients'));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'TENANT_REQUIRED' });
  });

  it('creates a client and returns it', async () => {
    vi.mocked(prisma.cliente.create).mockResolvedValue(cliente as never);

    const response = await createPOST(buildRequest('/clients/create', { nombre: 'Cliente Uno' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ clienteId: 'cliente-1' });
  });

  it('rejects creation without a name', async () => {
    const response = await createPOST(buildRequest('/clients/create', { nombre: '' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.cliente.create).not.toHaveBeenCalled();
  });

  it('returns a client by id scoped to the tenant', async () => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue(cliente as never);

    const response = await getById(buildRequest('/clients/cliente-1'), context('cliente-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ clienteId: 'cliente-1' });
    expect(prisma.cliente.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { clienteId: 'cliente-1', tenantId: 'tenant-1' },
    }));
  });

  it('returns 404 for an unknown client id', async () => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);

    const response = await getById(buildRequest('/clients/missing'), context('missing'));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('updates a client by id', async () => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue(cliente as never);
    vi.mocked(prisma.cliente.update).mockResolvedValue({ ...cliente, nombre: 'Nuevo' } as never);

    const response = await updateById(buildRequest('/clients/cliente-1', { nombre: 'Nuevo' }), context('cliente-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ nombre: 'Nuevo' });
  });

  it('returns 404 when updating an unknown client', async () => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);

    const response = await updateById(buildRequest('/clients/missing', { nombre: 'Nuevo' }), context('missing'));

    expect(response.status).toBe(404);
    expect(prisma.cliente.update).not.toHaveBeenCalled();
  });

  it('deletes a client by id with confirmation', async () => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue(cliente as never);
    vi.mocked(prisma.cliente.delete).mockResolvedValue(cliente as never);

    const response = await deleteById(buildRequest('/clients/cliente-1'), context('cliente-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ id: 'cliente-1', eliminado: true });
  });

  it('returns 404 when deleting an unknown client', async () => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);

    const response = await deleteById(buildRequest('/clients/missing'), context('missing'));

    expect(response.status).toBe(404);
    expect(prisma.cliente.delete).not.toHaveBeenCalled();
  });

  it('propagates authentication failures without touching the database', async () => {
    unauthenticated();

    const response = await listGET(buildRequest('/clients'));

    expect(response.status).toBe(401);
    expect(prisma.cliente.findMany).not.toHaveBeenCalled();
  });
});
