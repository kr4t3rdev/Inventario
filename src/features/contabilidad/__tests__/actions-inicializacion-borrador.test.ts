/**
 * @description Tests para las Server Actions del borrador de inicialización.
 * El tenant se deriva del usuario autenticado y el gate de apertura se aplica
 * en servidor; el cliente nunca envía el tenant.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { expectActionFailure, expectActionSuccess } from '@/test/action-response';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/features/contabilidad/services/initialization-idempotency', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/contabilidad/services/initialization-idempotency')>();
  return {
    ...actual,
    guardarBorradorInicializacion: vi.fn(),
    obtenerBorradorInicializacion: vi.fn(),
  };
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import {
  guardarBorradorInicializacion,
  obtenerBorradorInicializacion,
} from '@/features/contabilidad/services/initialization-idempotency';
import {
  guardarBorradorInicializacionAction,
  obtenerBorradorInicializacionAction,
} from '@/features/contabilidad/actions-inicializacion-borrador';

const mockUser: AuthenticatedUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 't1',
  tenantRole: 'manager',
};

const deniedUser: AuthenticatedUser = {
  ...mockUser,
  role: 'user',
  tenantRole: 'member',
  permissions: new Set<string>(),
};

const savedDraft = {
  idempotencyKey: 'draft-1',
  payloadHash: 'a'.repeat(64),
  estado: 'BORRADOR' as const,
  borrador: { fechaCorte: '2026-11-01', monedaFuncional: 'CUP' },
};

describe('Acciones del borrador de inicialización', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(guardarBorradorInicializacion).mockResolvedValue(savedDraft);
    vi.mocked(obtenerBorradorInicializacion).mockResolvedValue(savedDraft);
  });

  it('guardar deriva el tenant del usuario y devuelve el borrador', async () => {
    const result = await guardarBorradorInicializacionAction({
      idempotencyKey: 'draft-1',
      borrador: { fechaCorte: '2026-11-01', monedaFuncional: 'CUP' },
    });
    expectActionSuccess(result);
    expect(guardarBorradorInicializacion).toHaveBeenCalledWith({
      tenantId: 't1',
      idempotencyKey: 'draft-1',
      borrador: { fechaCorte: '2026-11-01', monedaFuncional: 'CUP' },
    });
    expect(result.data).toMatchObject({ idempotencyKey: 'draft-1', estado: 'BORRADOR' });
  });

  it('guardar rechaza un tenantId enviado por el cliente', async () => {
    const result = await guardarBorradorInicializacionAction({
      idempotencyKey: 'draft-1',
      borrador: { fechaCorte: '2026-11-01' },
      tenantId: 'otro-tenant',
    } as never);
    expectActionFailure(result);
    expect(guardarBorradorInicializacion).not.toHaveBeenCalled();
  });

  it('guardar sin permiso de apertura se rechaza con FORBIDDEN', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(deniedUser);
    const result = await guardarBorradorInicializacionAction({
      idempotencyKey: 'draft-1',
      borrador: { fechaCorte: '2026-11-01' },
    });
    const failure = expectActionFailure(result);
    expect(failure.error).toMatchObject({ code: 'FORBIDDEN' });
    expect(guardarBorradorInicializacion).not.toHaveBeenCalled();
  });

  it('guardar sin usuario autenticado se rechaza', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await guardarBorradorInicializacionAction({
      idempotencyKey: 'draft-1',
      borrador: { fechaCorte: '2026-11-01' },
    });
    expectActionFailure(result);
    expect(guardarBorradorInicializacion).not.toHaveBeenCalled();
  });

  it('obtener devuelve el borrador del tenant del usuario', async () => {
    const result = await obtenerBorradorInicializacionAction({ idempotencyKey: 'draft-1' });
    const success = expectActionSuccess(result);
    expect(obtenerBorradorInicializacion).toHaveBeenCalledWith({ tenantId: 't1', idempotencyKey: 'draft-1' });
    expect(success.data).toMatchObject({ idempotencyKey: 'draft-1' });
  });

  it('obtener sin borrador devuelve éxito con null', async () => {
    vi.mocked(obtenerBorradorInicializacion).mockResolvedValue(null);
    const result = await obtenerBorradorInicializacionAction({ idempotencyKey: 'draft-1' });
    const success = expectActionSuccess(result);
    expect(success.data).toBeNull();
  });

  it('obtener sin permiso de apertura se rechaza con FORBIDDEN', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(deniedUser);
    const result = await obtenerBorradorInicializacionAction({ idempotencyKey: 'draft-1' });
    const failure = expectActionFailure(result);
    expect(failure.error).toMatchObject({ code: 'FORBIDDEN' });
    expect(obtenerBorradorInicializacion).not.toHaveBeenCalled();
  });
});
