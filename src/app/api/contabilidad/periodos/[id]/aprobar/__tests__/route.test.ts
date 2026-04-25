import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authenticateUserMock = vi.hoisted(() => vi.fn());
const aprobarPeriodoMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: authenticateUserMock,
}));

vi.mock('@/lib/services/periodo-transicion-service', () => ({
  aprobarPeriodo: aprobarPeriodoMock,
  isTransicionPersistenceUnavailableError: (e: unknown) =>
    Boolean(e && typeof e === 'object' && 'code' in e && (e as Record<string, unknown>).code === 'TRANSICION_PERSISTENCE_UNAVAILABLE'),
  isPeriodoNotFoundError: (e: unknown) =>
    Boolean(e && typeof e === 'object' && 'code' in e && (e as Record<string, unknown>).code === 'PERIODO_NO_ENCONTRADO'),
  isAprobacionBlockerError: (e: unknown) =>
    Boolean(e && typeof e === 'object' && 'code' in e && (e as Record<string, unknown>).code === 'APROBACION_BLOCKER'),
}));

describe('API /contabilidad/periodos/[id]/aprobar POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateUserMock.mockResolvedValue({ user: { userId: 'user-1' } });
  });

  it('aprueba un período y devuelve 200', async () => {
    const { POST } = await import('../route');
    aprobarPeriodoMock.mockResolvedValue({
      periodo: { periodoId: 'p-1', codigo: 'D-2026-04-23', estado: 'APROBADO' },
      estadoAnterior: 'CERRADO',
      estadoNuevo: 'APROBADO',
      auditado: true,
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/aprobar', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ motivo: 'Aprobación final' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'p-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.periodo.estado).toBe('APROBADO');
    expect(data.auditado).toBe(true);
  });

  it('devuelve 404 si período no encontrado', async () => {
    const { POST } = await import('../route');
    aprobarPeriodoMock.mockRejectedValue(
      Object.assign(new Error('Período no encontrado'), { code: 'PERIODO_NO_ENCONTRADO', status: 404 })
    );

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/fake/aprobar', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'fake' }) });
    expect(response.status).toBe(404);
  });

  it('devuelve 409 si hay blockers de aprobación', async () => {
    const { POST } = await import('../route');
    aprobarPeriodoMock.mockRejectedValue(
      Object.assign(new Error('Hay subperíodos sin cerrar'), { code: 'APROBACION_BLOCKER', status: 409, blockers: ['Diario abierto'] })
    );

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/aprobar', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'p-1' }) });
    expect(response.status).toBe(409);
  });

  it('devuelve 401 si no autenticado', async () => {
    const { POST } = await import('../route');
    authenticateUserMock.mockResolvedValue({ status: 401 });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/aprobar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'p-1' }) });
    expect(response.status).toBe(401);
  });
});