import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authenticateUserMock = vi.hoisted(() => vi.fn());
const persistAnnualCloseMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: authenticateUserMock,
}));

vi.mock('@/lib/services/cierre-anual-persistence-service', () => ({
  persistAnnualClose: persistAnnualCloseMock,
  isCierreAnualPersistenceUnavailableError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'code' in (error as Record<string, unknown>) &&
        (error as Record<string, unknown>).code === 'CIERRE_ANUAL_PERSISTENCE_UNAVAILABLE'
    ),
  isAnnualPeriodNotFoundError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'code' in (error as Record<string, unknown>) &&
        (error as Record<string, unknown>).code === 'PERIODO_ANUAL_NO_ENCONTRADO'
    ),
  isAnnualPeriodDependencyError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'code' in (error as Record<string, unknown>) &&
        (error as Record<string, unknown>).code === 'CIERRE_ANUAL_DEPENDENCIAS_ABIERTAS'
    ),
}));

describe('API /contabilidad/periodos/cierre-anual POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateUserMock.mockResolvedValue({
      user: { userId: 'user-1' },
    });
  });

  it('crea el cierre anual y devuelve 201', async () => {
    const { POST } = await import('../route');
    persistAnnualCloseMock.mockResolvedValue({
      wasCreated: true,
      periodo: { periodoId: 'anio-1', codigo: 'A-2026', tipo: 'ANUAL' },
      snapshot: { snapshotId: 'snap-anio-1', periodoId: 'anio-1', version: 1 },
      resumen: { totalIngresos: 360, totalGastos: 90, diferencia: 270 },
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/cierre-anual', {
      method: 'POST',
      headers: {
        authorization: 'Bearer fake.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ fecha: '2026-06-15T10:00:00.000Z' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe('Cierre anual creado exitosamente');
  });

  it('responde 409 si hay meses abiertos o sin snapshot', async () => {
    const { POST } = await import('../route');
    persistAnnualCloseMock.mockRejectedValue({
      message: 'El cierre anual tiene meses dependientes abiertos o sin snapshot.',
      status: 409,
      code: 'CIERRE_ANUAL_DEPENDENCIAS_ABIERTAS',
      blockers: ['M-2026-01 sigue en estado ABIERTO'],
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/cierre-anual', {
      method: 'POST',
      headers: {
        authorization: 'Bearer fake.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('CIERRE_ANUAL_DEPENDENCIAS_ABIERTAS');
    expect(data.blockers).toHaveLength(1);
  });

  it('rechaza fecha inválida con 400', async () => {
    const { POST } = await import('../route');

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/cierre-anual', {
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

  it('retorna 404 si no existe período anual para la fecha', async () => {
    const { POST } = await import('../route');
    persistAnnualCloseMock.mockRejectedValue({
      message: 'No existe un período anual abierto para A-2026.',
      status: 404,
      code: 'PERIODO_ANUAL_NO_ENCONTRADO',
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/cierre-anual', {
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
    expect(data.code).toBe('PERIODO_ANUAL_NO_ENCONTRADO');
  });
});
