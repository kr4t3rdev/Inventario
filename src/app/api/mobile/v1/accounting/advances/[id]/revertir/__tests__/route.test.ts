import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    anticipo: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  default: {
    anticipo: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/services/validate-period-write', () => ({ validarEscrituraPeriodo: vi.fn(), extraerFechaDeBody: vi.fn() }));
vi.mock('@/lib/services/anticipos-workflow', () => ({ reverseAnticipo: vi.fn(), isAnticipoWorkflowError: vi.fn() }));

import { authenticateUser } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write';
import { reverseAnticipo } from '@/lib/services/anticipos-workflow';
import { POST } from '../route';

const user = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'manager', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { contabilidad: true },
};

describe('mobile advance revert route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reverts anticipo', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(prisma.anticipo.findUnique).mockResolvedValue({ tenantId: 'tenant-1' } as never);
    vi.mocked(extraerFechaDeBody).mockReturnValue(null as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true } as never);
    vi.mocked(reverseAnticipo).mockResolvedValue({ anticipoId: 'a1' } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma));

    const response = await POST(new NextRequest('http://localhost/api/mobile/v1/accounting/advances/a1/revertir', {
      method: 'POST',
      body: JSON.stringify({
        documentoDestinoId: 'doc-1',
        montoReverso: 100,
      }),
      headers: { 'content-type': 'application/json' },
    }), { params: Promise.resolve({ id: 'a1' }) } as never);

    expect(response.status).toBe(200);
    expect(reverseAnticipo).toHaveBeenCalled();
  });
});
