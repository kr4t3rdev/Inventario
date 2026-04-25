import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authenticateUserMock = vi.hoisted(() => vi.fn());
const persistOpeningPeriodMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: authenticateUserMock,
}));

vi.mock('@/lib/services/apertura-periodo-persistence-service', () => ({
  persistOpeningPeriod: persistOpeningPeriodMock,
  isPeriodoPersistenceUnavailableError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'code' in (error as Record<string, unknown>) &&
        (error as Record<string, unknown>).code === 'PERIODO_PERSISTENCE_UNAVAILABLE'
    ),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    cuentaBancaria: {
      findMany: vi.fn().mockResolvedValue([
        { saldo: 100, tipoCuenta: 'caja_principal' },
        { saldo: 400, tipoCuenta: 'banco_operativo' },
      ]),
    },
    cuentaPorCobrar: {
      findMany: vi.fn().mockResolvedValue([
        { montoDeuda: 300, montoPagado: 50 },
      ]),
    },
    cuentaPorPagar: {
      findMany: vi.fn().mockResolvedValue([
        { saldoPendiente: 125 },
      ]),
    },
    producto: {
      findMany: vi.fn().mockResolvedValue([
        { stock: 10, precioCosto: 20 },
      ]),
    },
    inyeccionCapital: {
      findMany: vi.fn().mockResolvedValue([
        { montoRecibido: 1000 },
      ]),
    },
  },
}));

describe('API /contabilidad/periodos/apertura-diaria POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateUserMock.mockResolvedValue({
      user: { userId: 'user-1' },
    });
  });

  it('crea la apertura diaria y devuelve 201', async () => {
    const { POST } = await import('../route');

    persistOpeningPeriodMock.mockResolvedValue({
      wasCreated: true,
      periodo: {
        periodoId: 'periodo-1',
        codigo: 'D-2026-04-23',
        tipo: 'DIARIO',
      },
      apertura: {
        aperturaId: 'apertura-1',
        periodoId: 'periodo-1',
      },
      seed: {
        codigoPeriodo: 'D-2026-04-23',
      },
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/apertura-diaria', {
      method: 'POST',
      headers: {
        authorization: 'Bearer fake.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        fecha: '2026-04-23T10:00:00.000Z',
        observaciones: 'Apertura automática del día',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.wasCreated).toBe(true);
    expect(data.message).toBe('Apertura diaria creada exitosamente');
    expect(persistOpeningPeriodMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoPeriodo: 'DIARIO',
        usuarioId: 'user-1',
        observaciones: 'Apertura automática del día',
        liveBalances: {
          caja: 100,
          bancos: 400,
          cuentasPorCobrar: 250,
          cuentasPorPagar: 125,
          inventario: 200,
          capital: 1000,
          resultadosAcumulados: 0,
        },
      })
    );
  });

  it('responde 200 cuando la apertura ya existía', async () => {
    const { POST } = await import('../route');

    persistOpeningPeriodMock.mockResolvedValue({
      wasCreated: false,
      periodo: {
        periodoId: 'periodo-1',
        codigo: 'D-2026-04-23',
        tipo: 'DIARIO',
      },
      apertura: {
        aperturaId: 'existing-opening',
        periodoId: 'periodo-1',
      },
      seed: {
        codigoPeriodo: 'D-2026-04-23',
      },
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/apertura-diaria', {
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
    expect(data.wasCreated).toBe(false);
    expect(data.message).toBe('La apertura diaria ya existía para esa fecha');
  });

  it('rechaza fecha inválida con 400', async () => {
    const { POST } = await import('../route');

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/apertura-diaria', {
      method: 'POST',
      headers: {
        authorization: 'Bearer fake.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        fecha: 'fecha-no-valida',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      error: 'Fecha inválida',
      code: 'FECHA_INVALIDA',
    });
  });

  it('retorna 503 si el runtime prisma no está listo para persistir', async () => {
    const { POST } = await import('../route');

    persistOpeningPeriodMock.mockRejectedValue({
      message:
        'El runtime Prisma actual no expone PeriodoContable/AperturaPeriodo. Ejecutá migrate/generate antes de persistir aperturas.',
      status: 503,
      code: 'PERIODO_PERSISTENCE_UNAVAILABLE',
    });

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/apertura-diaria', {
      method: 'POST',
      headers: {
        authorization: 'Bearer fake.token.value',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.code).toBe('PERIODO_PERSISTENCE_UNAVAILABLE');
  });
});
