/**
 * @description Tests para Issues resueltos: MultiTenant, Idempotency, Stock, Location, Error Handling
 *
 * @module features/ventas/api/__tests__/handlers-issues.test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const prismaMock = {
  puntoDeVenta: { findUnique: vi.fn() },
  transferencia: { aggregate: vi.fn() },
  ventaItem: { aggregate: vi.fn() },
  venta: {
    aggregate: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  producto: { findUnique: vi.fn(), update: vi.fn() },
  precioProducto: { findUnique: vi.fn() },
  ventaServicios: { create: vi.fn() },
  almacen: { findUnique: vi.fn() },
  serieFacturacion: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  factura: { create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock('@/lib/services/anticipos-workflow', () => ({
  executeAnticipo: vi.fn(),
  isAnticipoWorkflowError: () => false,
}));

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
  upsertStockUbicacion: vi.fn(),
}));

function createPOST(user: any = { userId: 'user-1', tenantId: 'tenant-test' }) {
  return async (body: Record<string, unknown>) => {
    const { createVentaHandler } = await import('@/features/ventas/api/handlers');
    const req = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return createVentaHandler(req, {}, user);
  };
}

describe('Issue #1: MultiTenant', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('debe crear venta con tenantId del usuario autenticado', async () => {
    const POST = createPOST({ userId: 'user-1', tenantId: 'tenant-abc' });

    prismaMock.puntoDeVenta.findUnique.mockResolvedValue({
      pvId: 'pv-1', listaPrecioId: null, activo: true,
    });
    prismaMock.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) return { _sum: { cantidad: 100 } };
      return { _sum: { cantidad: 0 } };
    });
    prismaMock.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prismaMock.venta.findFirst.mockResolvedValue(null);
    prismaMock.producto.findUnique.mockResolvedValue({
      id: 'prod-1', precioVenta: 100, nombre: 'Producto',
    });
    prismaMock.almacen.findUnique.mockResolvedValue(null);

    const txVentaCreate = vi.fn().mockResolvedValue({
      ventaId: 'venta-1', tenantId: 'tenant-abc',
      cliente: null, puntoDeVenta: { nombre: 'PV' }, items: [],
    });
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        venta: { create: txVentaCreate },
        stockUbicacion: { upsert: vi.fn() },
      };
      return callback(tx);
    });

    const response = await POST({
      productos: [{ productoId: 'prod-1', cantidad: 1 }],
      puntoDeVentaId: 'pv-1',
    });

    expect(response.status).toBe(200);
    // Verify venta was created with tenantId from user, NOT empty string
    expect(txVentaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-abc',
        }),
      }),
    );
  });

  it('debe rechazar request si user no tiene tenantId activo', async () => {
    const POST = createPOST({ userId: 'user-1' }); // NO tenantId

    const response = await POST({
      productos: [{ productoId: 'prod-1', cantidad: 1 }],
      puntoDeVentaId: 'pv-1',
    });

    expect(response.status).toBe(500);
    // requireTenant lanza error
  });
});

describe('Issue #2: Idempotency Key', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('debe retornar venta existente si idempotencyKey ya existe', async () => {
    const POST = createPOST();

    // Simular que ya existe una venta con ese idempotencyKey
    prismaMock.venta.findFirst.mockResolvedValue({
      ventaId: 'venta-existing',
      tenantId: 'tenant-test',
      items: [],
    });

    const response = await POST({
      productos: [{ productoId: 'prod-1', cantidad: 1 }],
      puntoDeVentaId: 'pv-1',
      idempotencyKey: 'existing-key-uuid',
    });

    // Debe retornar 200 (no 201) y la venta existente
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.ventaId).toBe('venta-existing');
    // No debe llamar al transaction
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('debe generar UUID si no se proporciona idempotencyKey', async () => {
    const POST = createPOST();

    prismaMock.puntoDeVenta.findUnique.mockResolvedValue({
      pvId: 'pv-1', listaPrecioId: null, activo: true,
    });
    prismaMock.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) return { _sum: { cantidad: 100 } };
      return { _sum: { cantidad: 0 } };
    });
    prismaMock.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prismaMock.venta.findFirst.mockResolvedValue(null);
    prismaMock.producto.findUnique.mockResolvedValue({
      id: 'prod-1', precioVenta: 100, nombre: 'Producto',
    });
    prismaMock.almacen.findUnique.mockResolvedValue(null);

    const txVentaCreate = vi.fn().mockResolvedValue({
      ventaId: 'venta-1', cliente: null, puntoDeVenta: { nombre: 'PV' }, items: [],
    });
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        venta: { create: txVentaCreate },
        stockUbicacion: { upsert: vi.fn() },
      };
      return callback(tx);
    });

    const response = await POST({
      productos: [{ productoId: 'prod-1', cantidad: 1 }],
      puntoDeVentaId: 'pv-1',
      // NO idempotencyKey
    });

    expect(response.status).toBe(200);
    // Debe haber llamado con idempotencyKey generado (UUID)
    expect(txVentaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotencyKey: expect.any(String),
        }),
      }),
    );
  });
});

describe('Issue #3: Stock Unification (solo VentaItem)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('debe calcular stock usando solo VentaItem, no venta.productoId legacy', async () => {
    const POST = createPOST();

    prismaMock.puntoDeVenta.findUnique.mockResolvedValue({
      pvId: 'pv-1', listaPrecioId: null, activo: true,
    });
    prismaMock.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) return { _sum: { cantidad: 100 } };
      return { _sum: { cantidad: 0 } };
    });
    prismaMock.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 5 } });
    prismaMock.venta.findFirst.mockResolvedValue(null);
    prismaMock.producto.findUnique.mockResolvedValue({
      id: 'prod-1', precioVenta: 100, nombre: 'Producto',
    });
    prismaMock.almacen.findUnique.mockResolvedValue(null);

    const txVentaCreate = vi.fn().mockResolvedValue({
      ventaId: 'venta-1', cliente: null, puntoDeVenta: { nombre: 'PV' }, items: [],
    });
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const tx = { venta: { create: txVentaCreate }, stockUbicacion: { upsert: vi.fn() } };
      return callback(tx);
    });

    const response = await POST({
      productos: [{ productoId: 'prod-1', cantidad: 10 }],
      puntoDeVentaId: 'pv-1',
    });

    // Stock available = 100 (entrada) - 0 (salida) - 5 (VentaItem) = 95
    // 95 >= 10 → OK
    expect(response.status).toBe(200);
  });

  it('debe rechazar cuando VentaItem muestra stock insuficiente (aunque legacy diga que hay)', async () => {
    const POST = createPOST();

    prismaMock.puntoDeVenta.findUnique.mockResolvedValue({
      pvId: 'pv-1', listaPrecioId: null, activo: true,
    });
    prismaMock.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) return { _sum: { cantidad: 100 } };
      return { _sum: { cantidad: 0 } };
    });
    prismaMock.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 95 } }); // 95 vendidos
    prismaMock.venta.findFirst.mockResolvedValue(null);
    prismaMock.producto.findUnique.mockResolvedValue({
      id: 'prod-1', precioVenta: 100, nombre: 'Producto',
    });
    prismaMock.almacen.findUnique.mockResolvedValue(null);

    const response = await POST({
      productos: [{ productoId: 'prod-1', cantidad: 10 }],
      puntoDeVentaId: 'pv-1',
    });

    // Stock available = 100 - 0 - 95 = 5, but requested 10
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Stock insuficiente');
  });
});

describe('Issue #4: Location Validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('debe retornar 404 si PuntoDeVenta no existe', async () => {
    const POST = createPOST();

    prismaMock.puntoDeVenta.findUnique.mockResolvedValue(null); // No existe

    const response = await POST({
      productos: [{ productoId: 'prod-1', cantidad: 1 }],
      puntoDeVentaId: 'pv-invalid',
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('Punto de venta');
  });

  it('debe retornar 400 si almacén del producto padre está inactivo', async () => {
    const POST = createPOST();

    prismaMock.puntoDeVenta.findUnique.mockResolvedValue({
      pvId: 'pv-1', listaPrecioId: null, activo: true,
    });
    prismaMock.producto.findUnique
      .mockResolvedValueOnce({ productoPadreId: 'parent-1' }) // child check
      .mockResolvedValueOnce({ almacenId: 'alm-1' }) // parent check
      .mockResolvedValueOnce({ id: 'hijo-1', precioVenta: 50, nombre: 'Hijo', productoPadreId: 'parent-1', cantidadEnPack: 1 });
    prismaMock.almacen.findUnique.mockResolvedValue({ almacenId: 'alm-1', activo: false }); // inactive

    const response = await POST({
      productos: [{ productoId: 'hijo-1', cantidad: 1 }],
      puntoDeVentaId: 'pv-1',
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('Almacén');
  });
});

describe('Issue #5: Error Handling & Rollback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('debe loguear [VENTA_TX_ROLLBACK] si falla transacción', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const POST = createPOST();

    prismaMock.puntoDeVenta.findUnique.mockResolvedValue({
      pvId: 'pv-1', listaPrecioId: null, activo: true,
    });
    prismaMock.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) return { _sum: { cantidad: 100 } };
      return { _sum: { cantidad: 0 } };
    });
    prismaMock.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prismaMock.venta.findFirst.mockResolvedValue(null);
    prismaMock.producto.findUnique.mockImplementation(async () => ({
      id: 'prod-1', precioVenta: 100, nombre: 'Producto',
    }));
    prismaMock.almacen.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockRejectedValue(new Error('DB connection failed'));

    const response = await POST({
      productos: [{ productoId: 'prod-1', cantidad: 1 }],
      puntoDeVentaId: 'pv-1',
    });

    expect(response.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[VENTA_TX_ROLLBACK]',
      expect.objectContaining({
        operation: expect.any(String),
        error: 'DB connection failed',
      }),
    );

    consoleSpy.mockRestore();
  });

  it('debe retornar 409 en error de constraint único (P2002)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const POST = createPOST();

    const { Prisma } = await import('@/generated/prisma');
    const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });

    prismaMock.puntoDeVenta.findUnique.mockResolvedValue({
      pvId: 'pv-1', listaPrecioId: null, activo: true,
    });
    prismaMock.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) return { _sum: { cantidad: 100 } };
      return { _sum: { cantidad: 0 } };
    });
    prismaMock.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prismaMock.venta.findFirst.mockResolvedValue(null);
    prismaMock.producto.findUnique.mockResolvedValue({
      id: 'prod-1', precioVenta: 100, nombre: 'Producto',
    });
    prismaMock.almacen.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockRejectedValue(p2002Error);

    const response = await POST({
      productos: [{ productoId: 'prod-1', cantidad: 1 }],
      puntoDeVentaId: 'pv-1',
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toContain('duplicada');
    consoleSpy.mockRestore();
  });
});
