/**
 * @description Tests de activación de contratos por firma (CTF-3): una firma
 *              FIRMADA sobre un contrato APROBADO lo transiciona a ACTIVO vía
 *              la máquina de estados, con fechaFirma asignada por el servidor.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    contratoFirma: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    tenantMembership: { findFirst: vi.fn() },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { createContratoFirmaHandler } from '@/features/contratos/api/handlers';

const user = {
  userId: 'user-a',
  tenantId: 'tenant-A',
  role: 'admin',
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

function req(body: Record<string, unknown>) {
  return new NextRequestShim('http://localhost/api/contratos/ct-1/firmas', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never;
}

function params() {
  return { params: Promise.resolve({ id: 'ct-1' }) };
}

const firmaCreada = { firmaId: 'f-1', contratoId: 'ct-1', estado: 'FIRMADA' };

describe('CTF-3 activación de contrato por firma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({ membershipId: 'm-1' } as never);
    vi.mocked(prisma.contratoFirma.create).mockResolvedValue(firmaCreada as never);
    vi.mocked(prisma.contrato.update).mockResolvedValue({ contratoId: 'ct-1', estado: 'ACTIVO' } as never);
  });

  it('firma FIRMADA sobre APROBADO transiciona a ACTIVO con fechaFirma del servidor', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', tenantId: 'tenant-A', estado: 'APROBADO' } as never);

    const res = await createContratoFirmaHandler(
      req({ firmanteId: 'user-9', tipoFirma: 'CLIENTE', estado: 'FIRMADA', fechaFirma: '1999-01-01T00:00:00.000Z' }),
      params(),
    ) as Response;

    expect(res.status).toBe(200);
    expect(prisma.contrato.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contratoId: 'ct-1' },
        data: { estado: 'ACTIVO' },
      }),
    );
    expect(prisma.contratoFirma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'FIRMADA', fechaFirma: expect.any(Date) }),
      }),
    );
  });

  it('el payload no puede imponer la fechaFirma de una firma FIRMADA', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', tenantId: 'tenant-A', estado: 'BORRADOR' } as never);

    await createContratoFirmaHandler(
      req({ firmanteId: 'user-9', tipoFirma: 'CLIENTE', estado: 'FIRMADA', fechaFirma: '1999-01-01T00:00:00.000Z' }),
      params(),
    );

    const call = vi.mocked(prisma.contratoFirma.create).mock.calls[0][0] as { data: { fechaFirma: Date | null } };
    expect(call.data.fechaFirma).not.toBeNull();
    expect((call.data.fechaFirma as Date).toISOString()).not.toBe('1999-01-01T00:00:00.000Z');
    expect(prisma.contrato.update).not.toHaveBeenCalled();
  });

  it('firma FIRMADA sobre contrato no APROBADO se registra sin transición', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', tenantId: 'tenant-A', estado: 'BORRADOR' } as never);

    const res = await createContratoFirmaHandler(
      req({ firmanteId: 'user-9', tipoFirma: 'CLIENTE', estado: 'FIRMADA' }),
      params(),
    ) as Response;

    expect(res.status).toBe(200);
    expect(prisma.contratoFirma.create).toHaveBeenCalled();
    expect(prisma.contrato.update).not.toHaveBeenCalled();
  });

  it('firma PENDIENTE no cambia el estado del contrato', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', tenantId: 'tenant-A', estado: 'APROBADO' } as never);

    await createContratoFirmaHandler(
      req({ firmanteId: 'user-9', tipoFirma: 'CLIENTE', estado: 'PENDIENTE' }),
      params(),
    );

    expect(prisma.contratoFirma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'PENDIENTE', fechaFirma: null }),
      }),
    );
    expect(prisma.contrato.update).not.toHaveBeenCalled();
  });

  it('estado de firma fuera de PENDIENTE|FIRMADA|RECHAZADA responde 400', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', tenantId: 'tenant-A', estado: 'APROBADO' } as never);

    const res = await createContratoFirmaHandler(
      req({ firmanteId: 'user-9', tipoFirma: 'CLIENTE', estado: 'ACTIVA' }),
      params(),
    ) as Response;

    expect(res.status).toBe(400);
    expect(prisma.contratoFirma.create).not.toHaveBeenCalled();
  });
});
