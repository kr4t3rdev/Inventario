/**
 * @description Tests de activación de contratos por firma (CTF-3): una firma
 *              FIRMADA sobre un contrato APROBADO lo transiciona a ACTIVO vía
 *              la máquina de estados, con fechaFirma asignada por el servidor.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Transacción interactiva (B-2): el helper relee el estado y hace un claim
// condicional dentro de la misma transacción.
const mockTx = vi.hoisted(() => ({
  contrato: { findFirst: vi.fn(), updateMany: vi.fn() },
  contratoFirma: { create: vi.fn() },
}));

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
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
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
    vi.mocked(mockTx.contratoFirma.create).mockResolvedValue(firmaCreada as never);
    vi.mocked(mockTx.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', estado: 'APROBADO' } as never);
    vi.mocked(mockTx.contrato.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  it('firma FIRMADA sobre APROBADO transiciona a ACTIVO con fechaFirma del servidor', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', tenantId: 'tenant-A', estado: 'APROBADO' } as never);

    const res = await createContratoFirmaHandler(
      req({ firmanteId: 'user-9', tipoFirma: 'CLIENTE', estado: 'FIRMADA', fechaFirma: '1999-01-01T00:00:00.000Z' }),
      params(),
    ) as Response;

    expect(res.status).toBe(200);
    expect(mockTx.contrato.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ contratoId: 'ct-1', estado: 'APROBADO' }),
        data: { estado: 'ACTIVO' },
      }),
    );
    expect(mockTx.contratoFirma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'FIRMADA', fechaFirma: expect.any(Date) }),
      }),
    );
  });

  it('el payload no puede imponer la fechaFirma de una firma FIRMADA', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', tenantId: 'tenant-A', estado: 'BORRADOR' } as never);
    vi.mocked(mockTx.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', estado: 'BORRADOR' } as never);

    await createContratoFirmaHandler(
      req({ firmanteId: 'user-9', tipoFirma: 'CLIENTE', estado: 'FIRMADA', fechaFirma: '1999-01-01T00:00:00.000Z' }),
      params(),
    );

    const call = vi.mocked(mockTx.contratoFirma.create).mock.calls[0][0] as { data: { fechaFirma: Date | null } };
    expect(call.data.fechaFirma).not.toBeNull();
    expect((call.data.fechaFirma as Date).toISOString()).not.toBe('1999-01-01T00:00:00.000Z');
    expect(mockTx.contrato.updateMany).not.toHaveBeenCalled();
  });

  it('firma FIRMADA sobre contrato no APROBADO se registra sin transición', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', tenantId: 'tenant-A', estado: 'BORRADOR' } as never);
    vi.mocked(mockTx.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', estado: 'BORRADOR' } as never);

    const res = await createContratoFirmaHandler(
      req({ firmanteId: 'user-9', tipoFirma: 'CLIENTE', estado: 'FIRMADA' }),
      params(),
    ) as Response;

    expect(res.status).toBe(200);
    expect(mockTx.contratoFirma.create).toHaveBeenCalled();
    expect(mockTx.contrato.updateMany).not.toHaveBeenCalled();
  });

  it('firma PENDIENTE no cambia el estado del contrato', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', tenantId: 'tenant-A', estado: 'APROBADO' } as never);

    await createContratoFirmaHandler(
      req({ firmanteId: 'user-9', tipoFirma: 'CLIENTE', estado: 'PENDIENTE' }),
      params(),
    );

    expect(mockTx.contratoFirma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'PENDIENTE', fechaFirma: null }),
      }),
    );
    expect(mockTx.contrato.updateMany).not.toHaveBeenCalled();
  });

  it('estado de firma fuera de PENDIENTE|FIRMADA|RECHAZADA responde 400', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', tenantId: 'tenant-A', estado: 'APROBADO' } as never);

    const res = await createContratoFirmaHandler(
      req({ firmanteId: 'user-9', tipoFirma: 'CLIENTE', estado: 'ACTIVA' }),
      params(),
    ) as Response;

    expect(res.status).toBe(400);
    expect(mockTx.contratoFirma.create).not.toHaveBeenCalled();
  });

  it('una anulación concurrente no se revive: la firma se registra sin transición (B-2)', async () => {
    vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', tenantId: 'tenant-A', estado: 'APROBADO' } as never);
    vi.mocked(mockTx.contrato.findFirst).mockResolvedValue({ contratoId: 'ct-1', estado: 'APROBADO' } as never);
    // El contrato fue anulado entre la relectura y el claim: 0 filas afectadas.
    vi.mocked(mockTx.contrato.updateMany).mockResolvedValue({ count: 0 } as never);

    const res = await createContratoFirmaHandler(
      req({ firmanteId: 'user-9', tipoFirma: 'CLIENTE', estado: 'FIRMADA' }),
      params(),
    ) as Response;

    expect(res.status).toBe(200);
    expect(mockTx.contratoFirma.create).toHaveBeenCalled();
    expect(mockTx.contrato.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ contratoId: 'ct-1', estado: 'APROBADO' }),
        data: { estado: 'ACTIVO' },
      }),
    );
  });
});
