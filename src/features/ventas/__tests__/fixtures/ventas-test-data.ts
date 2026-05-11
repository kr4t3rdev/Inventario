/**
 * @description Test fixtures compartidos para tests de ventas.
 *   Provee mocks tipados de user, prisma, y datos de prueba.
 */
import { vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Usuarios Mock ─────────────────────────────────────────

export const mockUser: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Test User',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-test',
  tenantRole: 'admin',
};

export const mockUserTenantB: AuthenticatedUser = {
  userId: 'user-2',
  name: 'User B',
  email: 'userb@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-b',
  tenantRole: 'admin',
};

// ─── Datos Mock ─────────────────────────────────────────────

export const mockPuntoDeVenta = {
  pvId: 'pv-1',
  nombre: 'Punto de Venta Test',
  listaPrecioId: null,
  activo: true,
};

export const mockPuntoDeVentaInvalid = {
  pvId: 'pv-invalid',
  nombre: 'Invalid PV',
  listaPrecioId: null,
  activo: true,
};

export const mockProducto = {
  id: 'prod-1',
  nombre: 'Producto Test',
  precioVenta: 100,
  precioCosto: 60,
  stock: 100,
  productoPadreId: null,
  cantidadEnPack: null,
  almacenId: null,
};

export const mockProductoConPack = {
  id: 'prod-2',
  nombre: 'Producto Hijo',
  precioVenta: 50,
  precioCosto: 30,
  stock: 200,
  productoPadreId: 'parent-1',
  cantidadEnPack: 5,
  almacenId: null,
};

export const mockProductoPadre = {
  id: 'parent-1',
  nombre: 'Producto Pack',
  precioVenta: 200,
  precioCosto: 120,
  stock: 50,
  productoPadreId: null,
  cantidadEnPack: null,
  almacenId: 'alm-1',
};

export const mockAlmacen = {
  almacenId: 'alm-1',
  nombre: 'Almacen Test',
  activo: true,
};

export const mockAlmacenInactivo = {
  almacenId: 'alm-2',
  nombre: 'Almacen Inactivo',
  activo: false,
};

export const mockVenta = {
  ventaId: 'venta-1',
  tenantId: 'tenant-test',
  productoId: null,
  cantidad: 0,
  puntoDeVentaId: 'pv-1',
  total: 1000,
  descuento: 0,
  clienteId: null,
  empleadoId: null,
  observaciones: null,
  esVentaUnica: true,
  ofertaId: null,
  ventaPadreId: null,
  ordenId: null,
  idempotencyKey: 'key-unique-12345',
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [],
};

// ─── Prisma Mock Builder ────────────────────────────────────

export function createPrismaMock() {
  return {
    puntoDeVenta: { findUnique: vi.fn() },
    transferencia: { aggregate: vi.fn() },
    ventaItem: { aggregate: vi.fn() },
    venta: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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
    cuentaPorCobrar: { create: vi.fn() },
    $transaction: vi.fn(),
  };
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;

// ─── Request Builder ────────────────────────────────────────
// NOTE: Los tests deben importar { NextRequest } from 'next/server'
// y usar NextRequest directamente. Esta función se usa para crear
// el body que será pasado al constructor de NextRequest en cada test.

export type RequestBody = Record<string, unknown>;

export function createRequestBody(
  overrides: Partial<{
    productos: Array<{ productoId: string; cantidad: number; precioVenta?: number }>;
    puntoDeVentaId: string;
    clienteId: string;
    descuento: number;
    observaciones: string;
    idempotencyKey: string;
  }> = {}
): RequestBody {
  return {
    productos: [{ productoId: 'prod-1', cantidad: 1 }],
    puntoDeVentaId: 'pv-1',
    ...overrides,
  };
}

// ─── Transaction Mock Builder ───────────────────────────────

export function createTransactionMock(overrides: Record<string, any> = {}) {
  const defaultTx: Record<string, any> = {
    venta: {
      create: vi.fn().mockResolvedValue(mockVenta),
    },
    serieFacturacion: {
      findFirst: vi.fn().mockResolvedValue({
        serieId: 'serie-1',
        prefijo: 'SD',
        consecutivo: 1,
        activa: true,
      }),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({ consecutivo: 2 }),
    },
    factura: {
      create: vi.fn().mockResolvedValue({
        idFactura: 'fact-1',
        numeroFactura: 'SD-1',
        estado: 'PENDIENTE',
      }),
      update: vi.fn(),
    },
    cuentaPorCobrar: {
      create: vi.fn(),
    },
    producto: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  };

  return { ...defaultTx, ...overrides };
}
