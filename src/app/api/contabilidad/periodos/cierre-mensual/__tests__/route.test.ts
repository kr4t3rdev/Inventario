import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authenticateUserMock = vi.hoisted(() => vi.fn());
const persistMonthlyCloseMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: authenticateUserMock,
}));

vi.mock('@/lib/services/cierre-mensual-persistence-service', () => ({
  persistMonthlyClose: persistMonthlyCloseMock,
  isCierreMensualPersistenceUnavailableError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'code' in (error as Record<string, unknown>) &&
        (error as Record<string, unknown>).code === 'CIERRE_MENSUAL_PERSISTENCE_UNAVAILABLE'
    ),
  isMonthlyPeriodNotFoundError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'code' in (error as Record<string, unknown>) &&
        (error as Record<string, unknown>).code === 'PERIODO_MENSUAL_NO_ENCONTRADO'
    ),
  isMonthlyPeriodDependencyError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'code' in (error as Record<string, unknown>) &&
        (error as Record<string, unknown>).code === 'CIERRE_MENSUAL_DEPENDENCIAS_ABIERTAS'
    ),
}));

describe('API /contabilidad/periodos/cierre-mensual POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateUserMock.mockResolvedValue({
      user: { userId: 'user-1' },
    });
  });

  it('crea el cierre mensual y devuelve 201', async () => {
    const { POST } = await import('../route');
    persistMonthlyCloseMock.mockResolvedValue({
      wasCreated: true,
      periodo: { periodoId: 'mes-1', codigo: 'M-2026-04', tipo: 'MENSUAL' },
      snapshot: { snapshotId: 'snap-mes-1', periodoId: 'mes-1', version: 1 },
      resumen: { totalIngresos: 360, totalGastos: 90, diferencia: 270 },
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/cierre-mensual', {
      method: 'POST',
      headers: {
        authorization: 'Bearer fake.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ fecha: '2026-04-15T10:00:00.000Z' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe('Cierre mensual creado exitosamente');
  });

  it('responde 409 si hay diarios abiertos o sin snapshot', async () => {
    const { POST } = await import('../route');
    persistMonthlyCloseMock.mockRejectedValue({
      message: 'El cierre mensual tiene diarios dependientes abiertos o sin snapshot.',
      status: 409,
      code: 'CIERRE_MENSUAL_DEPENDENCIAS_ABIERTAS',
      blockers: ['D-2026-04-01 sigue en estado ABIERTO'],
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/cierre-mensual', {
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
    expect(data.code).toBe('CIERRE_MENSUAL_DEPENDENCIAS_ABIERTAS');
    expect(data.blockers).toHaveLength(1);
  });

  it('rechaza fecha inválida con 400', async () => {
    const { POST } = await import('../route');

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/cierre-mensual', {
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

  it('retorna 404 si no existe período mensual para la fecha', async () => {
    const { POST } = await import('../route');
    persistMonthlyCloseMock.mockRejectedValue({
      message: 'No existe un período mensual abierto para M-2026-04.',
      status: 404,
      code: 'PERIODO_MENSUAL_NO_ENCONTRADO',
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/cierre-mensual', {
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
    expect(data.code).toBe('PERIODO_MENSUAL_NO_ENCONTRADO');
  });
});
