/**
 * @description Tests de edición de ítems en ofertas PENDIENTE y duplicación de
 * ofertas con precios re-resueltos (E-4).
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
  ofertaItem: { deleteMany: vi.fn(), createMany: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    oferta: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    cliente: { findFirst: vi.fn() },
    listaPrecio: { findFirst: vi.fn() },
    producto: { findFirst: vi.fn() },
    servicios: { findFirst: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { updateOfertaAction, duplicarOfertaAction } from '@/features/ofertas/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'manager',
};

const ofertaPendiente = {
  id: 'of-1',
  tenantId: 'tenant-test',
  estado: 'PENDIENTE',
  clienteId: 'cli-1',
  impuestos: 0,
  cliente: { clienteId: 'cli-1', listaPrecioId: null },
};

describe('E-4 edición de ítems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.oferta.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
  });

  it('reemplaza ítems atómicamente en PENDIENTE con precios re-resueltos', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(ofertaPendiente as any);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1', tenantId: 'tenant-test', precioVenta: 150, precios: [],
    } as any);
    mockTx.oferta.findFirst.mockResolvedValue(ofertaPendiente as any);
    mockTx.oferta.update.mockResolvedValue({ id: 'of-1' });

    const result = await updateOfertaAction({
      ofertaId: 'of-1',
      items: [{ productoId: 'prod-1', cantidad: 2 }],
    });

    expect(result.success).toBe(true);
    expect(mockTx.ofertaItem.deleteMany).toHaveBeenCalledWith({ where: { ofertaId: 'of-1' } });
    expect(mockTx.ofertaItem.createMany).toHaveBeenCalledWith({
      data: [{ ofertaId: 'of-1', productoId: 'prod-1', servicioId: null, cantidad: 2, precioUnitario: 150, total: 300 }],
    });
    expect(mockTx.oferta.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'of-1', tenantId: 'tenant-test', estado: 'PENDIENTE' }),
      data: expect.objectContaining({ subtotal: 300, impuestos: 0, total: 300 }),
    }));
    expect(prisma.oferta.update).not.toHaveBeenCalled();
  });

  it('rechaza edición de ítems fuera de PENDIENTE (ITEMS_NO_EDITABLES)', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ ...ofertaPendiente, estado: 'ACEPTADA' } as any);

    const result = await updateOfertaAction({
      ofertaId: 'of-1',
      items: [{ productoId: 'prod-1', cantidad: 2 }],
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('ITEMS_NO_EDITABLES');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('conserva los impuestos existentes y los valida contra el nuevo subtotal', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({ ...ofertaPendiente, impuestos: 500 } as any);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1', tenantId: 'tenant-test', precioVenta: 100, precios: [],
    } as any);

    const result = await updateOfertaAction({
      ofertaId: 'of-1',
      items: [{ productoId: 'prod-1', cantidad: 1 }],
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('TAX_INVALID');
    expect(mockTx.ofertaItem.deleteMany).not.toHaveBeenCalled();
  });

  it('rechaza ítem de producto de otro tenant', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(ofertaPendiente as any);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue(null);

    const result = await updateOfertaAction({
      ofertaId: 'of-1',
      items: [{ productoId: 'prod-ajeno', cantidad: 1 }],
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('NOT_FOUND');
  });

  it('relee el estado dentro de la transacción y aborta si dejó de ser PENDIENTE', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(ofertaPendiente as any);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1', tenantId: 'tenant-test', precioVenta: 150, precios: [],
    } as any);
    // La oferta fue aceptada por otro usuario después de la lectura inicial.
    mockTx.oferta.findFirst.mockResolvedValue({ ...ofertaPendiente, estado: 'ACEPTADA' } as any);

    const result = await updateOfertaAction({
      ofertaId: 'of-1',
      items: [{ productoId: 'prod-1', cantidad: 2 }],
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('ITEMS_NO_EDITABLES');
    expect(mockTx.ofertaItem.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.ofertaItem.createMany).not.toHaveBeenCalled();
  });

  it('toma el lock advisory de la oferta antes de reemplazar los ítems', async () => {
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(ofertaPendiente as any);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1', tenantId: 'tenant-test', precioVenta: 150, precios: [],
    } as any);
    mockTx.oferta.findFirst.mockResolvedValue(ofertaPendiente as any);
    mockTx.oferta.update.mockResolvedValue({ id: 'of-1' });

    const result = await updateOfertaAction({
      ofertaId: 'of-1',
      items: [{ productoId: 'prod-1', cantidad: 2 }],
    });

    expect(result.success).toBe(true);
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('aborta la edición si la oferta venció mientras se editaba', async () => {
    const fechaPasada = new Date(Date.now() - 86_400_000);
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(ofertaPendiente as any);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1', tenantId: 'tenant-test', precioVenta: 150, precios: [],
    } as any);
    mockTx.oferta.findFirst.mockResolvedValue({ ...ofertaPendiente, fechaVencimiento: fechaPasada } as any);

    const result = await updateOfertaAction({
      ofertaId: 'of-1',
      items: [{ productoId: 'prod-1', cantidad: 2 }],
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('OFERTA_VENCIDA');
    expect(mockTx.ofertaItem.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.oferta.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'of-1', estado: 'PENDIENTE' }),
        data: { estado: 'VENCIDA' },
      }),
    );
  });
});

describe('E-4 duplicación de oferta', () => {
  const fechaFutura = new Date(Date.now() + 86_400_000);
  const fechaPasada = new Date(Date.now() - 86_400_000);

  const ofertaOriginal = {
    id: 'of-1',
    tenantId: 'tenant-test',
    clienteId: 'cli-1',
    observaciones: 'original',
    impuestos: 30,
    fechaVencimiento: fechaFutura,
    estado: 'ACEPTADA',
    cliente: { clienteId: 'cli-1', listaPrecioId: null },
    items: [
      { productoId: 'prod-1', servicioId: null, cantidad: 2, precioUnitario: 100, total: 200 },
    ],
  };

  const mockLecturaYNumero = (oferta: object | null) => {
    vi.mocked(prisma.oferta.findFirst)
      .mockResolvedValueOnce(oferta as never)
      .mockResolvedValue({ numeroOferta: 'OF-000003' } as never);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.oferta.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
  });

  it('duplica con número nuevo, PENDIENTE y precios re-resueltos al día', async () => {
    mockLecturaYNumero(ofertaOriginal);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1', tenantId: 'tenant-test', precioVenta: 150, precios: [],
    } as any);
    vi.mocked(prisma.oferta.create).mockResolvedValue({ id: 'of-9' } as any);

    const result = await duplicarOfertaAction('of-1');

    expect(result.success).toBe(true);
    expect(prisma.oferta.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-test',
        numeroOferta: 'OF-000004',
        estado: 'PENDIENTE',
        clienteId: 'cli-1',
        observaciones: 'original',
        subtotal: 300,
        impuestos: 30,
        total: 330,
        fechaVencimiento: fechaFutura,
        items: {
          create: [expect.objectContaining({ productoId: 'prod-1', cantidad: 2, precioUnitario: 150, total: 300 })],
        },
      }),
    }));
  });

  it('limpia la fechaVencimiento ya vencida en la copia', async () => {
    mockLecturaYNumero({ ...ofertaOriginal, fechaVencimiento: fechaPasada });
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1', tenantId: 'tenant-test', precioVenta: 150, precios: [],
    } as any);
    vi.mocked(prisma.oferta.create).mockResolvedValue({ id: 'of-10' } as any);

    const result = await duplicarOfertaAction('of-1');

    expect(result.success).toBe(true);
    expect(prisma.oferta.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fechaVencimiento: null }),
    }));
  });

  it('rechaza duplicar una oferta de otro tenant', async () => {
    mockLecturaYNumero(null);

    const result = await duplicarOfertaAction('of-ajena');

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('NOT_FOUND');
    expect(prisma.oferta.create).not.toHaveBeenCalled();
  });

  it('rechaza duplicar cuando los impuestos originales superan el nuevo subtotal', async () => {
    mockLecturaYNumero(ofertaOriginal);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1', tenantId: 'tenant-test', precioVenta: 10, precios: [],
    } as any);

    const result = await duplicarOfertaAction('of-1');

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error!.code).toBe('TAX_INVALID');
    expect(prisma.oferta.create).not.toHaveBeenCalled();
  });
});
