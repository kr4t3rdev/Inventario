import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authenticateUserMock = vi.hoisted(() => vi.fn());
const persistDailyCloseMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: authenticateUserMock,
}));

vi.mock('@/lib/services/cierre-diario-persistence-service', () => ({
  persistDailyClose: persistDailyCloseMock,
  isCierreDiarioPersistenceUnavailableError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'code' in (error as Record<string, unknown>) &&
        (error as Record<string, unknown>).code === 'CIERRE_DIARIO_PERSISTENCE_UNAVAILABLE'
    ),
  isDailyPeriodNotFoundError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'code' in (error as Record<string, unknown>) &&
        (error as Record<string, unknown>).code === 'PERIODO_DIARIO_NO_ENCONTRADO'
    ),
}));

describe('API /contabilidad/periodos/cierre-diario POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateUserMock.mockResolvedValue({
      user: { userId: 'user-1' },
    });
  });

  it('crea el cierre diario y devuelve 201', async () => {
    const { POST } = await import('../route');
    persistDailyCloseMock.mockResolvedValue({
      wasCreated: true,
      periodo: { periodoId: 'periodo-1', codigo: 'D-2026-04-23', tipo: 'DIARIO' },
      snapshot: { snapshotId: 'snapshot-1', periodoId: 'periodo-1', version: 1 },
      resumen: { totalIngresos: 1200, totalGastos: 580, diferencia: 620 },
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/cierre-diario', {
      method: 'POST',
      headers: {
        authorization: 'Bearer fake.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ fecha: '2026-04-23T10:00:00.000Z' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe('Cierre diario creado exitosamente');
    expect(data.wasCreated).toBe(true);
  });

  it('responde 200 cuando el snapshot del cierre ya existía', async () => {
    const { POST } = await import('../route');
    persistDailyCloseMock.mockResolvedValue({
      wasCreated: false,
      periodo: { periodoId: 'periodo-1', codigo: 'D-2026-04-23', tipo: 'DIARIO' },
      snapshot: { snapshotId: 'snapshot-1', periodoId: 'periodo-1', version: 1 },
      resumen: { totalIngresos: 1200, totalGastos: 580, diferencia: 620 },
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/cierre-diario', {
      method: 'POST',
      headers: {
        authorization: 'Bearer fake.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('El cierre diario ya existía para esa fecha');
  });

  it('rechaza fecha inválida con 400', async () => {
    const { POST } = await import('../route');

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/cierre-diario', {
      method: 'POST',
      headers: {
        authorization: 'Bearer fake.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ fecha: 'mal' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('FECHA_INVALIDA');
  });

  it('retorna 404 si no existe período diario para la fecha', async () => {
    const { POST } = await import('../route');
    persistDailyCloseMock.mockRejectedValue({
      message: 'No existe un período diario abierto para D-2026-04-23.',
      status: 404,
      code: 'PERIODO_DIARIO_NO_ENCONTRADO',
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/cierre-diario', {
      method: 'POST',
      headers: {
        authorization: 'Bearer fake.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe('PERIODO_DIARIO_NO_ENCONTRADO');
  });
});
