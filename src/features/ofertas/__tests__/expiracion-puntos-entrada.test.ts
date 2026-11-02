/**
 * @description Tests de los puntos de entrada que deben disparar la expiración
 * perezosa de ofertas (Sesión E, H-3).
 *
 * La expiración es perezosa: sin cron, cada lectura o mutación del módulo debe
 * marcar VENCIDA la oferta PENDIENTE vencida antes de operar sobre ella. Si un
 * punto de entrada se salta la expiración, una oferta vencida puede seguir
 * siendo aceptada o facturada desde ese camino.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  oferta: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
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
      deleteMany: vi.fn(),
    },
    cliente: { findFirst: vi.fn() },
    listaPrecio: { findFirst: vi.fn() },
    producto: { findFirst: vi.fn(), findUnique: vi.fn() },
    servicios: { findFirst: vi.fn() },
    turnoPuntoVenta: { findFirst: vi.fn() },
    $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  deleteOfertaAction,
  duplicarOfertaAction,
} from '@/features/ofertas/actions';
import {
  getOfertaForTenant,
  listOfertasForTenant,
} from '@/features/ofertas/services/oferta-read-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'manager',
};

/**
 * @description Detecta si la expiración perezosa se ejecutó (el claim
 * `updateMany` sobre ofertas PENDIENTE vencidas).
 * @returns {boolean} True si se llamó al claim de expiración.
 */
function expiroOfertas(): boolean {
  return vi
    .mocked(prisma.oferta.updateMany)
    .mock.calls.some(
      (call) =>
        (call[0] as { where?: { estado?: unknown } })?.where?.estado === 'PENDIENTE' &&
        Boolean((call[0] as { where?: { fechaVencimiento?: unknown } })?.where?.fechaVencimiento),
    );
}

describe('Sesión E — expiración en todos los puntos de entrada (H-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.oferta.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.oferta.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.oferta.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.oferta.create).mockResolvedValue({ id: 'of-copy' } as never);
    mockTx.oferta.findFirst.mockResolvedValue(null);
    mockTx.oferta.updateMany.mockResolvedValue({ count: 1 });
    mockTx.oferta.deleteMany.mockResolvedValue({ count: 1 });
  });

  it('expira antes de listar las ofertas del tenant', async () => {
    await listOfertasForTenant('tenant-test');

    expect(expiroOfertas()).toBe(true);
    expect(
      vi.mocked(prisma.oferta.updateMany).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(prisma.oferta.findMany).mock.invocationCallOrder[0],
    );
  });

  it('expira antes de leer una oferta concreta', async () => {
    await getOfertaForTenant('of-1', 'tenant-test');

    expect(expiroOfertas()).toBe(true);
  });

  it('expira antes de eliminar una oferta', async () => {
    await deleteOfertaAction('of-1');

    expect(expiroOfertas()).toBe(true);
  });

  it('expira antes de duplicar una oferta', async () => {
    vi.mocked(prisma.oferta.findFirst)
      .mockResolvedValueOnce({
        id: 'of-1',
        tenantId: 'tenant-test',
        clienteId: 'cli-1',
        cliente: { listaPrecioId: null },
        items: [],
        observaciones: null,
        impuestos: 0,
        subtotal: 0,
        total: 0,
        fechaVencimiento: null,
      } as never)
      .mockResolvedValueOnce(null as never);
    vi.mocked(prisma.oferta.create).mockResolvedValue({ id: 'of-copy' } as never);

    const result = await duplicarOfertaAction('of-1');

    expect(result.success).toBe(true);
    expect(expiroOfertas()).toBe(true);
  });
});
