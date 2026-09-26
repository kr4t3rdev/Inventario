import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { NextRequest } from 'next/server';

const { prismaMock } = vi.hoisted(() => {
  const prismaMock: any = {
    transferencia: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    merma: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
    compraProducto: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    producto: { findUnique: vi.fn(), findFirst: vi.fn() },
    vendor: { findFirst: vi.fn() },
    stockUbicacion: { findUnique: vi.fn() },
    ajusteInventario: { create: vi.fn(), updateMany: vi.fn() },
  };
  prismaMock.$transaction = vi.fn((cb: any) => cb(prismaMock));
  return { prismaMock };
});

let currentTenantId: string | null = 'tenant-1';

vi.mock('@/lib/prisma', async () => {
  const actual = await vi.importActual('@/lib/prisma');
  return { ...actual, default: prismaMock, prisma: prismaMock };
});

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(async () => ({
    user: { userId: 'user-test', tenantId: currentTenantId },
  })),
}));

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
  upsertStockUbicacion: vi.fn(async () => undefined),
}));

vi.mock('@/features/inventario/movimientos', async () => ({
  ...(await vi.importActual('@/features/inventario/movimientos')),
  registrarMovimiento: vi.fn(async () => undefined),
  revertirMovimientosDeOrigen: vi.fn(async () => undefined),
}));

vi.mock('@/lib/notificaciones-utils', () => ({
  notificarMerma: vi.fn(async () => undefined),
}));

import { GET as getTransfers } from '../transfers/route';
import { GET as getTransferById, DELETE as deleteTransfer } from '../transfers/[id]/route';
import { GET as getMermas, POST as createMerma } from '../mermas/route';
import { GET as getMermaById, DELETE as deleteMerma } from '../mermas/[id]/route';
import { GET as getPurchases, POST as createPurchase } from '../purchases/route';
import { GET as getPurchaseById, DELETE as deletePurchase } from '../purchases/[id]/route';
import { registrarMovimiento, revertirMovimientosDeOrigen } from '@/features/inventario/movimientos';
import { notificarMerma } from '@/lib/notificaciones-utils';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const transferRow = {
  transferenciaId: 't1',
  numeroTransferencia: 'TRF-2025-000001',
  productoId: 'p1',
  cantidad: 5,
  descripcion: 'Transfer',
  estado: 'COMPLETADA',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-02T00:00:00.000Z'),
  origenId: 'a1',
  destinoId: 'a2',
  puntoDeVentaOrigenId: null,
  puntoDeVentaDestinoId: null,
  producto: { id: 'p1', nombre: 'Prod', codigoInterno: 'C1' },
  origen: { almacenId: 'a1', nombre: 'Almacén 1' },
  destino: { almacenId: 'a2', nombre: 'Almacén 2' },
};

const mermaRow = {
  mermaId: 'm1',
  productoId: 'p1',
  cantidad: 2,
  motivo: 'Caducidad',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-02T00:00:00.000Z'),
  producto: { id: 'p1', nombre: 'Prod', codigoInterno: 'C1' },
};

const compraRow = {
  compraProductoId: 'c1',
  proveedorId: 'v1',
  productoId: 'p1',
  cantidad: 3,
  precioUnitario: 100,
  total: 300,
  descripcion: null,
  estado: 'PENDIENTE',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-02T00:00:00.000Z'),
  proveedor: { nombre: 'Vendor' },
  producto: { nombre: 'Prod', codigoInterno: 'C1' },
};

