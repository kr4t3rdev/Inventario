import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActionError } from '@/lib/server-actions';

const state = vi.hoisted(() => ({
  user: { userId: 'user-1', tenantId: 'tenant-1', email: 'a@b.test', role: 'MANAGER' },
  cuenta: { cuentaId: 'cuenta-1', saldo: '500', moneda: 'CUP', isActive: true },
}));

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/lib/services/tenant-scope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/tenant-scope')>()),
  requireFeature: vi.fn(),
}));
vi.mock('@/lib/services/validate-period-write', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/validate-period-write')>()),
  validarEscrituraPeriodo: vi.fn(async () => ({ permitido: true })),
}));
vi.mock('@/features/contabilidad/services/accounting-operations-read-service', () => ({
  AccountingOperationsReadService: {
    getCapitalInjections: vi.fn(async () => ({
      inyecciones: [{ id: 'iny-1', tipo: 'CAPITAL_SOCIAL', montoRecibido: '100' }],
    })),
  },
}));
vi.mock('@/lib/prisma', () => {
  const tx = {
    $executeRaw: vi.fn(async () => 0),
    cuentaBancaria: {
      findFirst: vi.fn(async () => state.cuenta),
      update: vi.fn(async () => ({})),
    },
    inyeccionCapital: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'iny-1',
        tenantId: 'tenant-1',
        ...data,
        montoRecibido: '100',
        tasaInteres: null,
        montoInteres: null,
        montoTotalDeuda: null,
        saldoPendiente: null,
        plazoMeses: null,
        fechaInicioPago: null,
        socio: data.socio ?? null,
        entidadPrestamista: data.entidadPrestamista ?? null,
        estado: null,
        descripcion: data.descripcion ?? null,
        fechaRegistro: '2026-10-12T00:00:00.000Z',
        createdAt: '2026-10-12T00:00:00.000Z',
        updatedAt: '2026-10-12T00:00:00.000Z',
      })),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (cb: (client: unknown) => Promise<unknown>) => cb(tx)),
      cuentaBancaria: tx.cuentaBancaria,
      auditLog: tx.auditLog,
    },
  };
});

import { authenticateUser } from '@/lib/auth-middleware';
import { requireFeature } from '@/lib/services/tenant-scope';
import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write';
import { GET, POST } from '../route';

function request(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

beforeEach(() => {
  vi.mocked(authenticateUser).mockReset();
  vi.mocked(authenticateUser).mockResolvedValue({ user: state.user } as never);
  vi.mocked(requireFeature).mockReset();
  vi.mocked(requireFeature).mockImplementation(() => undefined);
  vi.mocked(validarEscrituraPeriodo).mockReset();
  vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true } as never);
  state.cuenta.moneda = 'CUP';
  state.cuenta.saldo = '500';
});

describe('POST /api/mobile/v1/accounting/capital-injections', () => {
  it('rechaza la forma antigua del contrato (monto/APORTE/cuentaBancariaId)', async () => {
    const response = await POST(request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ monto: 100, tipo: 'APORTE', cuentaBancariaId: 'cuenta-1' }),
      headers: { 'content-type': 'application/json' },
    }) as never);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('acepta la forma del servicio y retorna la fila creada', async () => {
    const response = await POST(request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({
        montoRecibido: 100, tipo: 'CAPITAL_SOCIAL', cuentaId: 'cuenta-1',
        socio: 'Socio Uno', moneda: 'CUP', descripcion: 'Aporte inicial',
        idempotencyKey: 'k-1',
      }),
      headers: { 'content-type': 'application/json' },
    }) as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('iny-1');
    expect(body.montoRecibido).toBe('100');
    expect(body.cuentaId).toBe('cuenta-1');
    expect(body.socio).toBe('Socio Uno');
  });

  it('exige socio para CAPITAL_SOCIAL y entidadPrestamista para DEUDA_EXTERNA', async () => {
    for (const body of [
      { montoRecibido: 100, tipo: 'CAPITAL_SOCIAL', cuentaId: 'cuenta-1', moneda: 'CUP' },
      { montoRecibido: 100, tipo: 'DEUDA_EXTERNA', cuentaId: 'cuenta-1', moneda: 'CUP' },
    ]) {
      const response = await POST(request('http://localhost/x', {
        method: 'POST', body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      }) as never);
      expect(response.status).toBe(400);
    }
  });

  it('rechaza moneda distinta a la de la cuenta', async () => {
    state.cuenta.moneda = 'USD';
    const response = await POST(request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ montoRecibido: 100, tipo: 'CAPITAL_SOCIAL', cuentaId: 'cuenta-1', socio: 'S', moneda: 'CUP' }),
      headers: { 'content-type': 'application/json' },
    }) as never);

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('VALIDATION_ERROR');
  });

  it('propaga 401 sin token', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(new Response(null, { status: 401 }) as never);
    const response = await POST(request('http://localhost/x', { method: 'POST' }) as never);
    expect(response.status).toBe(401);
  });

  it('retorna 403 cuando el plan no incluye la feature', async () => {
    vi.mocked(requireFeature).mockImplementation(() => {
      throw new ActionError('Feature no disponible', 'FEATURE_NOT_AVAILABLE');
    });
    const response = await POST(request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ montoRecibido: 100, tipo: 'CAPITAL_SOCIAL', cuentaId: 'cuenta-1', socio: 'S', moneda: 'CUP' }),
      headers: { 'content-type': 'application/json' },
    }) as never);
    expect(response.status).toBe(403);
  });

  it('retorna 400 PERIODO_CERRADO cuando el período no admite escrituras', async () => {
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({
      permitido: false,
      error: { message: 'Período contable cerrado', code: 'PERIODO_CERRADO' },
    } as never);
    const response = await POST(request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ montoRecibido: 100, tipo: 'CAPITAL_SOCIAL', cuentaId: 'cuenta-1', socio: 'S', moneda: 'CUP' }),
      headers: { 'content-type': 'application/json' },
    }) as never);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PERIODO_CERRADO');
  });
});

describe('GET /api/mobile/v1/accounting/capital-injections', () => {
  it('propaga 401 sin token', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(new Response(null, { status: 401 }) as never);
    const response = await GET(request('http://localhost/x') as never);
    expect(response.status).toBe(401);
  });

  it('retorna 403 cuando el plan no incluye la feature en GET', async () => {
    vi.mocked(requireFeature).mockImplementation(() => {
      throw new ActionError('Feature no disponible', 'FEATURE_NOT_AVAILABLE');
    });
    const response = await GET(request('http://localhost/x') as never);
    expect(response.status).toBe(403);
  });

  it('lista inyecciones con tenant válido', async () => {
    const response = await GET(request('http://localhost/x') as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items[0].id).toBe('iny-1');
  });

  it('retorna 403 TENANT_REQUIRED sin tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...state.user, tenantId: undefined },
    } as never);
    const response = await GET(request('http://localhost/x') as never);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('TENANT_REQUIRED');
  });

  it('retorna 400 para un tipo de inyección inválido', async () => {
    const response = await GET(request('http://localhost/x?tipo=APORTE') as never);
    expect(response.status).toBe(400);
  });
});
