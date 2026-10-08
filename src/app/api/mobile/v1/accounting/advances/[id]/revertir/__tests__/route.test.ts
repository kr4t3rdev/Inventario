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
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-1'),
  requireFeature: vi.fn(),
  requirePermission: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';
import { requireFeature, requirePermission } from '@/lib/services/tenant-scope';
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write';
import { reverseAnticipo } from '@/lib/services/anticipos-workflow';
import { POST } from '../route';

const user = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'manager', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { anticipos: true },
};

describe('mobile advance revert route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects manual reversal and directs callers to the document workflow', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);

    const response = await POST(new NextRequest('http://localhost/api/mobile/v1/accounting/advances/a1/revertir', {
      method: 'POST',
      body: JSON.stringify({
        documentoDestinoId: 'doc-1',
        montoReverso: 100,
      }),
      headers: { 'content-type': 'application/json' },
    }), { params: Promise.resolve({ id: 'a1' }) } as never);

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('DOCUMENT_WORKFLOW_REQUIRED');
    expect(requireFeature).toHaveBeenCalledWith(user, 'anticipos', expect.any(String));
    expect(requirePermission).toHaveBeenCalledWith(
      user, 'financiero.contabilidad.acceder', expect.any(String),
    );
    expect(prisma.anticipo.findUnique).not.toHaveBeenCalled();
    expect(reverseAnticipo).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
