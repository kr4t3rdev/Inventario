import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    anticipo: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  default: {
    anticipo: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/services/validate-period-write', () => ({
  validarEscrituraPeriodo: vi.fn(),
  extraerFechaDeBody: vi.fn(),
}));
vi.mock('@/lib/services/anticipos-workflow', () => ({
  createAnticipo: vi.fn(),
  isAnticipoWorkflowError: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write';
import { createAnticipo } from '@/lib/services/anticipos-workflow';
import { GET, POST } from '../route';

const user = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'manager', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { contabilidad: true },
};

describe('mobile advances route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails on list', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/advances'));
    expect(response.status).toBe(401);
  });

  it('lists anticipos scoped by tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(prisma.anticipo.findMany).mockResolvedValue([{ anticipoId: 'a1' }] as never);

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/advances'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.anticipos).toHaveLength(1);
    expect(prisma.anticipo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1' }),
    }));
  });

  it('returns 401 when auth fails on create', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await POST(new NextRequest('http://localhost/api/mobile/v1/accounting/advances', { method: 'POST' }));
    expect(response.status).toBe(401);
  });

  it('creates anticipo using tenant context and workflow', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(extraerFechaDeBody).mockReturnValue(null as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true } as never);
    vi.mocked(createAnticipo).mockResolvedValue({ anticipoId: 'a1' } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma));

    const response = await POST(new NextRequest('http://localhost/api/mobile/v1/accounting/advances', {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'COBRO',
        contratoId: 'ctr-1',
        clienteId: 'cli-1',
        monto: 100,
        moneda: 'CUP',
      }),
      headers: { 'content-type': 'application/json' },
    }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.anticipo.anticipoId).toBe('a1');
    expect(createAnticipo).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tenantId: 'tenant-1', usuarioId: 'u1' }));
  });
});
