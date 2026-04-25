import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { authenticateUserMock, findManyMock, countMock, prismaMock } = vi.hoisted(() => ({
  authenticateUserMock: vi.fn(),
  findManyMock: vi.fn(),
  countMock: vi.fn(),
  prismaMock: {
    eventoContable: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: authenticateUserMock }));
vi.mock('@/lib/prisma', () => ({ default: prismaMock }));

describe('API /contabilidad/eventos GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateUserMock.mockResolvedValue({ user: { userId: 'user-1' } });
    prismaMock.eventoContable.findMany.mockResolvedValue([
      {
        eventoId: 'ev-1',
        fechaOperacion: new Date('2026-04-23'),
        origenTipo: 'VENTA',
        origenId: 'venta-1',
        monto: 1000,
        naturaleza: 'INGRESO',
        estado: 'CONFIRMADO',
        lineas: [
          { lineaId: 'l-1', cuenta: 'Banco', debito: 1000, credito: 0 },
          { lineaId: 'l-2', cuenta: 'Ventas', debito: 0, credito: 1000 },
        ],
      },
    ]);
    prismaMock.eventoContable.count.mockResolvedValue(1);
  });

  it('lista eventos con líneas y total', async () => {
    const { GET } = await import('../route');
    const request = new NextRequest('http://localhost/api/contabilidad/eventos');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.eventos).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.eventos[0].lineas).toHaveLength(2);
  });

  it('filtra por origenTipo', async () => {
    const { GET } = await import('../route');
    const request = new NextRequest('http://localhost/api/contabilidad/eventos?origenTipo=VENTA');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.eventoContable.findMany).toHaveBeenCalled();
  });

  it('retorna array vacío si modelo no disponible', async () => {
    const { GET } = await import('../route');
    const orig = prismaMock.eventoContable;
    (prismaMock as unknown as Record<string, unknown>).eventoContable = undefined;

    const request = new NextRequest('http://localhost/api/contabilidad/eventos');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.eventos).toEqual([]);
    expect(data.total).toBe(0);

    prismaMock.eventoContable = orig;
  });

  it('devuelve 401 si no autenticado', async () => {
    const { GET } = await import('../route');
    authenticateUserMock.mockResolvedValue({ error: 'No autorizado', status: 401 });

    const request = new NextRequest('http://localhost/api/contabilidad/eventos');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });
});