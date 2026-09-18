import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  default: {},
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { POST } from '../route';

describe('api/contabilidad/transferencias/validar route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/transferencias/validar', {
        method: 'POST',
        body: JSON.stringify({
          cuentaOrigenId: 'co-1',
          cuentaDestinoId: 'cd-1',
          monto: 100,
          motivo: 'Prueba',
        }),
      }),
    );
    expect(response.status).toBe(401);
  });
});
