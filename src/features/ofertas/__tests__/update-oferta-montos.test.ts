/**
 * @description Tests de la edición de montos (impuestos) de una oferta sin
 * replacement de ítems (Sesión E, H-5).
 *
 * El servidor es la autoridad de la aritmética: cuando el cliente declara
 * impuestos sin enviar ítems, el total se recalcula sobre el subtotal
 * persistido y los impuestos se validan contra ese subtotal.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expectActionFailure } from '@/test/action-response';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/ventas/services/facturacion-workflow', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/ventas/services/facturacion-workflow')>()),
  applyFacturacionCobroWorkflow: vi.fn(),
}));
vi.mock('@/lib/services/anticipos-workflow', () => ({ applyAnticipoAllocations: vi.fn() }));
vi.mock('@/features/turnos-pos', () => ({ getOrCreateTurnoActivo: vi.fn() }));
vi.mock('@/lib/services/fifo-allocation', () => ({ allocateFifoForSale: vi.fn() }));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({ upsertStockUbicacion: vi.fn() }));

const mockTx = {
  $executeRaw: vi.fn(),
  oferta: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  venta: { create: vi.fn(), findFirst: vi.fn() },
  ventaServicios: { create: vi.fn() },
  servicios: { findFirst: vi.fn() },
  factura: { create: vi.fn() },
  serieFacturacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  producto: { findUnique: vi.fn() },
  stockUbicacion: { findUnique: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    oferta: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    cliente: { findFirst: vi.fn() },
    producto: { findFirst: vi.fn() },
    turnoPuntoVenta: { findFirst: vi.fn() },
    $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { updateOfertaAction } from '@/features/ofertas/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'manager',
};

const ofertaPENDIENTE = {
  id: 'of-1',
  tenantId: 'tenant-test',
  estado: 'PENDIENTE',
  subtotal: 100,
  impuestos: 10,
  total: 110,
  fechaVencimiento: null,
  cliente: { listaPrecioId: null },
};

describe('Sesión E — edición de montos sin ítems (H-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(ofertaPENDIENTE as never);
    mockTx.oferta.findFirst.mockImplementation((args: unknown) =>
      prisma.oferta.findFirst(args as never),
    );
    mockTx.oferta.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(prisma.oferta.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.oferta.update).mockResolvedValue(ofertaPENDIENTE as never);
  });

  it('aplica los impuestos declarados y recalcula el total sobre el subtotal', async () => {
    const result = await updateOfertaAction({ ofertaId: 'of-1', impuestos: 25 });

    expect(result.success).toBe(true);
    expect(mockTx.oferta.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'of-1', tenantId: 'tenant-test' }),
        data: expect.objectContaining({ impuestos: 25, total: 125 }),
      }),
    );
  });

  it('conserva las observaciones cuando solo cambian los montos', async () => {
    const result = await updateOfertaAction({
      ofertaId: 'of-1',
      observaciones: ' nota',
      impuestos: 25,
    });

    expect(result.success).toBe(true);
    expect(mockTx.oferta.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ observaciones: ' nota', impuestos: 25, total: 125 }),
      }),
    );
  });

  it('rechaza con TAX_INVALID si los impuestos superan el subtotal persistido', async () => {
    const result = await updateOfertaAction({ ofertaId: 'of-1', impuestos: 500 });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('TAX_INVALID');
    expect(mockTx.oferta.updateMany).not.toHaveBeenCalled();
  });

  it('rechaza editar los montos de una oferta que ya no está PENDIENTE', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
      ...ofertaPENDIENTE,
      estado: 'ACEPTADA',
    } as never);

    const result = await updateOfertaAction({ ofertaId: 'of-1', impuestos: 25 });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('MONTOS_NO_EDITABLES');
    expect(mockTx.oferta.updateMany).not.toHaveBeenCalled();
  });
});
