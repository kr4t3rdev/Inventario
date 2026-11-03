/**
 * @description Test focal del slice S4(e): el writer de venta de servicios
 * reconoce formalmente el ingreso por servicios (`VENTA_SERVICIO_CREDITO`)
 * dentro de la misma transacción que persiste la venta.
 *
 * El emisor formal se mockea para verificar el contrato del writer (qué se
 * emite, con qué importe y con qué ancla idempotente); la valoración y las
 * guardas del motor viven en `service-sale-posting-service.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/anticipos-workflow', () => ({
  applyAnticipoAllocations: vi.fn(),
}));
vi.mock('@/features/contabilidad/services/period-close-write-guard', () => ({
  guardAccountingWriteInTransaction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
  exchangeRateProvider: { getRateAsOf: vi.fn() },
}));
vi.mock('@/features/contabilidad-formal/services/service-sale-posting-service', () => ({
  emitirVentaServicio: vi.fn().mockResolvedValue({ estado: 'OMITIDO' }),
}));

const mockTx = {
  ventaServicios: { create: vi.fn(), findMany: vi.fn() },
  cuentaPorCobrar: { create: vi.fn(), findMany: vi.fn() },
  cliente: { findFirst: vi.fn() },
  reconciliacionServicio: { create: vi.fn() },
  tipoPago: { findFirst: vi.fn() },
  cuentaBancaria: { findFirst: vi.fn() },
  tenantAccountingPolicy: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
  $executeRaw: vi.fn(),
};

vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    servicios: { findMany: vi.fn() },
    cliente: { findFirst: vi.fn() },
    ventaServicios: { findMany: vi.fn() },
    $transaction: vi.fn((callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
  };
  return { prisma: prismaMock, default: prismaMock };
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { emitirVentaServicio } from '@/features/contabilidad-formal/services/service-sale-posting-service';
import { createVentaServicioAction } from '@/features/venta-servicios/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Test',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-test',
  tenantRole: 'manager',
};

describe('reconocimiento formal de la venta de servicios (S4(e))', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'false');
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockTx.ventaServicios.findMany.mockResolvedValue([]);
  });

  it('reconoce el total de la venta legacy contra la cuenta por cobrar', async () => {
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([
      { servicioId: 'sv-1', moneda: 'CUP', precio: 5000, costo: 1200 },
    ] as never);
    mockTx.ventaServicios.create.mockImplementation(async ({ data }: never) => ({
      ventaServicioId: 'vs-1',
      total: data.total,
      moneda: data.moneda,
    })) as never;

    const result = await createVentaServicioAction({
      condicionPago: 'CONTADO',
      servicioId: 'sv-1',
      cantidad: 2,
    });

    expect(result.success).toBe(true);
    expect(emitirVentaServicio).toHaveBeenCalledTimes(1);
    const [tx, ctx, params] = vi.mocked(emitirVentaServicio).mock.calls[0];
    expect(tx).toBe(mockTx);
    expect(ctx).toEqual({ tenantId: 'tenant-test', userId: 'user-1' });
    expect(params).toMatchObject({
      ventaServicioId: 'vs-1',
      monto: 10000,
      moneda: 'CUP',
    });
    expect(params.fecha).toBeInstanceOf(Date);
  });

  it('emite un evento por línea en el modo mixto, con su propio ancla', async () => {
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([
      { servicioId: 'sv-1', moneda: 'CUP', precio: 5000, costo: 1200 },
      { servicioId: 'sv-2', moneda: 'USD', precio: 100, costo: 40 },
    ] as never);
    let secuencia = 0;
    mockTx.ventaServicios.create.mockImplementation(async ({ data }: never) => {
      secuencia += 1;
      return {
        ventaServicioId: `vs-${secuencia}`,
        total: data.total,
        moneda: data.moneda,
      };
    }) as never;

    const result = await createVentaServicioAction({
      condicionPago: 'CONTADO',
      lineas: [
        { tipoLinea: 'SERVICIO', servicioId: 'sv-1', cantidad: 2 },
        { tipoLinea: 'SERVICIO', servicioId: 'sv-2', cantidad: 3 },
      ],
    } as never);

    expect(result.success).toBe(true);
    expect(emitirVentaServicio).toHaveBeenCalledTimes(2);
    const llamadas = vi.mocked(emitirVentaServicio).mock.calls.map(([, , params]) => params);
    expect(llamadas).toEqual([
      expect.objectContaining({ ventaServicioId: 'vs-1', monto: 10000, moneda: 'CUP' }),
      expect.objectContaining({ ventaServicioId: 'vs-2', monto: 300, moneda: 'USD' }),
    ]);
  });

  it('no vuelve a emitir cuando la venta se reproduce por idempotencia', async () => {
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([
      { servicioId: 'sv-1', moneda: 'CUP', precio: 5000, costo: 1200 },
    ] as never);
    mockTx.ventaServicios.create.mockImplementation(async ({ data }: never) => ({
      ventaServicioId: 'vs-1',
      total: data.total,
      moneda: data.moneda,
    })) as never;

    const input = {
      condicionPago: 'CONTADO' as const,
      servicioId: 'sv-1',
      cantidad: 1,
      idempotencyKey: 's4e-key',
    };
    const created = await createVentaServicioAction(input);
    expect(created.success).toBe(true);
    const storedKey = mockTx.ventaServicios.create.mock.calls[0][0].data.idempotencyKey;

    mockTx.ventaServicios.findMany.mockResolvedValue([
      { ventaServicioId: 'vs-1', idempotencyKey: storedKey },
    ]);
    const replay = await createVentaServicioAction(input);

    expect(replay.success).toBe(true);
    expect(mockTx.ventaServicios.create).toHaveBeenCalledTimes(1);
    // El ancla formal es idempotente por venta: el replay no duplica el evento.
    expect(emitirVentaServicio).toHaveBeenCalledTimes(1);
  });
});
