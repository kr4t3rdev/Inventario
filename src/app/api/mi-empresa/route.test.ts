import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: vi.fn((handler) => (request: NextRequest, context: unknown) =>
    handler(request, context, {
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      isActive: true,
      tenantId: 'tenant-1',
      tenantRole: 'manager',
      planFeatures: { 'mi-empresa-ean13': true },
    }),
  ),
  withAuthPost: vi.fn((handler) => (request: NextRequest, context: unknown) =>
    handler(request, context, {
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      isActive: true,
      tenantId: 'tenant-1',
      tenantRole: 'manager',
      planFeatures: { 'mi-empresa-ean13': true },
    }),
  ),
}));

vi.mock('@/features/mi-empresa/services/mi-empresa-service', () => ({
  getMiEmpresaByTenant: vi.fn(),
  upsertMiEmpresa: vi.fn(),
}));

import { ActionError } from '@/lib/server-actions';
import {
  getMiEmpresaByTenant,
  upsertMiEmpresa,
} from '@/features/mi-empresa/services/mi-empresa-service';
import { GET, PUT } from './route';

describe('/api/mi-empresa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tenant-scoped mi empresa settings through a stable GET route', async () => {
    vi.mocked(getMiEmpresaByTenant).mockResolvedValue({
      nombre: 'Mi Empresa',
      usaCodigoEan13: true,
      cuentaBancariaId: 'cuenta-1',
    } as never);

    const response = await GET(new NextRequest('http://localhost/api/mi-empresa'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ nombre: 'Mi Empresa', usaCodigoEan13: true });
    expect(getMiEmpresaByTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('updates mi empresa through a stable PUT route', async () => {
    vi.mocked(upsertMiEmpresa).mockResolvedValue({
      data: { nombre: 'Mi Empresa', usaCodigoEan13: false },
      message: 'Mi Empresa updated',
    } as never);

    const response = await PUT(
      new NextRequest('http://localhost/api/mi-empresa', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nombre: 'Mi Empresa', usaCodigoEan13: false }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      data: { nombre: 'Mi Empresa', usaCodigoEan13: false },
      message: 'Mi Empresa updated',
    });
    expect(upsertMiEmpresa).toHaveBeenCalledWith({
      input: { nombre: 'Mi Empresa', usaCodigoEan13: false },
      user: expect.objectContaining({ tenantId: 'tenant-1' }),
    });
  });

  it('maps confirmation-required updates to a recoverable 409 code', async () => {
    vi.mocked(upsertMiEmpresa).mockRejectedValue(
      new ActionError('Confirmación requerida', 'CONFIRMATION_REQUIRED'),
    );

    const response = await PUT(
      new NextRequest('http://localhost/api/mi-empresa', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ usaCodigoEan13: true }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toMatchObject({
      error: 'Confirmación requerida',
      code: 'CONFIRMATION_REQUIRED',
    });
  });
});