describe('Mobile API: transfers, mermas & purchases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTenantId = 'tenant-1';
  });

  it('GET /api/mobile/transfers mapea filas a la forma móvil', async () => {
    (prismaMock.transferencia.findMany as Mock).mockResolvedValue([transferRow]);

    const response = await getTransfers(new NextRequest('http://localhost/api/mobile/transfers'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      transferenciaId: 't1',
      numeroTransferencia: 'TRF-2025-000001',
      tipoTransferencia: 'Almacén → Almacén',
      origen: { almacenId: 'a1', nombre: 'Almacén 1' },
      destino: { almacenId: 'a2', nombre: 'Almacén 2' },
    });
  });

  it('GET /api/mobile/mermas mapea motivo y producto', async () => {
    (prismaMock.merma.findMany as Mock).mockResolvedValue([mermaRow]);

    const response = await getMermas(new NextRequest('http://localhost/api/mobile/mermas'));
    const data = await response.json();

    expect(data.items[0]).toMatchObject({
      mermaId: 'm1',
      motivo: 'Caducidad',
      cantidad: 2,
      producto: { id: 'p1', nombre: 'Prod' },
    });
  });

  it('GET /api/mobile/purchases mapea compraProductoId → compraId', async () => {
    (prismaMock.compraProducto.findMany as Mock).mockResolvedValue([compraRow]);

    const response = await getPurchases(new NextRequest('http://localhost/api/mobile/purchases'));
    const data = await response.json();

    expect(data.items[0]).toMatchObject({
      compraId: 'c1',
      proveedor: { nombre: 'Vendor' },
      producto: { nombre: 'Prod' },
      estado: 'PENDIENTE',
    });
  });

  it('GET /api/mobile/transfers/[id] devuelve 404 si no pertenece al tenant', async () => {
    (prismaMock.transferencia.findFirst as Mock).mockResolvedValue(null);

    const response = await getTransferById(new NextRequest('http://localhost/api/mobile/transfers/t1'), ctx('t1'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe('NOT_FOUND');
  });

  it('POST /api/mobile/mermas crea y devuelve 201', async () => {
    (prismaMock.producto.findUnique as Mock).mockResolvedValue({ id: 'p1', tenantId: 'tenant-1', precioCosto: 50, almacenId: 'a1' });
    (prismaMock.stockUbicacion.findUnique as Mock).mockResolvedValue({ cantidadDisponible: 10 });
    (prismaMock.merma.create as Mock).mockResolvedValue(mermaRow);

    const request = new NextRequest('http://localhost/api/mobile/mermas', {
      method: 'POST',
      body: JSON.stringify({ productoId: 'p1', cantidad: 2, motivo: 'Caducidad' }),
    });
    const response = await createMerma(request);

    expect(response.status).toBe(201);
  });

  it('POST /api/mobile/mermas crea con trazabilidad completa (creadoPor, kardex, espejo) y notifica', async () => {
    (prismaMock.producto.findUnique as Mock).mockResolvedValue({ id: 'p1', tenantId: 'tenant-1', precioCosto: 50, almacenId: 'a1' });
    (prismaMock.stockUbicacion.findUnique as Mock).mockResolvedValue({ cantidadDisponible: 10 });
    (prismaMock.merma.create as Mock).mockResolvedValue(mermaRow);

    const request = new NextRequest('http://localhost/api/mobile/mermas', {
      method: 'POST',
      body: JSON.stringify({ productoId: 'p1', cantidad: 2, motivo: 'Producto dañado en recepción' }),
    });
    const response = await createMerma(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    const createCall = (prismaMock.merma.create as Mock).mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      productoId: 'p1',
      cantidad: 2,
      costoTotal: 100,
      tenantId: 'tenant-1',
      almacenId: 'a1',
      creadoPorId: 'user-test',
    });
    expect(registrarMovimiento).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: 'tenant-1',
        productoId: 'p1',
        tipoOrigen: 'MERMA',
        origenId: 'm1',
        cantidad: -2,
        costoUnitario: 50,
        secuencia: 'SALIDA-0',
        creadoPorId: 'user-test',
      }),
    );
    expect(prismaMock.ajusteInventario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'APLICADO',
          origenMermaId: 'm1',
          diferencia: -2,
          creadoPorId: 'user-test',
        }),
      }),
    );
    expect(upsertStockUbicacion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ productoId: 'p1', delta: -2 }),
    );
    expect(notificarMerma).toHaveBeenCalledWith('m1');
    expect(data.mermaId).toBe('m1');
  });

  it('POST /api/mobile/mermas rechaza stock insuficiente con 409', async () => {
    (prismaMock.producto.findUnique as Mock).mockResolvedValue({ id: 'p1', tenantId: 'tenant-1', precioCosto: 50, almacenId: 'a1' });
    (prismaMock.stockUbicacion.findUnique as Mock).mockResolvedValue({ cantidadDisponible: 1 });

    const request = new NextRequest('http://localhost/api/mobile/mermas', {
      method: 'POST',
      body: JSON.stringify({ productoId: 'p1', cantidad: 5, motivo: 'Caducidad' }),
    });
    const response = await createMerma(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('STOCK_INSUFICIENTE');
  });

  it('DELETE /api/mobile/mermas/[id] revierte kardex, anula el espejo y restaura stock', async () => {
    (prismaMock.merma.findFirst as Mock).mockResolvedValue({
      mermaId: 'm1',
      productoId: 'p1',
      cantidad: 2,
      almacenId: 'a1',
    });
    (prismaMock.ajusteInventario.updateMany as Mock).mockResolvedValue({ count: 1 });

    const response = await deleteMerma(new NextRequest('http://localhost/api/mobile/mermas/m1'), ctx('m1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, mermaId: 'm1' });
    expect(revertirMovimientosDeOrigen).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: 'tenant-1', tipoOrigen: 'MERMA', origenId: 'm1' }),
    );
    expect(prismaMock.ajusteInventario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', origenMermaId: 'm1' },
        data: { estado: 'ANULADO' },
      }),
    );
    expect(prismaMock.merma.delete).toHaveBeenCalledWith({ where: { mermaId: 'm1' } });
    expect(upsertStockUbicacion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ productoId: 'p1', modo: 'increment', delta: 2 }),
    );
  });

  it('POST /api/mobile/purchases crea con defaults y devuelve 201', async () => {
    (prismaMock.vendor.findFirst as Mock).mockResolvedValue({ vendorId: 'v1' });
    (prismaMock.producto.findFirst as Mock).mockResolvedValue({ id: 'p1' });
    (prismaMock.compraProducto.create as Mock).mockResolvedValue(compraRow);

    const request = new NextRequest('http://localhost/api/mobile/purchases', {
      method: 'POST',
      body: JSON.stringify({ proveedorId: 'v1', productoId: 'p1', cantidad: 3, precioUnitario: 100 }),
    });
    const response = await createPurchase(request);

    expect(response.status).toBe(201);
    expect(prismaMock.compraProducto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ estado: 'PENDIENTE', total: 300, formaPago: 'EFECTIVO' }),
      select: expect.any(Object),
    });
  });

  it('DELETE /api/mobile/transfers/[id] cancela idempotentemente', async () => {
    (prismaMock.transferencia.findFirst as Mock).mockResolvedValue({
      transferenciaId: 't1',
      tenantId: 'tenant-1',
      estado: 'PENDIENTE',
      deletedAt: null,
    });
    (prismaMock.transferencia.updateMany as Mock).mockResolvedValue({ count: 1 });

    const response = await deleteTransfer(new NextRequest('http://localhost/api/mobile/transfers/t1'), ctx('t1'));

    expect(response.status).toBe(200);
  });

  it('DELETE /api/mobile/purchases/[id] soft-delete', async () => {
    (prismaMock.compraProducto.findFirst as Mock).mockResolvedValue({ compraProductoId: 'c1' });
    (prismaMock.compraProducto.update as Mock).mockResolvedValue({});

    const response = await deletePurchase(new NextRequest('http://localhost/api/mobile/purchases/c1'), ctx('c1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, compraId: 'c1' });
  });
});