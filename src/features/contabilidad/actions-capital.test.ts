import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionError } from '@/lib/server-actions';
const mockService = vi.hoisted(() => ({
  createCapitalInjection: vi.fn(),
  findCapitalInjectionReplay: vi.fn(),
}));
const mockPeriod = vi.hoisted(() => ({ closed: false, checks: 0 }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server-actions', () => ({
  withAction: (handler: (input: unknown, user: unknown) => Promise<unknown>) =>
    async (input: unknown, user: unknown) => {
      try {
        return { success: true, data: await handler(input, user) };
      } catch (error) {
        const actionError = error as { code?: string; message?: string };
        return { success: false, error: { code: actionError.code, message: actionError.message } };
      }
    },
  ActionError: class ActionError extends Error {
    constructor(message: string, public code: string) { super(message); }
  },
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: vi.fn(),
  requireTenant: vi.fn(() => 'tenant-1'),
}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/services/with-period-validation', () => ({
  withPeriodValidation: (_getDate: unknown, handler: (input: unknown, user: unknown) => unknown) =>
    async (input: unknown, user: unknown) => {
      mockPeriod.checks += 1;
      if (mockPeriod.closed) throw new ActionError('Período cerrado', 'PERIODO_CERRADO');
      return handler(input, user);
    },
}));
vi.mock('@/features/contabilidad/services/accounting-operations-read-service', () => ({
  AccountingOperationsReadService: {},
}));
vi.mock('@/features/contabilidad/services/accounting-operations-mutation-service', () => ({
  AccountingOperationsMutationService: mockService,
  createCapitalInjectionSchema: {
    safeParse: (input: Record<string, unknown>) => ({ success: true, data: input }),
    parse: (input: unknown) => input,
  },
}));

import { createInyeccionCapitalAction } from './actions-capital';

const user = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  planFeatures: { 'inyeccion-capital': true },
};

describe('createInyeccionCapitalAction idempotency and period gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPeriod.closed = false;
    mockPeriod.checks = 0;
  });

  it('replays an existing injection before checking a now-closed period', async () => {
    const existing = { id: 'capital-existing' };
    mockPeriod.closed = true;
    mockService.findCapitalInjectionReplay.mockResolvedValueOnce(existing);

    const response = await (createInyeccionCapitalAction as unknown as (
      input: unknown, user: unknown,
    ) => Promise<{ success: boolean; data?: unknown }>)(
      {
        montoRecibido: 100,
        moneda: 'CUP',
        tipo: 'CAPITAL_SOCIAL',
        cuentaId: 'account-1',
        socio: 'Socio',
        fechaOperacion: new Date('2026-01-15T00:00:00.000Z'),
        idempotencyKey: 'action-replay-key',
      },
      user,
    );

    expect(response).toEqual({ success: true, data: existing });
    expect(mockPeriod.checks).toBe(0);
    expect(mockService.createCapitalInjection).not.toHaveBeenCalled();
  });

  it('does not let a new injection bypass the closed-period gate', async () => {
    mockPeriod.closed = true;
    mockService.findCapitalInjectionReplay.mockResolvedValue(null);

    const response = await (createInyeccionCapitalAction as unknown as (
      input: unknown, user: unknown,
    ) => Promise<{ success: boolean; error?: { code?: string } }>)(
      {
        montoRecibido: 100,
        moneda: 'CUP',
        tipo: 'CAPITAL_SOCIAL',
        cuentaId: 'account-1',
        socio: 'Socio',
        fechaOperacion: new Date('2026-01-15T00:00:00.000Z'),
        idempotencyKey: 'action-new-key',
      },
      user,
    );

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('PERIODO_CERRADO');
    expect(mockPeriod.checks).toBe(1);
    expect(mockService.createCapitalInjection).not.toHaveBeenCalled();
  });
});
