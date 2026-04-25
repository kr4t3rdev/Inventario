import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authenticateUserMock = vi.hoisted(() => vi.fn());
const listPeriodosMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: authenticateUserMock,
}));

vi.mock('@/lib/services/listar-periodos-service', () => ({
  listPeriodos: listPeriodosMock,
  isListadoPeriodosPersistenceUnavailableError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'code' in (error as Record<string, unknown>) &&
        (error as Record<string, unknown>).code === 'LISTADO_PERIODOS_PERSISTENCE_UNAVAILABLE'
    ),
}));

describe('API /contabilidad/periodos GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateUserMock.mockResolvedValue({
      user: { userId: 'user-1' },
    });
  });

  it('lista períodos filtrados y devuelve 200', async () => {
    const { GET } = await import('../route');
    listPeriodosMock.mockResolvedValue({
      items: [
        {
          periodoId: 'mes-1',
          codigo: 'M-2026-04',
          tipo: 'MENSUAL',
          estado: 'ABIERTO',
          blockers: [],
        },
      ],
      meta: { total: 1, filtros: { tipo: 'MENSUAL' } },
    });

    const request = new NextRequest(
      'http://localhost/api/contabilidad/periodos?tipo=MENSUAL&estado=ABIERTO'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(listPeriodosMock).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'MENSUAL', estado: 'ABIERTO' })
    );
  }, 10000);

  it('rechaza filtros de fecha inválidos con 400', async () => {
    const { GET } = await import('../route');

    const request = new NextRequest(
      'http://localhost/api/contabilidad/periodos?fechaDesde=mal'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('FECHA_INVALIDA');
  });

  it('rechaza tipo inválido con 400', async () => {
    const { GET } = await import('../route');

    const request = new NextRequest(
      'http://localhost/api/contabilidad/periodos?tipo=TRIMESTRAL'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('TIPO_PERIODO_INVALIDO');
  });

  it('retorna 503 si el runtime Prisma no soporta períodos', async () => {
    const { GET } = await import('../route');
    listPeriodosMock.mockRejectedValue({
      message: 'El runtime Prisma actual no expone PeriodoContable.',
      status: 503,
      code: 'LISTADO_PERIODOS_PERSISTENCE_UNAVAILABLE',
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.code).toBe('LISTADO_PERIODOS_PERSISTENCE_UNAVAILABLE');
  });
});
