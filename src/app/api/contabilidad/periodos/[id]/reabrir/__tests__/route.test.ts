import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authenticateUserMock = vi.hoisted(() => vi.fn());
const reabrirPeriodoMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: authenticateUserMock,
}));

vi.mock('@/lib/services/periodo-transicion-service', () => ({
  reabrirPeriodo: reabrirPeriodoMock,
  isTransicionPersistenceUnavailableError: (e: unknown) =>
    Boolean(e && typeof e === 'object' && 'code' in e && (e as Record<string, unknown>).code === 'TRANSICION_PERSISTENCE_UNAVAILABLE'),
  isPeriodoNotFoundError: (e: unknown) =>
    Boolean(e && typeof e === 'object' && 'code' in e && (e as Record<string, unknown>).code === 'PERIODO_NO_ENCONTRADO'),
  isReaperturaBlockerError: (e: unknown) =>
    Boolean(e && typeof e === 'object' && 'code' in e && (e as Record<string, unknown>).code === 'REAPERTURA_BLOCKER'),
}));

describe('API /contabilidad/periodos/[id]/reabrir POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateUserMock.mockResolvedValue({ user: { userId: 'user-1' } });
  });

  it('reabre un período y devuelve 200', async () => {
    const { POST } = await import('../route');
    reabrirPeriodoMock.mockResolvedValue({
      periodo: { periodoId: 'p-1', codigo: 'D-2026-04-23', estado: 'REABIERTO' },
      estadoAnterior: 'APROBADO',
      estadoNuevo: 'REABIERTO',
      auditado: true,
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/reabrir', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ motivo: 'Error de cálculo, requiere ajuste' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'p-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.periodo.estado).toBe('REABIERTO');
    expect(data.auditado).toBe(true);
  });

  it('devuelve 400 si motivo es vacío', async () => {
    const { POST } = await import('../route');

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/reabrir', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ motivo: '' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'p-1' }) });
    expect(response.status).toBe(400);
  });

  it('devuelve 400 si falta motivo', async () => {
    const { POST } = await import('../route');

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/reabrir', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'p-1' }) });
    expect(response.status).toBe(400);
  });

  it('devuelve 404 si período no encontrado', async () => {
    const { POST } = await import('../route');
    reabrirPeriodoMock.mockRejectedValue(
      Object.assign(new Error('Período no encontrado'), { code: 'PERIODO_NO_ENCONTRADO', status: 404 })
    );

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/fake/reabrir', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ motivo: 'Ajuste' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'fake' }) });
    expect(response.status).toBe(404);
  });

  it('devuelve 409 si hay blockers de reapertura', async () => {
    const { POST } = await import('../route');
    reabrirPeriodoMock.mockRejectedValue(
      Object.assign(new Error('Período anual aprobado, no se puede reabrir'), { code: 'REAPERTURA_BLOCKER', status: 409, blockers: ['Período anual aprobado'] })
    );

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/p-1/reabrir', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ motivo: 'Ajuste' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'p-1' }) });
    expect(response.status).toBe(409);
  });
});