import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { createBankTransfer } = vi.hoisted(() => ({ createBankTransfer: vi.fn() }));
vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-operations-mutation-service', () => ({
  AccountingOperationsMutationService: { createBankTransfer },
}));
vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn(async () => ({ permitido: true })),
}));
vi.mock('@/lib/prisma', () => ({
  default: {
    transferenciaBancaria: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';
import { GET, POST } from '../route';

describe('api/contabilidad/transferencias route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/contabilidad/transferencias'));
    expect(response.status).toBe(401);
  });

  it('returns 403 when transferencias bancarias are disabled in the plan', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        userId: 'u-1',
        role: 'user',
        tenantRole: 'economico',
        planName: 'Básico',
        planFeatures: {
          contabilidad: true,
          'transferencias-bancarias': false,
        },
      },
    } as never);

    const response = await GET(new NextRequest('http://localhost/api/contabilidad/transferencias'));

    expect(response.status).toBe(403);
  });

  it('keeps legacy access for professional tenants while the new flag is being backfilled', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        userId: 'u-2',
        tenantId: 'tenant-pro',
        role: 'user',
        tenantRole: 'economico',
        planName: 'Profesional',
        planFeatures: {
          contabilidad: true,
        },
      },
    } as never);

    vi.mocked(prisma.transferenciaBancaria.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.transferenciaBancaria.count).mockResolvedValue(0 as never);

    const response = await GET(new NextRequest('http://localhost/api/contabilidad/transferencias'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transferencias).toEqual([]);
  });

  it('delegates transfer writes to the tenant-scoped formal writer', async () => {
    const user = {
      userId: 'u-admin', tenantId: 'tenant-a', role: 'admin', tenantRole: 'manager',
      planFeatures: { 'transferencias-bancarias': true, contabilidad: true },
    };
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    createBankTransfer.mockResolvedValue({
      transferencia: { transferenciaId: 'transfer-1' }, numeroComprobante: 'TRF-000001',
    });

    const response = await POST(new NextRequest('http://localhost/api/contabilidad/transferencias', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cuentaOrigenId: 'from', cuentaDestinoId: 'to', montoOrigen: 10, motivo: 'Rebalanceo',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.transferencia.transferenciaId).toBe('transfer-1');
    expect(createBankTransfer).toHaveBeenCalledWith({
      input: expect.objectContaining({ cuentaOrigenId: 'from', cuentaDestinoId: 'to' }),
      user,
    });
  });
});
