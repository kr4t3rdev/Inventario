/**
 * @description Tests del claim fallido en la transición de estado de una oferta
 * (Sesión E, H-6 y H-7).
 *
 * Cuando el claim condicional no aplica, la oferta se relee para distinguir
 * dos causas con mensajes distintos: expiró (OFERTA_VENCIDA, y se marca
 * VENCIDA) o cambió de estado por otra operación (transición inválida).
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

describe('Sesión E — claim fallido en la transición de estado (H-6, H-7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(ofertaPENDIENTE as never);
    mockTx.oferta.findFirst.mockImplementation((args: unknown) =>
      prisma.oferta.findFirst(args as never),
    );
    vi.mocked(prisma.oferta.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.oferta.update).mockResolvedValue(ofertaPENDIENTE as never);
  });

  it('H-7 — informa transición inválida cuando el claim no aplica por cambio de estado', async () => {
    // El claim atómico no aplica: otra operación movió la oferta.
    mockTx.oferta.updateMany.mockResolvedValue({ count: 0 });

    const result = await updateOfertaAction({ ofertaId: 'of-1', estado: 'ACEPTADA' });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('ESTADO_TRANSICION_INVALIDA');
  });

  it('H-6 — informa OFERTA_VENCIDA cuando la expiración ganó el claim', async () => {
    mockTx.oferta.updateMany.mockResolvedValue({ count: 0 });
    // La expiración perezosa marcó la oferta entre la lectura inicial y el
    // claim: la relectura del claim fallido lo distingue.
    vi.mocked(prisma.oferta.findFirst)
      .mockResolvedValueOnce(ofertaPENDIENTE as never)
      .mockResolvedValueOnce(ofertaPENDIENTE as never)
      .mockResolvedValueOnce({ ...ofertaPENDIENTE, estado: 'VENCIDA' } as never);

    const result = await updateOfertaAction({ ofertaId: 'of-1', estado: 'ACEPTADA' });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('OFERTA_VENCIDA');
  });

  it('H-6 — marca VENCIDA e informa OFERTA_VENCIDA si la oferta venció sin marcar', async () => {
    mockTx.oferta.updateMany.mockResolvedValue({ count: 0 });
    vi.mocked(prisma.oferta.findFirst)
      .mockResolvedValueOnce(ofertaPENDIENTE as never)
      .mockResolvedValueOnce(ofertaPENDIENTE as never)
      .mockResolvedValueOnce({
        ...ofertaPENDIENTE,
        fechaVencimiento: new Date('2020-01-01T00:00:00.000Z'),
      } as never);

    const result = await updateOfertaAction({ ofertaId: 'of-1', estado: 'ACEPTADA' });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('OFERTA_VENCIDA');
    expect(mockTx.oferta.updateMany).toHaveBeenCalledWith({
      where: { id: 'of-1', tenantId: 'tenant-test', estado: 'PENDIENTE' },
      data: { estado: 'VENCIDA' },
    });
  });
});
