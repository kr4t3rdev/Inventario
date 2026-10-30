/**
 * @description Tests para el fix de propagación de errores de turno en facturación de ofertas.
 * El flujo current ignora result.error de getOrCreateTurnoActivo, permitiendo facturar
 * sin turno en una caja PRINCIPAL.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from "@/test/action-response";

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/ventas/services/facturacion-workflow', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/ventas/services/facturacion-workflow')>()),
  applyFacturacionCobroWorkflow: vi.fn(),
}));
vi.mock('@/lib/services/anticipos-workflow', () => ({
  applyAnticipoAllocations: vi.fn(),
}));
vi.mock('@/features/turnos-pos', () => ({ getOrCreateTurnoActivo: vi.fn() }));

const mockTx = {
  oferta: { update: vi.fn() },
  venta: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
  ventaServicios: { create: vi.fn() },
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
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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
import { facturarOfertaAction } from '@/features/ofertas/actions';
import { getOrCreateTurnoActivo } from '@/features/turnos-pos';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'manager',
};

describe('facturarOfertaAction – propagación de errores de turno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue({
      id: 'of-1', estado: 'PENDIENTE', clienteId: 'cli-1',
      tenantId: 'tenant-test', subtotal: 1000, impuestos: 0, total: 1000,
      items: [
        { productoId: 'prod-1', servicioId: null, cantidad: 2, precioUnitario: 500, total: 1000 },
      ],
      cliente: { clienteId: 'cli-1', nombre: 'Test' },
    } as any);
    mockTx.serieFacturacion.findFirst.mockResolvedValue({
      serieId: 'serie-1', prefijo: 'FV', consecutivo: 1, esPorDefecto: true,
    } as any);
    mockTx.serieFacturacion.update.mockResolvedValue({ consecutivo: 2 });
    mockTx.venta.create.mockResolvedValue({ ventaId: 'ven-1' });
    mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-1' });
    mockTx.producto.findUnique.mockResolvedValue({ id: 'prod-1', nombre: 'Prod', tenantId: 'tenant-test' } as any);
    mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 });
    // El caso simula que el cliente transaccional no expone `servicios`.
    (mockTx as unknown as { servicios?: unknown }).servicios = undefined;
    mockTx.oferta.update.mockResolvedValue({ id: 'of-1', estado: 'FACTURADA' } as any);
  });

  it('retrasa error NO_TURNO_ACTIVO cuando el POS es PRINCIPAL y no hay turno', async () => {
    (getOrCreateTurnoActivo as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: { code: 'NO_TURNO_ACTIVO', message: 'Debe abrir un turno antes de vender. Use la opción "Abrir Turno" en el POS.' },
    });

    const result = await facturarOfertaAction({ ofertaId: 'of-1', puntoDeVentaId: 'pv-1' });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('NO_TURNO_ACTIVO');
    expect(expectActionFailure(result).error!.message).toContain('turno');
  });

  it('retrasa error cross-tenant cuando getOrCreateTurnoActivo detecta POS de otro tenant', async () => {
    (getOrCreateTurnoActivo as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Punto de venta no encontrado' },
    });

    const result = await facturarOfertaAction({ ofertaId: 'of-1', puntoDeVentaId: 'pv-b' });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('NOT_FOUND');
  });
});
