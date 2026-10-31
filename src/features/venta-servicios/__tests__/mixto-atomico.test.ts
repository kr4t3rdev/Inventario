/**
 * @description Tests de atomicidad del modo mixto (C-4): las filas
 * VentaServicios y sus CuentaPorCobrar se crean en UNA sola transacción
 * interactiva; un fallo a mitad deja cero filas de ambas.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/anticipos-workflow', () => ({ applyAnticipoAllocations: vi.fn() }));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
  exchangeRateProvider: { getRateAsOf: vi.fn() },
}));

// Lecturas compartidas raíz↔tx (mismo fn): el chequeo de crédito corre por tx
// dentro de la transacción; los tests configuran una sola vez.
// vi.hoisted: la fábrica de vi.mock se ejecuta antes que cualquier const.
const { mockClienteFindFirst, mockCxcFindMany } = vi.hoisted(() => ({
	mockClienteFindFirst: vi.fn(),
	mockCxcFindMany: vi.fn(),
}));

const mockTx = {
  ventaServicios: { create: vi.fn() },
  cuentaPorCobrar: { create: vi.fn(), findMany: mockCxcFindMany },
  cliente: { findFirst: mockClienteFindFirst },
  $executeRaw: vi.fn(),
  auditLog: { create: vi.fn() },
};

vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    ventaServicios: { create: vi.fn() },
    servicios: { findMany: vi.fn() },
    cliente: { findFirst: mockClienteFindFirst },
    cuentaPorCobrar: { findMany: mockCxcFindMany },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
  };
  return { prisma: prismaMock, default: prismaMock };
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { createVentaServicioAction } from '@/features/venta-servicios/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const managerUser = {
  userId: 'user-manager', name: 'Manager', email: 'm@test.com',
  role: 'regularUser', isActive: true, tenantId: 'tenant-test',
  tenantRole: 'manager', planFeatures: { servicios: true, 'cuentas-cobrar': true },
} as unknown as AuthenticatedUser;

describe('atomicidad del modo mixto (C-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'false');
    vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([
      { servicioId: 'sv-1', moneda: 'CUP', precio: 5000, costo: 100 },
    ] as never);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'cli-1', limiteCredito: null,
    } as never);
    vi.mocked(prisma.cuentaPorCobrar.findMany).mockResolvedValue([] as never);
  });

  it('crea ventas y CxC dentro de UNA sola transacción interactiva', async () => {
    mockTx.ventaServicios.create.mockResolvedValue({
      ventaServicioId: 'vs-1', total: 10000,
    } as never);
    mockTx.cuentaPorCobrar.create.mockResolvedValue({ id: 'cxc-1' } as never);

    const result = await createVentaServicioAction({
      lineas: [{ tipoLinea: 'SERVICIO', servicioId: 'sv-1', cantidad: 2 }],
      clienteId: 'cli-1',
      condicionPago: 'CREDITO',
    } as never);

    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // La llamada es interactiva (función), no un array de promesas.
    const arg = vi.mocked(prisma.$transaction).mock.calls[0][0] as unknown;
    expect(typeof arg).toBe('function');
    expect(mockTx.ventaServicios.create).toHaveBeenCalledTimes(1);
    expect(mockTx.cuentaPorCobrar.create).toHaveBeenCalledTimes(1);
  });

  it('un fallo al crear la CxC falla la operación completa (todo en la misma tx)', async () => {
    mockTx.ventaServicios.create.mockResolvedValue({
      ventaServicioId: 'vs-1', total: 10000,
    } as never);
    mockTx.cuentaPorCobrar.create.mockRejectedValue(new Error('DB down'));

    const result = await createVentaServicioAction({
      lineas: [{ tipoLinea: 'SERVICIO', servicioId: 'sv-1', cantidad: 2 }],
      clienteId: 'cli-1',
      condicionPago: 'CREDITO',
    } as never);

    expect(result.success).toBe(false);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Ambas escrituras ocurren dentro de la MISMA transacción: al fallar la
    // segunda, la primera se revierte con ella.
    expect(mockTx.ventaServicios.create).toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.create).toHaveBeenCalled();
    // Sin auditoría huérfana: nada se registró fuera de la transacción.
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('el override de crédito se audita dentro de la transacción', async () => {
    // Tope bajo: la venta de 10000 exige override.
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'cli-1', limiteCredito: 1000,
    } as never);
    mockTx.ventaServicios.create.mockResolvedValue({
      ventaServicioId: 'vs-1', total: 10000,
    } as never);
    mockTx.cuentaPorCobrar.create.mockResolvedValue({ id: 'cxc-1' } as never);

    const result = await createVentaServicioAction({
      lineas: [{ tipoLinea: 'SERVICIO', servicioId: 'sv-1', cantidad: 2 }],
      clienteId: 'cli-1',
      condicionPago: 'CREDITO',
    } as never);

    expect(result.success).toBe(true);
    // B-4: la evaluación del tope corre dentro de la transacción con lock.
    expect(mockTx.$executeRaw).toHaveBeenCalled();
    expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
    const auditData = mockTx.auditLog.create.mock.calls[0][0].data;
    expect(auditData.entidad).toBe('VENTA_SERVICIO');
    expect(auditData.detalles).toMatchObject({ tipo: 'CREDITO_OVERRIDE' });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('CONTADO crea las ventas en una transacción y no crea CxC', async () => {
    mockTx.ventaServicios.create.mockResolvedValue({
      ventaServicioId: 'vs-1', total: 10000,
    } as never);

    const result = await createVentaServicioAction({
      lineas: [{ tipoLinea: 'SERVICIO', servicioId: 'sv-1', cantidad: 2 }],
      clienteId: 'cli-1',
    } as never);

    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });
});
