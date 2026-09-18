import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  default: {},
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { GET } from '../route';

describe('api/contabilidad/transferencias/comprobante/[id] route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/transferencias/comprobante/t-1'),
      { params: Promise.resolve({ id: 't-1' }) },
    );
    expect(response.status).toBe(401);
  });
});
