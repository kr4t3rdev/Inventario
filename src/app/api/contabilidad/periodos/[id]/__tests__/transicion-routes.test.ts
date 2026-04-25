import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ESTADO_PERIODO } from '@/lib/services/periodo-contable-service';

const mockAuthenticateUser = vi.fn();
const mockAprobarPeriodo = vi.fn();
const mockReabrirPeriodo = vi.fn();

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: mockAuthenticateUser,
}));

vi.mock('@/lib/services/periodo-transicion-service', () => ({
  aprobarPeriodo: mockAprobarPeriodo,
  reabrirPeriodo: mockReabrirPeriodo,
  isTransicionPersistenceUnavailableError: (error: unknown) =>
    error instanceof Error && error.message.includes('runtime Prisma'),
  isPeriodoNotFoundError: (error: unknown) =>
    error instanceof Error && error.message.includes('No existe un período'),
  isAprobacionBlockerError: (error: unknown) =>
    error !== null && typeof error === 'object' && 'blockers' in error,
  isReaperturaBlockerError: (error: unknown) =>
    error instanceof ReaperturaBlockerTestError,
}));

class AprobacionBlockerTestError extends Error {
  blockers: string[];
  status: number;
  code: string;

  constructor(blockers: string[]) {
    super(`Blockers: ${blockers.join('; ')}`);
    this.name = 'AprobacionBlockerError';
    this.status = 409;
    this.code = 'APROBACION_BLOCKED';
    this.blockers = blockers;
  }
}

class ReaperturaBlockerTestError extends Error {
  blockers: string[];
  status: number;
  code: string;

  constructor(blockers: string[]) {
    super(`Blockers: ${blockers.join('; ')}`);
    this.name = 'ReaperturaBlockerError';
    this.status = 409;
    this.code = 'REAPERTURA_BLOCKED';
    this.blockers = blockers;
  }
}

class PeriodoNotFoundTestError extends Error {
  status: number;
  code: string;

  constructor(id: string) {
    super(`No existe un período con ID ${id}.`);
    this.name = 'PeriodoNotFoundError';
    this.status = 404;
    this.code = 'PERIODO_NO_ENCONTRADO';
  }
}

describe('POST /api/contabilidad/periodos/[id]/aprobar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 401 si no está autenticado', async () => {
    mockAuthenticateUser.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
    );

    const { POST } = await import(
      '@/app/api/contabilidad/periodos/[id]/aprobar/route'
    );

    const request = new Request('http://localhost/api/contabilidad/periodos/abc/aprobar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ id: 'abc' }),
    });

    expect(response.status).toBe(401);
  });

  it('aprueba un período exitosamente', async () => {
    mockAuthenticateUser.mockResolvedValueOnce({
      user: { userId: 'user-1', email: 'test@test.com' },
    });

    mockAprobarPeriodo.mockResolvedValueOnce({
      periodo: {
        periodoId: 'p-1',
        codigo: 'D-2026-04-23',
        tipo: 'DIARIO',
        estado: ESTADO_PERIODO.APROBADO,
      },
      estadoAnterior: ESTADO_PERIODO.CERRADO,
      estadoNuevo: ESTADO_PERIODO.APROBADO,
      auditado: true,
    });

    const { POST } = await import(
      '@/app/api/contabilidad/periodos/[id]/aprobar/route'
    );

    const request = new Request('http://localhost/api/contabilidad/periodos/p-1/aprobar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: 'Cierre mensual aprobado' }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ id: 'p-1' }),
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.estadoNuevo).toBe(ESTADO_PERIODO.APROBADO);
    expect(data.auditado).toBe(true);
  });

  it('retorna 404 si el período no existe', async () => {
    mockAuthenticateUser.mockResolvedValueOnce({
      user: { userId: 'user-1', email: 'test@test.com' },
    });

    mockAprobarPeriodo.mockRejectedValueOnce(
      new PeriodoNotFoundTestError('no-existe')
    );

    const { POST } = await import(
      '@/app/api/contabilidad/periodos/[id]/aprobar/route'
    );

    const request = new Request('http://localhost/api/contabilidad/periodos/no-existe/aprobar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ id: 'no-existe' }),
    });

    expect(response.status).toBe(404);
  });

  it('retorna 409 si hay blockers de aprobación', async () => {
    mockAuthenticateUser.mockResolvedValueOnce({
      user: { userId: 'user-1', email: 'test@test.com' },
    });

    mockAprobarPeriodo.mockRejectedValueOnce(
      new AprobacionBlockerTestError(['Falta snapshot', 'Subperíodo abierto M-2026-04'])
    );

    const { POST } = await import(
      '@/app/api/contabilidad/periodos/[id]/aprobar/route'
    );

    const request = new Request('http://localhost/api/contabilidad/periodos/p-1/aprobar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ id: 'p-1' }),
    });

    expect(response.status).toBe(409);
  });
});

