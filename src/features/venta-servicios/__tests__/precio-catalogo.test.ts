/**
 * @description Tests de precio resuelto desde el catálogo en ventas de servicios (CU-05, RED).
 * @param {void} No aplica - suite de tests
 * @returns {void} Aserciones vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/anticipos-workflow', () => ({ applyAnticipoAllocations: vi.fn() }));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
  exchangeRateProvider: { getRateAsOf: vi.fn() },
}));

const mockTx = {
  ventaServicios: { create: vi.fn() },
  tipoPago: { findFirst: vi.fn() },
  cuentaBancaria: { findFirst: vi.fn() },
  anticipo: { findUnique: vi.fn() },
  reconciliacionServicio: { create: vi.fn() },
  transaccionMoneda: { create: vi.fn() },
  tenantAccountingPolicy: { findUnique: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ventaServicios: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    servicios: { findFirst: vi.fn(), findMany: vi.fn() },
    cliente: { findFirst: vi.fn() },
    reconciliacionServicio: { count: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { createVentaServicioAction } from '@/features/venta-servicios/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'manager',
};

describe('CU-05 precio de catálogo en venta de servicios (RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'false');
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([
      { servicioId: 'sv-1', moneda: 'CUP', precio: 5000 },
    ] as any);
    mockTx.ventaServicios.create.mockResolvedValue({ ventaServicioId: 'vs-1' } as any);
  });

  it('modo legacy: persiste el precio del catálogo y total = cantidad × precio', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

    const result = await createVentaServicioAction({ servicioId: 'sv-1', cantidad: 2 } as any);

    expect(result.success).toBe(true);
    expect(mockTx.ventaServicios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ precioUnitario: 5000, total: 10000, moneda: 'CUP' }),
      }),
    );
  });

  it('modo legacy: rechaza precioUnitario manipulado desde el cliente', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

    const result = await createVentaServicioAction({
      servicioId: 'sv-1', cantidad: 2, precioUnitario: 2500,
    } as any);

    expect(result.success).toBe(false);
  });

  it('modo carrito: persiste precios del catálogo por línea', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.$transaction).mockImplementation((args: any) => {
      if (Array.isArray(args)) return Promise.all(args);
      return args(mockTx);
    });
    vi.mocked(prisma.ventaServicios.create).mockResolvedValue({ ventaServicioId: 'vs-1' } as any);

    const result = await createVentaServicioAction({
      lineas: [{ tipoLinea: 'SERVICIO', servicioId: 'sv-1', cantidad: 3 }],
    } as any);

    expect(result.success).toBe(true);
    expect(prisma.ventaServicios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ precioUnitario: 5000, total: 15000 }),
      }),
    );
  });
});
