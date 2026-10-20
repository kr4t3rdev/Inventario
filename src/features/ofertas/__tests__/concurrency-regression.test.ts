import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { tx, db, workflow, lock } = vi.hoisted(() => {
  const tx = {
    oferta: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    ofertaItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    venta: { findFirst: vi.fn(), create: vi.fn() },
  };
  const db = {
    oferta: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    puntoDeVenta: { findFirst: vi.fn() }, venta: { findFirst: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { tx, db, workflow: vi.fn(), lock: vi.fn() };
});
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: vi.fn(async () => ({
  userId: 'user', tenantId: 'tenant', role: 'admin', tenantRole: 'admin', isActive: true,
})) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../lib/oferta-lock', () => ({ lockOferta: lock }));
vi.mock('../lib/resolver-items-oferta', () => ({ resolverItemsOferta: vi.fn(async () => [
  { productoId: 'product', servicioId: null, cantidad: 1, precioUnitario: 100 },
]) }));
vi.mock('../services/facturar-oferta-workflow', () => ({ facturarOfertaWorkflow: workflow }));
vi.mock('@/features/turnos-pos', () => ({ getOrCreateTurnoActivo: vi.fn(async () => ({
  success: true, data: { turnoId: 'turn' },
})) }));
vi.mock('@/lib/services/anticipos-workflow', () => ({ applyAnticipoAllocations: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({ AuditLogService: { logStrict: vi.fn() } }));

import { updateOfertaAction, facturarOfertaAction } from '../actions';
import { convertirOfertaAPedido } from '../services/convertir-oferta-pedido';

const offer = {
  id: 'offer', tenantId: 'tenant', estado: 'PENDIENTE', clienteId: 'client',
  fechaVencimiento: new Date('2030-01-01T00:00:01Z'), subtotal: 100, impuestos: 0, total: 100,
  cliente: { listaPrecioId: null },
  items: [{ productoId: 'product', servicioId: null, cantidad: 1, precioUnitario: 100, total: 100 }],
};

describe('offer lock regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    db.oferta.findFirst.mockResolvedValue(offer);
    db.oferta.updateMany.mockResolvedValue({ count: 1 });
    db.oferta.update.mockResolvedValue(offer);
    db.puntoDeVenta.findFirst.mockResolvedValue({ pvId: 'pv' });
    db.venta.findFirst.mockResolvedValue(null);
    tx.oferta.findFirst.mockResolvedValue(offer);
    tx.oferta.update.mockResolvedValue(offer);
    tx.oferta.updateMany.mockReset().mockResolvedValue({ count: 1 });
    tx.venta.findFirst.mockResolvedValue(null);
    tx.venta.create.mockResolvedValue({ ventaId: 'sale' });
    workflow.mockResolvedValue({ ventaId: 'sale' });
    lock.mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('serializes status transitions and revalidates rejection after waiting', async () => {
    lock.mockImplementation(async () => {
      tx.oferta.findFirst.mockResolvedValue({ ...offer, estado: 'RECHAZADA' });
    });
    const result = await updateOfertaAction({ ofertaId: 'offer', estado: 'ACEPTADA' });
    expect(result).toMatchObject({ success: false, error: { code: 'ESTADO_TRANSICION_INVALIDA' } });
    expect(lock).toHaveBeenCalledWith(tx, 'tenant', 'offer');
    expect(tx.oferta.updateMany).not.toHaveBeenCalled();
  });

  it('does not revive lazy expiration after the locked read and before item persistence', async () => {
    tx.ofertaItem.createMany.mockImplementationOnce(async () => {
      tx.oferta.updateMany.mockResolvedValueOnce({ count: 0 });
    });
    expect(await updateOfertaAction({ ofertaId: 'offer', estado: 'PENDIENTE',
      items: [{ productoId: 'product', cantidad: 2 }],
    })).toMatchObject({ success: false, error: { code: 'ITEMS_NO_EDITABLES' } });
    expect(tx.oferta.update).not.toHaveBeenCalled();
  });

  it.each(['invoice', 'order'] as const)('rejects %s when pending offer expires during lock wait', async (kind) => {
    lock.mockImplementation(async () => vi.setSystemTime(new Date('2030-01-01T00:00:02Z')));
    if (kind === 'invoice') {
      expect(await facturarOfertaAction({ ofertaId: 'offer', puntoDeVentaId: 'pv' }))
        .toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR', message: expect.stringContaining('vencida') } });
    } else {
      await expect(convertirOfertaAPedido({ ofertaId: 'offer', puntoDeVentaId: 'pv', tenantId: 'tenant' }))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining('vencida') });
    }
    expect(workflow).not.toHaveBeenCalled();
    expect(tx.venta.create).not.toHaveBeenCalled();
    expect(tx.oferta.updateMany).not.toHaveBeenCalled();
  });

  it.each(['invoice', 'order'] as const)('preserves accepted offer expiry semantics for %s', async (kind) => {
    const accepted = { ...offer, estado: 'ACEPTADA', fechaVencimiento: new Date('2029-01-01') };
    db.oferta.findFirst.mockResolvedValue(accepted);
    tx.oferta.findFirst.mockResolvedValue(accepted);
    if (kind === 'invoice') {
      expect((await facturarOfertaAction({ ofertaId: 'offer', puntoDeVentaId: 'pv' })).success).toBe(true);
    } else {
      expect(await convertirOfertaAPedido({ ofertaId: 'offer', puntoDeVentaId: 'pv', tenantId: 'tenant' }))
        .toEqual({ ventaId: 'sale', creado: true });
    }
  });
});
