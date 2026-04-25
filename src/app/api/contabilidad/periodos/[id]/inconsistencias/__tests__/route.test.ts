import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { authenticateUserMock, findFirstMock, prismaMock } = vi.hoisted(() => ({
  authenticateUserMock: vi.fn(),
  findFirstMock: vi.fn(),
  prismaMock: {
    snapshotPeriodo: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: authenticateUserMock,
}));

vi.mock('@/lib/prisma', () => ({ default: prismaMock }));

describe('API /contabilidad/periodos/[id]/inconsistencias GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateUserMock.mockResolvedValue({ user: { userId: 'user-1' } });
  });

  it('devuelve inconsistencias del snapshot más reciente', async () => {
    const { GET } = await import('../route');
    prismaMock.snapshotPeriodo.findFirst.mockResolvedValue({
      snapshotId: 'snap-1',
      periodoId: 'p-1',
      inconsistenciasJson: [{ tipo: 'SALDO_NEGATIVO', entidad: 'CuentaBancaria', detalle: 'Saldo en -100' }],
      version: 1,
      createdAt: new Date(),
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/inconsistencias');
    const response = await GET(request, { params: Promise.resolve({ id: 'p-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.inconsistencias).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.version).toBe(1);
  });

  it('devuelve array vacío si inconsistenciasJson no es array', async () => {
    const { GET } = await import('../route');
    prismaMock.snapshotPeriodo.findFirst.mockResolvedValue({
      snapshotId: 'snap-1',
      periodoId: 'p-1',
      inconsistenciasJson: null,
      version: 1,
      createdAt: new Date(),
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/inconsistencias');
    const response = await GET(request, { params: Promise.resolve({ id: 'p-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.inconsistencias).toEqual([]);
    expect(data.total).toBe(0);
  });

  it('devuelve 404 si no hay snapshot', async () => {
    const { GET } = await import('../route');
    prismaMock.snapshotPeriodo.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/inconsistencias');
    const response = await GET(request, { params: Promise.resolve({ id: 'p-1' }) });
    expect(response.status).toBe(404);
  });

  it('devuelve 503 si modelo no disponible', async () => {
    const { GET } = await import('../route');
    const orig = prismaMock.snapshotPeriodo;
    (prismaMock as unknown as Record<string, unknown>).snapshotPeriodo = undefined;

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/inconsistencias');
    const response = await GET(request, { params: Promise.resolve({ id: 'p-1' }) });
    expect(response.status).toBe(503);

    prismaMock.snapshotPeriodo = orig;
  });
});