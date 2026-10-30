/**
 * @description Tests de expiración perezosa (estado VENCIDA), matriz de
 * transiciones y guardas de estado de ofertas (E-2).
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
  oferta: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  venta: { create: vi.fn() },
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
    $transaction: vi.fn((cb: any) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getOfertasAction,
  getOfertaByIdAction,
  updateOfertaAction,
  deleteOfertaAction,
  facturarOfertaAction,
} from '@/features/ofertas/actions';
import { expirarOfertasVencidas } from '@/features/ofertas/services/expiracion-ofertas-service';
import { transicionPermitida } from '@/features/ofertas/lib/transiciones-estado';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'manager',
};

describe('E-2 expiración perezosa (VENCIDA)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockTx.oferta.findFirst.mockImplementation((args: unknown) => prisma.oferta.findFirst(args as never));
    mockTx.oferta.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(prisma.oferta.updateMany).mockResolvedValue({ count: 0 } as any);
  });

  it('expira PENDIENTE con fechaVencimiento pasada, sin tocar otros estados', async () => {
    vi.mocked(prisma.oferta.updateMany).mockResolvedValue({ count: 2 } as any);
    const count = await expirarOfertasVencidas('tenant-test');
    expect(count).toBe(2);
    expect(prisma.oferta.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-test',
        estado: 'PENDIENTE',
        fechaVencimiento: { lt: expect.any(Date) },
      },
      data: { estado: 'VENCIDA' },
    });
  });

  it('getOfertasAction expira antes de listar', async () => {
    vi.mocked(prisma.oferta.findMany).mockResolvedValue([]);
    const result = await getOfertasAction();
    expect(result.success).toBe(true);
    expect(prisma.oferta.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-test', estado: 'PENDIENTE' }),
        data: { estado: 'VENCIDA' },
      }),
    );
  });

  it('getOfertaByIdAction expira antes de leer', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ id: 'of-1' } as any);
    const result = await getOfertaByIdAction('of-1');
    expect(result.success).toBe(true);
    expect(prisma.oferta.updateMany).toHaveBeenCalled();
  });

  it('facturarOfertaAction rechaza una oferta VENCIDA', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
      id: 'of-v', estado: 'VENCIDA', clienteId: 'cli-1', tenantId: 'tenant-test',
      subtotal: 100, impuestos: 0, total: 100, items: [], cliente: { clienteId: 'cli-1' },
    } as any);

    const result = await facturarOfertaAction({ ofertaId: 'of-v', puntoDeVentaId: 'pv-1' });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.message).toContain('vencida');
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('VALIDATION_ERROR');
  });
});

describe('E-2 matriz de transiciones', () => {
  it('solo PENDIENTE puede pasar a ACEPTADA o RECHAZADA', () => {
    expect(transicionPermitida('PENDIENTE', 'ACEPTADA')).toBe(true);
    expect(transicionPermitida('PENDIENTE', 'RECHAZADA')).toBe(true);
    expect(transicionPermitida('PENDIENTE', 'FACTURADA')).toBe(false);
    expect(transicionPermitida('ACEPTADA', 'FACTURADA')).toBe(false);
    expect(transicionPermitida('FACTURADA', 'PENDIENTE')).toBe(false);
    expect(transicionPermitida('VENCIDA', 'PENDIENTE')).toBe(false);
    expect(transicionPermitida('RECHAZADA', 'PENDIENTE')).toBe(false);
  });
});

describe('E-2 guardas de estado en actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockTx.oferta.findFirst.mockImplementation((args: unknown) => prisma.oferta.findFirst(args as never));
    mockTx.oferta.updateMany.mockResolvedValue({ count: 1 });
  });

  it('updateOfertaAction permite PENDIENTE → ACEPTADA', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ id: 'of-1', estado: 'PENDIENTE' } as any);
    vi.mocked(prisma.oferta.updateMany).mockResolvedValue({ count: 1 } as any);

    const result = await updateOfertaAction({ ofertaId: 'of-1', estado: 'ACEPTADA' });

    expect(result.success).toBe(true);
    expect(mockTx.oferta.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'of-1', estado: 'PENDIENTE' }),
        data: expect.objectContaining({ estado: 'ACEPTADA' }),
      }),
    );
    expect(prisma.oferta.update).not.toHaveBeenCalled();
  });

  it('updateOfertaAction rechaza FACTURADA → PENDIENTE', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ id: 'of-1', estado: 'FACTURADA' } as any);

    const result = await updateOfertaAction({ ofertaId: 'of-1', estado: 'PENDIENTE' });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('ESTADO_TRANSICION_INVALIDA');
    expect(prisma.oferta.update).not.toHaveBeenCalled();
  });

  it('updateOfertaAction rechaza VENCIDA → PENDIENTE', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ id: 'of-1', estado: 'VENCIDA' } as any);

    const result = await updateOfertaAction({ ofertaId: 'of-1', estado: 'PENDIENTE' });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('ESTADO_TRANSICION_INVALIDA');
    expect(prisma.oferta.update).not.toHaveBeenCalled();
  });

  it('updateOfertaAction rechaza ACEPTADA → FACTURADA (facturar es el único camino)', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ id: 'of-1', estado: 'ACEPTADA' } as any);

    const result = await updateOfertaAction({ ofertaId: 'of-1', estado: 'FACTURADA' });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('ESTADO_TRANSICION_INVALIDA');
  });

  it('updateOfertaAction permite editar observaciones en FACTURADA sin cambiar estado', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ id: 'of-1', estado: 'FACTURADA' } as any);
    vi.mocked(prisma.oferta.update).mockResolvedValue({ id: 'of-1' } as any);

    const result = await updateOfertaAction({ ofertaId: 'of-1', observaciones: 'nota' });

    expect(result.success).toBe(true);
    expect(prisma.oferta.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ observaciones: 'nota' }) }),
    );
  });

  it('updateOfertaAction expira las vencidas antes de leer (toque de módulo)', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ id: 'of-1', estado: 'PENDIENTE' } as any);
    vi.mocked(prisma.oferta.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.oferta.update).mockResolvedValue({ id: 'of-1' } as any);

    const result = await updateOfertaAction({ ofertaId: 'of-1', observaciones: 'nota' });

    expect(result.success).toBe(true);
    expect(prisma.oferta.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-test', estado: 'PENDIENTE' }),
        data: { estado: 'VENCIDA' },
      }),
    );
  });

  it('updateOfertaAction rechaza aceptar una PENDIENTE que ya venció', async () => {
    const fechaPasada = new Date(Date.now() - 86_400_000);
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
      id: 'of-1', estado: 'PENDIENTE', fechaVencimiento: fechaPasada,
    } as any);
    vi.mocked(prisma.oferta.updateMany).mockResolvedValue({ count: 0 } as any);

    const result = await updateOfertaAction({ ofertaId: 'of-1', estado: 'ACEPTADA' });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('OFERTA_VENCIDA');
    expect(prisma.oferta.update).not.toHaveBeenCalled();
  });

  it('updateOfertaAction rechaza con ESTADO_TRANSICION_INVALIDA si el estado cambió concurrentemente', async () => {
    // 1ª lectura: PENDIENTE (pasa la matriz); relectura tras el claim fallido:
    // ACEPTADA (cambio concurrente). Sin cola mockOnce: no contamina otros tests.
    vi.mocked(prisma.oferta.findFirst)
      .mockResolvedValueOnce({ id: 'of-1', estado: 'PENDIENTE' } as never)
      .mockResolvedValueOnce({ id: 'of-1', estado: 'ACEPTADA' } as never);
    vi.mocked(prisma.oferta.updateMany).mockResolvedValue({ count: 0 } as any);

    const result = await updateOfertaAction({ ofertaId: 'of-1', estado: 'ACEPTADA' });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('ESTADO_TRANSICION_INVALIDA');
    expect(prisma.oferta.update).not.toHaveBeenCalled();
  });

  it('deleteOfertaAction rechaza eliminar una FACTURADA en servidor', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ id: 'of-1', estado: 'FACTURADA' } as any);

    const result = await deleteOfertaAction('of-1');

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('ESTADO_NO_ELIMINABLE');
    expect(prisma.oferta.delete).not.toHaveBeenCalled();
  });
});
