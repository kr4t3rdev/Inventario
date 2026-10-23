import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { prismaMock, txMock, authUser } = vi.hoisted(() => {
  const valeSalida = { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
  const valeSalidaItem = { findMany: vi.fn(), create: vi.fn() };
  const producto = { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
  const almacen = { findFirst: vi.fn() };
  const stockUbicacion = { findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() };
  const txMock = { valeSalida, valeSalidaItem, producto, almacen, stockUbicacion };
  const prismaMock = { ...txMock, $transaction: vi.fn(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)) };
  const authUser = { userId: 'user-1', role: 'user', tenantId: 'tenant-1', tenantRole: 'manager', permissions: new Set(['produccion.vales.gestionar']) };
  return { prismaMock, txMock, authUser };
});

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, default: prismaMock }));
vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: Function) => (request: NextRequest, context: unknown) => handler(request, context, authUser),
  withAuthPost: (handler: Function) => (request: NextRequest, context: unknown) => handler(request, context, authUser),
  withAuth: (handler: Function) => (request: NextRequest, context: unknown) => handler(request, context, authUser),
}));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({ upsertStockUbicacion: vi.fn() }));

import { GET as getVale, PATCH as patchVale, DELETE as deleteVale } from '../[id]/route';
import { GET as getValePdf } from '../[id]/pdf/route';
import { GET as listVales, POST as createVale } from '../route';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';

const context = { params: Promise.resolve({ id: 'vale-1' }) };

