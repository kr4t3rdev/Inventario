/**
 * @description Tests de coherencia del borrado de ofertas (Sesión E, H-4).
 *
 * El borrado se hace con el mismo lock que usan la facturación, la conversión
 * y la edición de ítems, y con un claim condicional al estado releído: sin
 * eso, una facturación concurrente podía dejar una factura huérfana al
 * borrarse la oferta.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expectActionFailure } from '@/test/action-response';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockTx = {
  $executeRaw: vi.fn(),
  oferta: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  venta: { findFirst: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    oferta: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { deleteOfertaAction } from '@/features/ofertas/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const usuario: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Test',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-test',
  tenantRole: 'manager',
};

describe('Sesión E — borrado de ofertas (H-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(usuario);
    vi.mocked(prisma.oferta.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.oferta.updateMany).mockResolvedValue({ count: 0 } as never);
    mockTx.oferta.findFirst.mockResolvedValue({ id: 'of-1', estado: 'PENDIENTE' });
    mockTx.oferta.deleteMany.mockResolvedValue({ count: 1 });
    mockTx.venta.findFirst.mockResolvedValue(null);
  });

  it('toma el lock transaccional de la oferta antes de borrarla', async () => {
    const result = await deleteOfertaAction('of-1');

    expect(result.success).toBe(true);
    expect(mockTx.$executeRaw).toHaveBeenCalled();
  });

  it('borra con un claim condicional al estado releído bajo lock', async () => {
    const result = await deleteOfertaAction('of-1');

    expect(result.success).toBe(true);
    expect(mockTx.oferta.deleteMany).toHaveBeenCalledWith({
      where: { id: 'of-1', tenantId: 'tenant-test', estado: 'PENDIENTE' },
    });
  });

  it('rechaza con OFERTA_CON_VENTA_VINCULADA si la oferta tiene una venta viva', async () => {
    mockTx.venta.findFirst.mockResolvedValue({ ventaId: 'venta-1' });

    const result = await deleteOfertaAction('of-1');

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('OFERTA_CON_VENTA_VINCULADA');
    expect(mockTx.oferta.deleteMany).not.toHaveBeenCalled();
  });

  it('rechaza con ESTADO_NO_ELIMINABLE si la oferta está FACTURADA', async () => {
    mockTx.oferta.findFirst.mockResolvedValue({ id: 'of-1', estado: 'FACTURADA' });

    const result = await deleteOfertaAction('of-1');

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('ESTADO_NO_ELIMINABLE');
    expect(mockTx.oferta.deleteMany).not.toHaveBeenCalled();
  });

  it('devuelve CONFLICT si el claim del borrado pierde la carrera', async () => {
    mockTx.oferta.deleteMany.mockResolvedValue({ count: 0 });

    const result = await deleteOfertaAction('of-1');

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('CONFLICT');
  });

  it('devuelve NOT_FOUND si la oferta no existe', async () => {
    mockTx.oferta.findFirst.mockResolvedValue(null);

    const result = await deleteOfertaAction('of-1');

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('NOT_FOUND');
  });
});
