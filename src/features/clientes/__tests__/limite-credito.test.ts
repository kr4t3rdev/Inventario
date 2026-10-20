/**
 * @description Tests del escritor del límite de crédito del cliente (C-1):
 * action dedicada con permiso `operaciones.clientes.limite-credito`,
 * persistencia y auditoría en la misma transacción.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    $executeRaw: vi.fn(),
    cliente: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  const runTransaction = <T>(callback: (tx: typeof prismaMock) => Promise<T>) => callback(prismaMock);
  return { prisma: { ...prismaMock, $transaction: vi.fn(runTransaction) } };
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { updateLimiteCreditoClienteAction } from '@/features/clientes/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// La transacción simulada es el propio prisma mockeado.
const mockTx = prisma;

const managerUser = {
  userId: 'user-manager',
  name: 'Manager',
  email: 'manager@test.com',
  role: 'regularUser',
  isActive: true,
  tenantId: 'tenant-test',
  tenantRole: 'manager',
  planFeatures: { clientes: true },
} as unknown as AuthenticatedUser;

const dependienteUser = {
  ...managerUser,
  userId: 'user-dependiente',
  tenantRole: 'dependiente',
} as unknown as AuthenticatedUser;

describe('updateLimiteCreditoClienteAction (C-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('manager actualiza el límite y audita valorAnterior → valorNuevo en la misma transacción', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'cli-1',
      limiteCredito: 5000,
    } as never);
    vi.mocked(prisma.cliente.update).mockResolvedValue({
      clienteId: 'cli-1',
      limiteCredito: 8000,
    } as never);

    const result = await updateLimiteCreditoClienteAction({
      clienteId: 'cli-1',
      limiteCredito: 8000,
    });

    expect(result.success).toBe(true);
    // B-4: la lectura del valor anterior corre dentro de la transacción con
    // el lock de crédito del cliente.
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.cliente.update).toHaveBeenCalledWith({
      where: { clienteId: 'cli-1' },
      data: { limiteCredito: 8000 },
      select: { clienteId: true, limiteCredito: true },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const auditData = vi.mocked(prisma.auditLog.create).mock.calls[0][0].data;
    expect(auditData.accion).toBe('UPDATE');
    expect(auditData.entidad).toBe('CLIENTE');
    expect(auditData.entidadId).toBe('cli-1');
    expect(auditData.usuarioId).toBe('user-manager');
    expect(auditData.detalles).toMatchObject({
      tipo: 'LIMITE_CREDITO_ACTUALIZADO',
      valorAnterior: 5000,
      valorNuevo: 8000,
    });
  });

  it('dependiente recibe FORBIDDEN y no escribe nada', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(dependienteUser);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'cli-1',
      limiteCredito: 5000,
    } as never);

    const result = await updateLimiteCreditoClienteAction({
      clienteId: 'cli-1',
      limiteCredito: 8000,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error?.code).toBe('FORBIDDEN');
    expect(prisma.cliente.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('manager sin el permiso (set explícito) recibe FORBIDDEN', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...managerUser,
      permissions: new Set(['operaciones.clientes.gestionar']),
    } as unknown as AuthenticatedUser);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'cli-1',
      limiteCredito: 5000,
    } as never);

    const result = await updateLimiteCreditoClienteAction({
      clienteId: 'cli-1',
      limiteCredito: 8000,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error?.code).toBe('FORBIDDEN');
    expect(prisma.cliente.update).not.toHaveBeenCalled();
  });

  it('cliente de otro tenant recibe NOT_FOUND', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);

    const result = await updateLimiteCreditoClienteAction({
      clienteId: 'cli-ajeno',
      limiteCredito: 8000,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(prisma.cliente.update).not.toHaveBeenCalled();
  });

  it('límite null quita el tope y queda auditado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'cli-1',
      limiteCredito: 5000,
    } as never);
    vi.mocked(prisma.cliente.update).mockResolvedValue({
      clienteId: 'cli-1',
      limiteCredito: null,
    } as never);

    const result = await updateLimiteCreditoClienteAction({
      clienteId: 'cli-1',
      limiteCredito: null,
    });

    expect(result.success).toBe(true);
    expect(prisma.cliente.update).toHaveBeenCalledWith({
      where: { clienteId: 'cli-1' },
      data: { limiteCredito: null },
      select: { clienteId: true, limiteCredito: true },
    });
    const auditData = vi.mocked(prisma.auditLog.create).mock.calls[0][0].data;
    expect(auditData.detalles).toMatchObject({
      tipo: 'LIMITE_CREDITO_ACTUALIZADO',
      valorAnterior: 5000,
      valorNuevo: null,
    });
  });

  it('rechaza valores negativos o no enteros', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(managerUser);

    const negativo = await updateLimiteCreditoClienteAction({
      clienteId: 'cli-1',
      limiteCredito: -5,
    });
    const fraccion = await updateLimiteCreditoClienteAction({
      clienteId: 'cli-1',
      limiteCredito: 10.5,
    });

    expect(negativo.success).toBe(false);
    if (negativo.success) throw new Error("Expected action failure");
    expect(negativo.error?.code).toBe('VALIDATION_ERROR');
    expect(fraccion.success).toBe(false);
    if (fraccion.success) throw new Error("Expected action failure");
    expect(fraccion.error?.code).toBe('VALIDATION_ERROR');
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
    expect(prisma.cliente.update).not.toHaveBeenCalled();
  });

  it('requiere autenticación', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await updateLimiteCreditoClienteAction({
      clienteId: 'cli-1',
      limiteCredito: 8000,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error?.code).toBe('AUTH_REQUIRED');
  });
});