describe('vales API tenant ownership', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authUser.tenantId = 'tenant-1';
    authUser.permissions.clear();
    authUser.permissions.add('produccion.vales.gestionar');
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock));
  });

  it('requires the manager permission before any database read or write', async () => {
    authUser.permissions.clear();
    const response = await listVales(new NextRequest('http://localhost/api/vales'), {});
    expect(response.status).toBe(403);
    expect(prismaMock.valeSalida.findMany).not.toHaveBeenCalled();
  });

  it('fails closed without tenant context before touching the database', async () => {
    Object.assign(authUser, { tenantId: undefined });
    const response = await listVales(new NextRequest('http://localhost/api/vales'), {});
    expect(response.status).toBe(403);
    expect(prismaMock.valeSalida.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', () => getVale(new NextRequest('http://localhost/api/vales/vale-1'), context)],
    ['PATCH', () => patchVale(new NextRequest('http://localhost/api/vales/vale-1', { method: 'PATCH', body: JSON.stringify({ concepto: 'Cambio' }) }), context)],
    ['DELETE', () => deleteVale(new NextRequest('http://localhost/api/vales/vale-1', { method: 'DELETE' }), context)],
    ['PDF', () => getValePdf(new NextRequest('http://localhost/api/vales/vale-1/pdf'), context)],
  ])('%s scopes the vale lookup to the authenticated tenant', async (_method, invoke) => {
    prismaMock.valeSalida.findFirst.mockResolvedValue(null);
    const response = await invoke();
    expect(response.status).toBe(404);
    expect(prismaMock.valeSalida.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { valeSalidaId: 'vale-1', tenantId: 'tenant-1' },
    }));
    expect(prismaMock.valeSalida.update).not.toHaveBeenCalled();
    expect(prismaMock.producto.update).not.toHaveBeenCalled();
  });

  it('rejects a product outside the authenticated tenant before creating or decrementing stock', async () => {
    txMock.producto.findFirst.mockResolvedValue(null);
    const response = await createVale(new NextRequest('http://localhost/api/vales', {
      method: 'POST', body: JSON.stringify({ concepto: 'Salida', items: [{ productoId: 'foreign-product', cantidad: 1 }] }),
    }), {});
    expect(response.status).toBe(400);
    expect(txMock.producto.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'foreign-product', tenantId: 'tenant-1' },
    }));
    expect(txMock.valeSalida.create).not.toHaveBeenCalled();
    expect(txMock.valeSalidaItem.create).not.toHaveBeenCalled();
  });

  it('hides malformed cross-tenant child rows instead of returning them', async () => {
    prismaMock.valeSalida.findFirst.mockResolvedValue({
      valeSalidaId: 'vale-1', tenantId: 'tenant-1',
      ValeSalidaItem: [{ tenantId: 'tenant-foreign', Producto: { tenantId: 'tenant-foreign' } }],
    });
    const response = await getVale(new NextRequest('http://localhost/api/vales/vale-1'), context);
    expect(response.status).toBe(404);
  });

  it('does not edit a vale whose attached product belongs to another tenant', async () => {
    prismaMock.valeSalida.findFirst.mockResolvedValue({
      valeSalidaId: 'vale-1', tenantId: 'tenant-1', estado: 'pendiente',
      ValeSalidaItem: [{ tenantId: 'tenant-1', Producto: { tenantId: 'tenant-foreign' } }],
    });
    const response = await patchVale(new NextRequest('http://localhost/api/vales/vale-1', {
      method: 'PATCH', body: JSON.stringify({ concepto: 'Cambio' }),
    }), context);
    expect(response.status).toBe(404);
    expect(prismaMock.valeSalida.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a foreign warehouse before creating the vale', async () => {
    txMock.producto.findFirst.mockResolvedValue({ id: 'product-1', nombre: 'Own', almacenId: 'foreign-warehouse' });
    txMock.almacen.findFirst.mockResolvedValue(null);
    const response = await createVale(new NextRequest('http://localhost/api/vales', {
      method: 'POST', body: JSON.stringify({ concepto: 'Salida', items: [{ productoId: 'product-1', cantidad: 1 }] }),
    }), {});
    expect(response.status).toBe(400);
    expect(txMock.almacen.findFirst).toHaveBeenCalledWith({
      where: { almacenId: 'foreign-warehouse', tenantId: 'tenant-1' }, select: { almacenId: true },
    });
    expect(txMock.valeSalida.create).not.toHaveBeenCalled();
    expect(upsertStockUbicacion).not.toHaveBeenCalled();
  });

  it('rejects a stock location outside the authenticated tenant before writing', async () => {
    txMock.producto.findFirst.mockResolvedValue({ id: 'product-1', nombre: 'Own', almacenId: 'warehouse-1' });
    txMock.almacen.findFirst.mockResolvedValue({ almacenId: 'warehouse-1' });
    txMock.stockUbicacion.findFirst.mockResolvedValue(null);
    const response = await createVale(new NextRequest('http://localhost/api/vales', {
      method: 'POST', body: JSON.stringify({ concepto: 'Salida', items: [{ productoId: 'product-1', cantidad: 1 }] }),
    }), {});
    expect(response.status).toBe(400);
    expect(txMock.stockUbicacion.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', productoId: 'product-1', tipoUbicacion: 'almacen', ubicacionId: 'warehouse-1' },
    }));
    expect(txMock.valeSalida.create).not.toHaveBeenCalled();
    expect(upsertStockUbicacion).not.toHaveBeenCalled();
  });

  it('creates an own-tenant vale and decrements its validated location', async () => {
    txMock.producto.findFirst.mockResolvedValue({ id: 'product-1', nombre: 'Own', almacenId: 'warehouse-1' });
    txMock.almacen.findFirst.mockResolvedValue({ almacenId: 'warehouse-1' });
    txMock.stockUbicacion.findFirst.mockResolvedValue({ cantidadDisponible: 4 });
    txMock.valeSalida.create.mockResolvedValue({ valeSalidaId: 'vale-new' });
    txMock.valeSalida.findFirst.mockResolvedValue({ valeSalidaId: 'vale-new', tenantId: 'tenant-1' });
    const response = await createVale(new NextRequest('http://localhost/api/vales', {
      method: 'POST', body: JSON.stringify({ concepto: 'Salida', items: [{ productoId: 'product-1', cantidad: 2 }] }),
    }), {});
    expect(response.status).toBe(201);
    expect(txMock.valeSalida.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant-1' }),
    }));
    expect(txMock.valeSalidaItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sourceTipoUbicacion: 'almacen', sourceUbicacionId: 'warehouse-1' }),
    }));
    expect(upsertStockUbicacion).toHaveBeenCalledWith(txMock, expect.objectContaining({
      tenantId: 'tenant-1', productoId: 'product-1', ubicacionId: 'warehouse-1', delta: -2,
    }));
  });

  it('restores stock once when repeated annul requests race', async () => {
    prismaMock.valeSalida.findFirst.mockResolvedValue({ valeSalidaId: 'vale-1', estado: 'COMPLETADA' });
    txMock.valeSalida.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    txMock.valeSalidaItem.findMany.mockResolvedValue([{
      tenantId: 'tenant-1', productoId: 'product-1', cantidad: 3,
      sourceTipoUbicacion: 'almacen', sourceUbicacionId: 'warehouse-1',
      Producto: { id: 'product-1', tenantId: 'tenant-1' },
    }]);
    txMock.producto.findFirst.mockResolvedValue({ id: 'product-1', almacenId: 'warehouse-current' });
    txMock.almacen.findFirst.mockResolvedValue({ almacenId: 'warehouse-1' });
    txMock.stockUbicacion.findFirst.mockResolvedValue({ id: 'stock-1' });
    const request = () => deleteVale(new NextRequest('http://localhost/api/vales/vale-1', { method: 'DELETE' }), context);
    const first = await request();
    const second = await request();
    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(txMock.valeSalida.updateMany).toHaveBeenCalledTimes(2);
    expect(txMock.valeSalida.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { valeSalidaId: 'vale-1', tenantId: 'tenant-1', estado: 'COMPLETADA' },
    }));
    expect(upsertStockUbicacion).toHaveBeenCalledTimes(1);
    expect(upsertStockUbicacion).toHaveBeenCalledWith(txMock, expect.objectContaining({
      tenantId: 'tenant-1', productoId: 'product-1', ubicacionId: 'warehouse-1', delta: 3,
    }));
    expect(txMock.almacen.findFirst).toHaveBeenCalledWith({
      where: { almacenId: 'warehouse-1', tenantId: 'tenant-1' }, select: { almacenId: true },
    });
    expect(txMock.stockUbicacion.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', productoId: 'product-1', tipoUbicacion: 'almacen', ubicacionId: 'warehouse-1' },
      select: { id: true },
    });
  });

  it('refuses to restore a vale with a cross-tenant attached item', async () => {
    prismaMock.valeSalida.findFirst.mockResolvedValue({ valeSalidaId: 'vale-1', estado: 'COMPLETADA' });
    txMock.valeSalida.updateMany.mockResolvedValue({ count: 1 });
    txMock.valeSalidaItem.findMany.mockResolvedValue([{
      tenantId: 'tenant-foreign', productoId: 'foreign-product', cantidad: 1,
      Producto: { id: 'foreign-product', tenantId: 'tenant-foreign' },
    }]);
    const response = await deleteVale(new NextRequest('http://localhost/api/vales/vale-1', { method: 'DELETE' }), context);
    expect(response.status).toBe(404);
    expect(txMock.producto.findFirst).not.toHaveBeenCalled();
    expect(upsertStockUbicacion).not.toHaveBeenCalled();
  });

  it.each([
    ['legacy item without a location snapshot', null, null],
    ['snapshot warehouse outside the tenant', 'almacen', 'foreign-warehouse'],
    ['unsupported snapshot location type', 'tienda', 'warehouse-1'],
  ])('fails closed for %s before claiming or restoring stock', async (_case, type, locationId) => {
    prismaMock.valeSalida.findFirst.mockResolvedValue({ valeSalidaId: 'vale-1', estado: 'COMPLETADA' });
    txMock.valeSalidaItem.findMany.mockResolvedValue([{
      tenantId: 'tenant-1', productoId: 'product-1', cantidad: 1,
      sourceTipoUbicacion: type, sourceUbicacionId: locationId,
      Producto: { id: 'product-1', tenantId: 'tenant-1' },
    }]);
    txMock.producto.findFirst.mockResolvedValue({ id: 'product-1', almacenId: 'warehouse-current' });
    txMock.almacen.findFirst.mockResolvedValue(null);
    const response = await deleteVale(new NextRequest('http://localhost/api/vales/vale-1', { method: 'DELETE' }), context);
    expect(response.status).toBe(404);
    expect(txMock.valeSalida.updateMany).not.toHaveBeenCalled();
    expect(upsertStockUbicacion).not.toHaveBeenCalled();
  });
});
