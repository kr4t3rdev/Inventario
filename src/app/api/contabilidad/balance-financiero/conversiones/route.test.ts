import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NextRequest } from 'next/server';

const captureMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => ({
  withAuthPost: (handler: Function) => handler,
}));

vi.mock('@/lib/auth-middleware', () => authMock);
vi.mock('@/features/contabilidad/services/fx-evidence-service', () => ({
  fxEvidenceService: { captureEligible: captureMock },
}));

describe('POST /api/contabilidad/balance-financiero/conversiones', () => {
  beforeEach(() => {
    captureMock.mockReset();
  });

  it('valida el corte, autoriza contabilidad y no expone evidencia sensible', async () => {
    captureMock.mockResolvedValue({
      capturedCount: 1,
      idempotentCount: 0,
      skippedCount: 0,
      skipped: [],
    });
    const { POST } = await import('./route');
    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/balance-financiero/conversiones', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      }),
      undefined,
      {
        userId: 'manager-1',
        name: 'Manager',
        email: 'manager@example.com',
        role: 'user',
        isActive: true,
        tenantId: 'tenant-1',
        tenantRole: 'manager',
        planFeatures: { contabilidad: true },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        boundaryAt: expect.any(String),
        capturedCount: 1,
        idempotentCount: 0,
        skippedCount: 0,
        skipped: [],
      },
    });
    expect(captureMock).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      boundaryAt: expect.any(Date),
    });
  });

  it('rechaza un usuario sin tenant o sin capacidad contable', async () => {
    const { POST } = await import('./route');
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero/conversiones', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request, undefined, {
      userId: 'user-1',
      name: 'User',
      email: 'user@example.com',
      role: 'user',
      isActive: true,
      tenantRole: 'dependiente',
      planFeatures: { contabilidad: false },
    });

    expect(response.status).toBe(403);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('rechaza un cuerpo JSON inválido antes de mutar evidencia', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new NextRequest('http://localhost/api/contabilidad/balance-financiero/conversiones', {
        method: 'POST',
        body: '{',
        headers: { 'content-type': 'application/json' },
      }),
      undefined,
      {
        userId: 'manager-1',
        name: 'Manager',
        email: 'manager@example.com',
        role: 'user',
        isActive: true,
        tenantId: 'tenant-1',
        tenantRole: 'manager',
        planFeatures: { contabilidad: true },
      },
    );

    expect(response.status).toBe(400);
    expect(captureMock).not.toHaveBeenCalled();
  });
});
