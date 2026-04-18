import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  withAuth: (handler: any) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    puntoDeVenta: {
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    listaPrecio: {
      delete: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('API /listas-precios/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza eliminar lista en uso', async () => {
    const { DELETE } = await import('../route');
    const { prisma } = await import('@/lib/prisma');
    (prisma.puntoDeVenta.count as any).mockResolvedValue(2);
    (prisma.puntoDeVenta.findFirst as any).mockResolvedValue({
      pvId: 'pv-1',
      nombre: 'PV Centro',
    });

    const res = await DELETE(new Request('http://localhost'), { params: { id: 'lp-1' } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('No se puede eliminar');
  });

  it('permite marcar lista como default y desmarcar otras', async () => {
    const { PUT } = await import('../route');
    const { prisma } = await import('@/lib/prisma');
    (prisma.listaPrecio.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.listaPrecio.update as any).mockResolvedValue({
      id: 'lp-2',
      nombre: 'Nueva Default',
      esDefault: true,
    });

    const req = new NextRequest('http://localhost/api/listas-precios/lp-2', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ esDefault: true }),
    });

    const res = await PUT(req as any, { params: { id: 'lp-2' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.esDefault).toBe(true);
    expect(prisma.listaPrecio.updateMany).toHaveBeenCalled();
  });
});