describe('POST /api/contabilidad/periodos/[id]/reabrir', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 400 si no se proporciona motivo', async () => {
    mockAuthenticateUser.mockResolvedValueOnce({
      user: { userId: 'user-1', email: 'test@test.com' },
    });

    const { POST } = await import(
      '@/app/api/contabilidad/periodos/[id]/reabrir/route'
    );

    const request = new Request('http://localhost/api/contabilidad/periodos/p-1/reabrir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ id: 'p-1' }),
    });

    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.code).toBe('MOTIVO_REQUERIDO');
  });

  it('reabre un período exitosamente con motivo', async () => {
    mockAuthenticateUser.mockResolvedValueOnce({
      user: { userId: 'user-1', email: 'test@test.com' },
    });

    mockReabrirPeriodo.mockResolvedValueOnce({
      periodo: {
        periodoId: 'p-1',
        codigo: 'D-2026-04-23',
        tipo: 'DIARIO',
        estado: ESTADO_PERIODO.REABIERTO,
      },
      estadoAnterior: ESTADO_PERIODO.CERRADO,
      estadoNuevo: ESTADO_PERIODO.REABIERTO,
      auditado: true,
    });

    const { POST } = await import(
      '@/app/api/contabilidad/periodos/[id]/reabrir/route'
    );

    const request = new Request('http://localhost/api/contabilidad/periodos/p-1/reabrir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: 'Error en cierre del día' }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ id: 'p-1' }),
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.estadoNuevo).toBe(ESTADO_PERIODO.REABIERTO);
  });

  it('retorna 409 si hay blockers de reapertura', async () => {
    mockAuthenticateUser.mockResolvedValueOnce({
      user: { userId: 'user-1', email: 'test@test.com' },
    });

    mockReabrirPeriodo.mockRejectedValueOnce(
      new ReaperturaBlockerTestError(['El padre M-2026-04 está APROBADO'])
    );

    const { POST } = await import(
      '@/app/api/contabilidad/periodos/[id]/reabrir/route'
    );

    const request = new Request('http://localhost/api/contabilidad/periodos/p-1/reabrir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: 'Corrección necesaria' }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ id: 'p-1' }),
    });

    expect(response.status).toBe(409);
  });

  it('retorna 404 si el período no existe', async () => {
    mockAuthenticateUser.mockResolvedValueOnce({
      user: { userId: 'user-1', email: 'test@test.com' },
    });

    mockReabrirPeriodo.mockRejectedValueOnce(
      new PeriodoNotFoundTestError('no-existe')
    );

    const { POST } = await import(
      '@/app/api/contabilidad/periodos/[id]/reabrir/route'
    );

    const request = new Request('http://localhost/api/contabilidad/periodos/no-existe/reabrir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: 'Reapertura por ajuste' }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ id: 'no-existe' }),
    });

    expect(response.status).toBe(404);
  });
});