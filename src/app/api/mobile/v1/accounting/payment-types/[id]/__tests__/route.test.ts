import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: { tipoPago: { findFirst: vi.fn() }, cuentaBancaria: { findFirst: vi.fn() } } }));

import { authenticateUser } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';
import { GET } from '../route';

describe('mobile accounting payment type detail route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a tenant-scoped payment type and default account information', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: { tenantId: 'tenant-1' } } as never);
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue({ tipoId: 'tp-1', cuentaDefecto: 'ba-1' } as never);
    vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue({ cuentaId: 'ba-1' } as never);

    const response = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'tp-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cuentaDefectoInfo.cuentaId).toBe('ba-1');
    expect(prisma.tipoPago.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { tipoId: 'tp-1', tenantId: 'tenant-1' } }));
  });
});
