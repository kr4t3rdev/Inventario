import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActionError } from '@/lib/server-actions';

const state = vi.hoisted(() => ({
  user: { userId: 'user-1', tenantId: 'tenant-1', email: 'a@b.test', role: 'MANAGER' },
  cuenta: {
    cuentaId: 'cuenta-1', saldo: '500', moneda: 'CUP',
    isActive: true, nombreBanco: 'Banco Test',
  },
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
    getBankAdjustments: vi.fn(async () => ({
      ajustes: [{ ajusteId: 'adj-1', tipo: 'ingreso', monto: '100' }],
      cuentaBancaria: null,
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    })),
  },
}));
vi.mock('@/lib/prisma', () => {
  const tx = {
    $executeRaw: vi.fn(async () => 0),
    ajusteBancario: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ajusteId: 'adj-1',
        tenantId: 'tenant-1',
        cuentaId: data.cuentaId ?? 'cuenta-1',
        tipo: data.tipo,
        monto: String(data.monto ?? '100'),
        moneda: data.moneda,
        tasaCambio: '1',
        montoConvertido: String(data.monto ?? '100'),
        descripcion: data.descripcion,
        motivo: data.motivo,
        realizadoPor: data.realizadoPor,
        fechaOperacion: '2026-10-12T00:00:00.000Z',
        createdAt: '2026-10-12T00:00:00.000Z',
        updatedAt: '2026-10-12T00:00:00.000Z',
      })),
    },
    cuentaBancaria: {
      findFirst: vi.fn(async () => state.cuenta),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (cb: (client: unknown) => Promise<unknown>) => cb(tx)),
      cuentaBancaria: {
        findUnique: vi.fn(async () => state.cuenta),
        findFirst: vi.fn(async () => state.cuenta),
      },
      auditLog: tx.auditLog,
    },
  };
});

import { authenticateUser } from '@/lib/auth-middleware';
import { requireFeature } from '@/lib/services/tenant-scope';
import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';
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
  vi.spyOn(AccountingOperationsMutationService, 'findBankAdjustmentReplay').mockRestore();
  vi.spyOn(AccountingOperationsMutationService, 'createBankAdjustment').mockRestore();
  state.cuenta.saldo = '500';
});

describe('POST /api/mobile/v1/accounting/bank-adjustments', () => {
  it('retorna el envelope real del servicio (ajuste + saldos + advertencia)', async () => {
    const response = await POST(request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({
        cuentaId: 'cuenta-1', tipo: 'ingreso', monto: 100, moneda: 'CUP',
        descripcion: 'Ajuste prueba', motivo: 'Prueba',
      }),
      headers: { 'content-type': 'application/json' },
    }) as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ajuste.ajusteId).toBe('adj-1');
    expect(body.saldoAnterior).toBe(500);
    expect(body.saldoNuevo).toBe(600);
    expect(body.advertenciaSaldoNegativo).toBe(false);
    expect(body.message).toBeTruthy();
  });

  it('advierte saldo negativo sin bloquear el egreso mayor al saldo', async () => {
    const response = await POST(request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({
        cuentaId: 'cuenta-1', tipo: 'egreso', monto: 700, moneda: 'CUP',
        descripcion: 'Egreso grande', motivo: 'Prueba',
      }),
      headers: { 'content-type': 'application/json' },
    }) as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.saldoNuevo).toBe(-200);
    expect(body.advertenciaSaldoNegativo).toBe(true);
  });

  it('retorna 400 VALIDATION_ERROR para un body inválido en vez de 500', async () => {
    const response = await POST(request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ cuentaId: 'cuenta-1', tipo: 'ingreso', monto: 100 }),
      headers: { 'content-type': 'application/json' },
    }) as never);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('propaga 401 sin token', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(new Response(null, { status: 401 }) as never);
    const response = await POST(request('http://localhost/x', { method: 'POST' }) as never);
    expect(response.status).toBe(401);
  });

  it('retorna 400 PERIODO_CERRADO cuando el período no admite escrituras', async () => {
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({
      permitido: false,
      error: { message: 'Período contable cerrado', code: 'PERIODO_CERRADO' },
    } as never);
    const response = await POST(request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({
        cuentaId: 'cuenta-1', tipo: 'ingreso', monto: 100, moneda: 'CUP',
        descripcion: 'Ajuste', motivo: 'Prueba',
      }),
      headers: { 'content-type': 'application/json' },
    }) as never);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PERIODO_CERRADO');
  });

  it('acepta la clave por header y busca replay antes de validar período', async () => {
    const existing = { ajuste: { ajusteId: 'adj-existing' }, saldoNuevo: 600 };
    vi.spyOn(AccountingOperationsMutationService, 'findBankAdjustmentReplay').mockResolvedValue(existing as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({
      permitido: false,
      error: { message: 'Período cerrado', code: 'PERIODO_CERRADO' },
    } as never);

    const response = await POST(request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ cuentaId: 'cuenta-1', tipo: 'ingreso', monto: 100, moneda: 'CUP', descripcion: 'D', motivo: 'M' }),
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'header-key' },
    }) as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(existing);
    expect(AccountingOperationsMutationService.findBankAdjustmentReplay).toHaveBeenCalledWith({
      input: expect.objectContaining({ idempotencyKey: 'header-key' }),
      user: state.user,
    });
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
  });

  it('maps idempotency conflicts to HTTP 409', async () => {
    vi.spyOn(AccountingOperationsMutationService, 'findBankAdjustmentReplay').mockRejectedValue(
      new ActionError('Conflicto', 'IDEMPOTENCY_CONFLICT'),
    );
    const response = await POST(request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ cuentaId: 'cuenta-1', tipo: 'ingreso', monto: 100, moneda: 'CUP', descripcion: 'D', motivo: 'M' }),
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'header-key' },
    }) as never);

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('IDEMPOTENCY_CONFLICT');
  });
});

describe('GET /api/mobile/v1/accounting/bank-adjustments', () => {
  it('propaga 401 sin token', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(new Response(null, { status: 401 }) as never);
    const response = await GET(request('http://localhost/x') as never);
    expect(response.status).toBe(401);
  });

  it('lista ajustes con envelope items/cuentaBancaria/pagination', async () => {
    const response = await GET(request('http://localhost/x') as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items[0].ajusteId).toBe('adj-1');
    expect(body.pagination.total).toBe(1);
  });

  it('retorna 403 TENANT_REQUIRED sin tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...state.user, tenantId: undefined },
    } as never);
    const response = await GET(request('http://localhost/x') as never);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('TENANT_REQUIRED');
  });
});
