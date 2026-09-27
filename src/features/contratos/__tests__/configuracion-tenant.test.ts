/**
 * @description Tests de la configuración de contratos por tenant (CTF-5):
 *              GET con upsert perezoso, PUT validado 1..365 y aislamiento por
 *              tenant sobre el modelo ConfiguracionContratos.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => {
  const configuracionContratos = { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() };
  return {
    default: { configuracionContratos },
    prisma: { configuracionContratos },
  };
});

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
  withAuth: (handler: (req: unknown, ctx: unknown) => unknown) => (req: unknown, ctx: unknown) => handler(req, ctx),
}));

import { prisma } from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { GET, PUT } from '@/app/api/configuracion/sistema/contratos/route';

const userTenantA = {
  userId: 'user-a',
  tenantId: 'tenant-A',
  role: 'user',
  name: 'User A',
  email: 'a@test.com',
  isActive: true,
} as never;

class NextRequestShim {
  nextUrl: URL;
  private _init?: RequestInit;
  constructor(url: string, init?: RequestInit) {
    this.nextUrl = new URL(url);
    this._init = init;
  }
  async json() {
    return JSON.parse((this._init?.body as string) ?? '{}');
  }
  async formData() {
    return (this._init as any)?.formData ?? { get: () => null };
  }
}

describe('CTF-5 configuración de contratos por tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateUser).mockResolvedValue({ user: userTenantA } as never);
  });

  describe('GET', () => {
    it('crea la fila default con upsert perezoso y responde diasAvisoVencimiento', async () => {
      vi.mocked(prisma.configuracionContratos.upsert).mockResolvedValue({
        configId: 'cfg-1',
        tenantId: 'tenant-A',
        diasAvisoVencimiento: 30,
      } as never);

      const res = await GET(new NextRequestShim('http://localhost/api/configuracion/sistema/contratos') as never) as Response;
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.diasAvisoVencimiento).toBe(30);
      expect(prisma.configuracionContratos.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-A' },
          create: expect.objectContaining({ tenantId: 'tenant-A' }),
        }),
      );
    });

    it('devuelve la fila existente del tenant sin crear otra', async () => {
      vi.mocked(prisma.configuracionContratos.upsert).mockResolvedValue({
        configId: 'cfg-1',
        tenantId: 'tenant-A',
        diasAvisoVencimiento: 15,
      } as never);

      const res = await GET(new NextRequestShim('http://localhost/api/configuracion/sistema/contratos') as never) as Response;
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.diasAvisoVencimiento).toBe(15);
    });

    it('responde 403 cuando el usuario no tiene tenant', async () => {
      vi.mocked(authenticateUser).mockResolvedValue({
        user: { ...userTenantA, tenantId: null },
      } as never);

      const res = await GET(new NextRequestShim('http://localhost/api/configuracion/sistema/contratos') as never) as Response;

      expect(res.status).toBe(403);
      expect(prisma.configuracionContratos.upsert).not.toHaveBeenCalled();
    });
  });

  describe('PUT', () => {
    it('valida 1..365 y hace upsert por tenant', async () => {
      vi.mocked(prisma.configuracionContratos.upsert).mockResolvedValue({
        configId: 'cfg-1',
        tenantId: 'tenant-A',
        diasAvisoVencimiento: 15,
      } as never);

      const res = await PUT(new NextRequestShim('http://localhost/api/configuracion/sistema/contratos', {
        method: 'PUT',
        body: JSON.stringify({ diasAvisoVencimiento: 15 }),
      }) as never) as Response;
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.diasAvisoVencimiento).toBe(15);
      expect(prisma.configuracionContratos.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-A' },
          update: expect.objectContaining({ diasAvisoVencimiento: 15 }),
          create: expect.objectContaining({ tenantId: 'tenant-A', diasAvisoVencimiento: 15 }),
        }),
      );
    });

    it('rechaza valores fuera de 1..365 con 400', async () => {
      const res = await PUT(new NextRequestShim('http://localhost/api/configuracion/sistema/contratos', {
        method: 'PUT',
        body: JSON.stringify({ diasAvisoVencimiento: 400 }),
      }) as never) as Response;

      expect(res.status).toBe(400);
      expect(prisma.configuracionContratos.upsert).not.toHaveBeenCalled();
    });

    it('sin tenant responde 403', async () => {
      vi.mocked(authenticateUser).mockResolvedValue({
        user: { ...userTenantA, tenantId: null },
      } as never);

      const res = await PUT(new NextRequestShim('http://localhost/api/configuracion/sistema/contratos', {
        method: 'PUT',
        body: JSON.stringify({ diasAvisoVencimiento: 15 }),
      }) as never) as Response;

      expect(res.status).toBe(403);
    });
  });

  describe('aislamiento', () => {
    it('un tenant solo lee y escribe su propia fila', async () => {
      vi.mocked(prisma.configuracionContratos.upsert).mockResolvedValue({
        configId: 'cfg-a',
        tenantId: 'tenant-A',
        diasAvisoVencimiento: 15,
      } as never);

      await GET(new NextRequestShim('http://localhost/api/configuracion/sistema/contratos') as never);
      await PUT(new NextRequestShim('http://localhost/api/configuracion/sistema/contratos', {
        method: 'PUT',
        body: JSON.stringify({ diasAvisoVencimiento: 15 }),
      }) as never);

      expect(prisma.configuracionContratos.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-A' } }),
      );
    });
  });
});
