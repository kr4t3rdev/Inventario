import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    listaPrecio: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe('API /listas-precios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea lista válida', async () => {
    const { POST } = await import('../route');
    const { prisma } = await import('@/lib/prisma');

    (prisma.listaPrecio.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.listaPrecio.create as any).mockResolvedValue({
      id: 'lp-1',
      nombre: 'Lista Centro',
      esDefault: true,
    });

    const req = new NextRequest('http://localhost/api/listas-precios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nombre: 'Lista Centro', esDefault: true }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe('lp-1');
    expect(prisma.listaPrecio.updateMany).toHaveBeenCalled();
  });

  it('retorna 400 con payload inválido', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest('http://localhost/api/listas-precios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nombre: '' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Datos inválidos');
  });
});
