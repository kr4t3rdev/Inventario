import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { user, requireFeature, requirePermission, findUnique, findFirst, update, remove, transaction } = vi.hoisted(() => ({
  user: {
    userId: 'manager-a', tenantId: 'tenant-a', tenantRole: 'manager',
    planFeatures: { anticipos: true },
  },
  requireFeature: vi.fn(),
  requirePermission: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/auth-middleware', () => ({
  withAuthPost: (handler: (...args: any[]) => unknown) =>
    (request: NextRequest, context: unknown) => handler(request, context, user),
  withAuthGet: (handler: (...args: any[]) => unknown) =>
    (request: NextRequest, context: unknown) => handler(request, context, user),
  authenticateUser: vi.fn(async () => ({ user })),
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: (actor: { tenantId: string }) => actor.tenantId,
  requireFeature,
  requirePermission,
}));
vi.mock('@/lib/prisma', () => ({
  default: { anticipo: { findUnique, findFirst, update, delete: remove }, $transaction: transaction },
  prisma: { anticipo: { findUnique, findFirst, update, delete: remove }, $transaction: transaction },
}));

import { POST as postExecute } from '../[id]/ejecutar/route';
import { POST as postReverse } from '../[id]/revertir/route';
import { PUT as putScopedAnticipo, DELETE as deleteScopedAnticipo } from '../[id]/route';
import { PUT as putLegacyAnticipo, DELETE as deleteLegacyAnticipo } from '@/app/api/anticipos/[id]/route';
import { PUT as putMobileAnticipo, DELETE as deleteMobileAnticipo } from '@/app/api/mobile/v1/accounting/advances/[id]/route';

function request(url: string, payload: Record<string, unknown>): NextRequest {
  return new NextRequest(url, { method: 'POST', body: JSON.stringify(payload) });
}

describe('operaciones manuales de anticipo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza ejecución manual y no consulta ni muta anticipo', async () => {
    const response = await postExecute(request(
      'http://localhost/api/contabilidad/anticipos/a-1/ejecutar', {
        contexto: 'FACTURA_DIRECTA', documentoDestinoId: 'manual-1', montoObjetivo: 100,
        monedaObjetivo: 'CUP', idempotencyKey: 'manual-key',
      },
    ), { params: Promise.resolve({ id: 'a-1' }) });

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('DOCUMENT_WORKFLOW_REQUIRED');
    expect(requireFeature).toHaveBeenCalledWith(user, 'anticipos', expect.any(String));
    expect(requirePermission).toHaveBeenCalledWith(
      user, 'financiero.contabilidad.acceder', expect.any(String),
    );
    expect(findUnique).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rechaza reversión manual y no consulta ni muta anticipo', async () => {
    const response = await postReverse(request(
      'http://localhost/api/contabilidad/anticipos/a-1/revertir', {
        documentoDestinoId: 'manual-reverse-1', montoReverso: 100,
      },
    ), { params: Promise.resolve({ id: 'a-1' }) });

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('DOCUMENT_WORKFLOW_REQUIRED');
    expect(requireFeature).toHaveBeenCalledWith(user, 'anticipos', expect.any(String));
    expect(requirePermission).toHaveBeenCalledWith(
      user, 'financiero.contabilidad.acceder', expect.any(String),
    );
    expect(findUnique).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['API contabilidad', putScopedAnticipo, deleteScopedAnticipo],
    ['API legacy', putLegacyAnticipo, deleteLegacyAnticipo],
  ])('%s bloquea mutación manual de saldo/estado y borrado', async (_channel, put, deleteAnticipo) => {
    const context = { params: Promise.resolve({ id: 'advance-a' }) };
    const updateResponse = await put(request('http://localhost/api/anticipos/advance-a', {
      estado: 'EJECUTADO', saldoDisponible: 0,
    }), context);
    const deleteResponse = await deleteAnticipo(new NextRequest(
      'http://localhost/api/anticipos/advance-a', { method: 'DELETE' },
    ), context);

    expect(updateResponse.status).toBe(409);
    expect(deleteResponse.status).toBe(409);
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('la API móvil también bloquea cambios manuales de estado/saldo y borrado', async () => {
    const context = { params: Promise.resolve({ id: 'advance-a' }) };
    const updateResponse = await putMobileAnticipo(new Request(
      'http://localhost/api/mobile/v1/accounting/advances/advance-a', {
        method: 'PUT',
        body: JSON.stringify({ estado: 'EJECUTADO', saldoDisponible: 0 }),
      },
    ), context);
    const deleteResponse = await deleteMobileAnticipo(new Request(
      'http://localhost/api/mobile/v1/accounting/advances/advance-a', { method: 'DELETE' },
    ), context);

    expect(updateResponse.status).toBe(409);
    expect(deleteResponse.status).toBe(409);
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
