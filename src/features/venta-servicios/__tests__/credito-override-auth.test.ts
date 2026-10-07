/**
 * @description Verifica autorización por origen, motivo obligatorio y auditoría
 * transaccional para ventas de servicios que exceden el límite de crédito.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/anticipos-workflow', () => ({
  applyAnticipoAllocations: vi.fn(),
}));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
  exchangeRateProvider: { getRateAsOf: vi.fn(), getRateAsOfExact: vi.fn() },
}));

const postEventoMock = vi.hoisted(() => vi.fn());
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
  postEvento: postEventoMock,
}));

const mockTx = {
  $queryRaw: vi.fn().mockResolvedValue([]),
  ventaServicios: { create: vi.fn() },
  cuentaPorCobrar: { create: vi.fn(), findMany: vi.fn() },
  tipoPago: { findFirst: vi.fn() },
  cuentaBancaria: { findFirst: vi.fn() },
  anticipo: { findUnique: vi.fn() },
  reconciliacionServicio: { create: vi.fn().mockResolvedValue({ reconciliacionId: 'rec-serv-mock' }) },
  transaccionMoneda: { create: vi.fn() },
  tenantAccountingPolicy: { findUnique: vi.fn() },
  cliente: { findFirst: vi.fn() },
  auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ventaServicios: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    servicios: { findFirst: vi.fn(), findMany: vi.fn() },
    cliente: { findFirst: vi.fn() },
    cuentaPorCobrar: { create: vi.fn() },
    reconciliacionServicio: { count: vi.fn() },
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(mockTx)),
  },
}));

// Espías pass-through: conservan la lógica real (planFeatures/permissions del
// user) y permiten verificar qué autorización se exige por entrada.
vi.mock('@/lib/services/tenant-scope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/tenant-scope')>();
  return {
    ...actual,
    requireFeature: vi.fn(actual.requireFeature),
    requirePermission: vi.fn(actual.requirePermission),
    requireTenant: vi.fn(actual.requireTenant),
  };
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { createVentaServicioAction } from '@/features/venta-servicios/actions';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const manager: AuthenticatedUser = {
  userId: 'user-serv-1',
  name: 'Manager Servicios',
  email: 'manager-serv@test.local',
  role: 'user',
  isActive: true,
  tenantId: 'tenant-serv',
  tenantRole: 'manager',
  planFeatures: { servicios: true },
  permissions: new Set(['ventas.venta.registrar']),
} as unknown as AuthenticatedUser;

const dependienteSinPermiso: AuthenticatedUser = {
  ...manager,
  userId: 'user-serv-2',
  tenantRole: 'dependiente',
  permissions: new Set(),
} as unknown as AuthenticatedUser;

const dependienteConPermisosExistentes: AuthenticatedUser = {
  ...manager,
  userId: 'user-serv-3',
  tenantRole: 'dependiente',
  permissions: new Set(['ventas.venta.registrar']),
} as unknown as AuthenticatedUser;

/** @description Devuelve las claves de feature y permiso exigidas hasta el momento.
 * @returns {string[]} Claves observadas por los espías de tenant-scope.
 */
function clavesExigidas(): string[] {
  return [
    ...vi.mocked(requireFeature).mock.calls.map(([, feature]) => String(feature)),
    ...vi.mocked(requirePermission).mock.calls.map(([, key]) => String(key)),
  ];
}

describe('gate 1.3: autorización efectiva del origen servicios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'false');
    vi.mocked(getCurrentUser).mockResolvedValue(manager);
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([
      { servicioId: 'sv-1', moneda: 'CUP', precio: 5000 },
    ] as never);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'c-1',
      limiteCredito: 100,
    } as never);
    mockTx.ventaServicios.create.mockResolvedValue({
      ventaServicioId: 'vs-1',
      tenantId: 'tenant-serv',
      servicioId: 'sv-1',
      cantidad: 1,
      costo: 0,
      total: 5000,
      moneda: 'CUP',
      precioUnitario: 5000,
    });
    mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
    mockTx.cuentaPorCobrar.create.mockResolvedValue({ id: 'cxc-1' });
    mockTx.cliente.findFirst.mockResolvedValue({ clienteId: 'c-1', limiteCredito: 100 });
    mockTx.cuentaPorCobrar.findMany.mockResolvedValue([]);
  });

  it('evidencia: exige requireFeature("servicios") y requirePermission("ventas.venta.registrar")', async () => {
    const result = await createVentaServicioAction({ servicioId: 'sv-1', cantidad: 1 });

    expect(result.success).toBe(true);
    expect(requireFeature).toHaveBeenCalledWith(expect.anything(), 'servicios', expect.any(String));
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(), 'ventas.venta.registrar', expect.any(String),
    );
    expect(requireTenant).toHaveBeenCalled();
  });

  it('evidencia: dependiente sin permiso de registrar queda denegado antes de abrir transacción', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(dependienteSinPermiso);

    const result = await createVentaServicioAction({ servicioId: 'sv-1', cantidad: 1 });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('FORBIDDEN');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mockTx.ventaServicios.create).not.toHaveBeenCalled();
  });

  it('rechaza el exceso sin solicitud explícita de override', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(dependienteConPermisosExistentes);

    const result = await createVentaServicioAction({
      servicioId: 'sv-1',
      cantidad: 1,
      clienteId: 'c-1',
      condicionPago: 'CREDITO',
    });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('CREDITO_EXCEDIDO');
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(), 'ventas.venta.registrar', expect.any(String),
    );
    expect(clavesExigidas()).not.toContain('ventas.servicios.credito-override');
  });

  it('requiere motivo, autorización del origen y auditoría atómica para exceder', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...manager,
      tenantRole: 'dependiente',
      permissions: new Set(['ventas.venta.registrar', 'ventas.servicios.credito-override']),
    } as AuthenticatedUser);

    const result = await createVentaServicioAction({
      servicioId: 'sv-1', cantidad: 1, clienteId: 'c-1', condicionPago: 'CREDITO',
      solicitarCreditoOverride: true, motivoCreditoOverride: 'Autorización comercial',
    });

    expect(result.success).toBe(true);
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(), 'ventas.servicios.credito-override', expect.any(String),
    );
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        detalles: expect.objectContaining({ tipo: 'CREDITO_OVERRIDE', motivo: 'Autorización comercial' }),
      }),
    }));
  });

  it('no exige override cuando la operación es de contado', async () => {
    const result = await createVentaServicioAction({ servicioId: 'sv-1', cantidad: 1 });

    expect(result.success).toBe(true);
    expect(clavesExigidas()).not.toContain('ventas.servicios.credito-override');
  });
});
