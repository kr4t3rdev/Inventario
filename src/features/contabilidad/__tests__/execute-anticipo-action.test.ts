import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  applyAnticipoAllocations: vi.fn(),
  requireFeature: vi.fn(),
  requirePermission: vi.fn(),
  requireTenant: vi.fn(() => 'tenant-a'),
  auditLog: vi.fn(),
  anticipoFindFirst: vi.fn(),
  anticipoFindUnique: vi.fn(),
  anticipoUpdate: vi.fn(),
  transaction: vi.fn(async (callback: (tx: object) => unknown) => callback({
    anticipo: { findUnique: vi.fn().mockResolvedValue({ anticipoId: 'ant-1' }) },
  })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server-actions', () => ({
  withAction: (handler: (...args: unknown[]) => unknown) => handler,
  ActionError: class ActionError extends Error { constructor(m: string, public code?: string) { super(m); } },
}));
vi.mock('@/lib/services/with-period-validation', () => ({
  withPeriodValidation: (_date: unknown, handler: (...args: unknown[]) => unknown) => handler,
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: mocked.requireFeature,
  requirePermission: mocked.requirePermission,
  requireTenant: mocked.requireTenant,
}));
vi.mock('@/lib/services/anticipos-workflow', () => ({
  applyAnticipoAllocations: mocked.applyAnticipoAllocations,
}));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: mocked.auditLog },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    anticipo: {
      findFirst: mocked.anticipoFindFirst,
      findUnique: mocked.anticipoFindUnique,
      update: mocked.anticipoUpdate,
    },
    $transaction: mocked.transaction,
  },
}));

import {
  executeAnticipoAction,
  reverseAnticipoAction,
} from '@/features/contabilidad/actions-anticipos';

/**
 * withAction esta mockeado como identidad en este archivo: las acciones exportadas
 * son las funciones crudas (input, user). El cast refleja el comportamiento real del
 * mock (vi.mock no cambia los tipos que ve tsc).
 */
type ExecuteAnticipoInput = NonNullable<Parameters<typeof executeAnticipoAction>[0]>;
type ReverseAnticipoInput = NonNullable<Parameters<typeof reverseAnticipoAction>[0]>;
const executeAnticipoActionRaw = executeAnticipoAction as unknown as (
  input: ExecuteAnticipoInput,
  user: unknown,
) => ReturnType<typeof executeAnticipoAction>;
const reverseAnticipoActionRaw = reverseAnticipoAction as unknown as (
  input: ReverseAnticipoInput,
  user: unknown,
) => ReturnType<typeof reverseAnticipoAction>;

describe('executeAnticipoAction — migrado al flujo documental certificado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.anticipoFindFirst.mockResolvedValue({
      anticipoId: 'ant-1', tenantId: 'tenant-a', tipo: 'COBRO',
      clienteId: 'cli-1', proveedorId: null,
    });
    mocked.auditLog.mockResolvedValue(undefined);
    mocked.applyAnticipoAllocations.mockResolvedValue([]);
  });

  it('deniega la ejecución manual aunque indique un documento existente', async () => {
    const user = { userId: 'user-a', tenantId: 'tenant-a', role: 'regularUser' };
    await expect(executeAnticipoActionRaw({
      anticipoId: 'ant-1', montoEjecutar: 120,
      documentoDestinoId: 'doc-1', tipoDocumento: 'FACTURA_DIRECTA',
      observaciones: 'aplicación',
    }, user as never)).rejects.toMatchObject({ code: 'DOCUMENT_WORKFLOW_REQUIRED' });

    expect(mocked.requirePermission).toHaveBeenCalledWith(
      user, 'financiero.contabilidad.acceder', expect.any(String),
    );
    expect(mocked.anticipoFindFirst).not.toHaveBeenCalled();
    expect(mocked.applyAnticipoAllocations).not.toHaveBeenCalled();
    expect(mocked.transaction).not.toHaveBeenCalled();
  });

  it('rechaza ejecutar sin documento destino (no muta ni postea fuera del flujo)', async () => {
    const user = { userId: 'user-a', tenantId: 'tenant-a', role: 'regularUser' };
    await expect(executeAnticipoActionRaw({
      anticipoId: 'ant-1', montoEjecutar: 50,
    } as never, user as never)).rejects.toMatchObject({ code: 'DOCUMENT_WORKFLOW_REQUIRED' });
    expect(mocked.applyAnticipoAllocations).not.toHaveBeenCalled();
    expect(mocked.transaction).not.toHaveBeenCalled();
  });

  it('rechaza ejecución manual incluso si el caller inventa un ID de documento', async () => {
    await expect(executeAnticipoActionRaw({
      anticipoId: 'ant-1', montoEjecutar: 40,
      documentoDestinoId: 'manual-1759500000000', tipoDocumento: 'FACTURA_DIRECTA',
    }, { userId: 'user-a', tenantId: 'tenant-a' } as never))
      .rejects.toMatchObject({ code: 'DOCUMENT_WORKFLOW_REQUIRED' });
    expect(mocked.anticipoFindFirst).not.toHaveBeenCalled();
    expect(mocked.applyAnticipoAllocations).not.toHaveBeenCalled();
    expect(mocked.transaction).not.toHaveBeenCalled();
  });

  it('rechaza reversión manual sin workflow documental inverso', async () => {
    await expect(reverseAnticipoActionRaw({
      anticipoId: 'ant-1', montoReverso: 40,
      documentoDestinoId: 'manual-reverse-1759500000000',
    }, { userId: 'user-a', tenantId: 'tenant-a' } as never))
      .rejects.toMatchObject({ code: 'DOCUMENT_WORKFLOW_REQUIRED' });
    expect(mocked.anticipoFindFirst).not.toHaveBeenCalled();
    expect(mocked.anticipoUpdate).not.toHaveBeenCalled();
  });
});
