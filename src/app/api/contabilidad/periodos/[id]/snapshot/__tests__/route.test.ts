import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { authenticateUserMock, findFirstMock, findManyMock, prismaMock } = vi.hoisted(() => ({
  authenticateUserMock: vi.fn(),
  findFirstMock: vi.fn(),
  findManyMock: vi.fn(),
  prismaMock: {
    snapshotPeriodo: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: authenticateUserMock,
}));

vi.mock('@/lib/prisma', () => ({ default: prismaMock }));

describe('API /contabilidad/periodos/[id]/snapshot GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateUserMock.mockResolvedValue({ user: { userId: 'user-1' } });
  });

  it('devuelve el snapshot más reciente por defecto', async () => {
    const { GET } = await import('../route');
    prismaMock.snapshotPeriodo.findFirst.mockResolvedValue({
      snapshotId: 'snap-1',
      periodoId: 'p-1',
      version: 2,
      baseCajaJson: { saldoFinal: 500 },
      baseDevengoJson: null,
      inconsistenciasJson: [],
      resumenJson: { totalVentas: 1000 },
      hashIntegridad: 'abc123',
      createdAt: new Date().toISOString(),
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/snapshot');
    const response = await GET(request, { params: Promise.resolve({ id: 'p-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.snapshotId).toBe('snap-1');
    expect(data.version).toBe(2);
  });

  it('devuelve todas las versiones con ?all=true', async () => {
    const { GET } = await import('../route');
    prismaMock.snapshotPeriodo.findMany.mockResolvedValue([
      { snapshotId: 'snap-2', periodoId: 'p-1', version: 2 },
      { snapshotId: 'snap-1', periodoId: 'p-1', version: 1 },
    ]);

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/snapshot?all=true');
    const response = await GET(request, { params: Promise.resolve({ id: 'p-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.snapshots).toHaveLength(2);
    expect(data.total).toBe(2);
  });

  it('devuelve 404 si no hay snapshot', async () => {
    const { GET } = await import('../route');
    prismaMock.snapshotPeriodo.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/snapshot');
    const response = await GET(request, { params: Promise.resolve({ id: 'p-1' }) });
    expect(response.status).toBe(404);
  });

  it('devuelve 503 si modelo no disponible', async () => {
    const { GET } = await import('../route');
    const orig = prismaMock.snapshotPeriodo;
    (prismaMock as unknown as Record<string, unknown>).snapshotPeriodo = undefined;

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/snapshot');
    const response = await GET(request, { params: Promise.resolve({ id: 'p-1' }) });
    expect(response.status).toBe(503);

    prismaMock.snapshotPeriodo = orig;
  });
});