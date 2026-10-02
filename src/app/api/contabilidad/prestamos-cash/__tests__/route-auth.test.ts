/**
 * @description Verifica autorización por origen y auditoría transaccional de
 * desembolsos cash que superan el límite de crédito del cliente.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authHolder = vi.hoisted(() => ({
  user: { userId: 'user-http-1', tenantId: 'tenant-http' } as Record<string, unknown>,
}));

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet:
    (handler: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      handler(args[0], undefined, authHolder.user),
  withAuthPost:
    (handler: (request: NextRequest, context: unknown, user: unknown) => unknown) =>
    async (request: NextRequest, context: unknown) =>
      handler(request, context, authHolder.user),
}));

const mockTx = {
  $queryRaw: vi.fn().mockResolvedValue([]),
  cuentaBancaria: { findFirst: vi.fn(), updateMany: vi.fn() },
  cuentaPorCobrar: { create: vi.fn(), findMany: vi.fn() },
  reconciliacionVenta: { create: vi.fn() },
  prestamoCash: { create: vi.fn() },
  cliente: { findFirst: vi.fn() },
  auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
};

vi.mock('@/lib/prisma', () => {
  const prisma = {
    prestamoCash: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    cuentaBancaria: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    cuentaPorCobrar: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    tipoPago: { findFirst: vi.fn() },
    reconciliacionVenta: { create: vi.fn(), aggregate: vi.fn() },
    cliente: { findFirst: vi.fn() },
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(mockTx)),
  };
  return { prisma, default: prisma };
});

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: vi.fn().mockResolvedValue(null),
    logStrict: vi.fn((_params: unknown, client: typeof mockTx) => client.auditLog.create({ data: _params })),
  },
}));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({ postEvento: vi.fn() }));

// Espías pass-through: conservan la lógica real y permiten verificar qué
// autorización se exige en la entrada HTTP.
vi.mock('@/lib/services/tenant-scope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/tenant-scope')>();
  return {
    ...actual,
    requireFeature: vi.fn(actual.requireFeature),
    requirePermission: vi.fn(actual.requirePermission),
    requireTenant: vi.fn(actual.requireTenant),
  };
});

import { prisma } from '@/lib/prisma';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';

/** @description Cuerpo base de desembolso válido para el POST HTTP.
 * @returns {Record<string, unknown>} Payload del préstamo cash.
 */
function bodyDesembolso(): Record<string, unknown> {
  return {
    clienteId: 'c-1',
    montoCapital: 5000,
    cuentaBancariaId: 'cta-1',
    moneda: 'CUP',
    solicitarCreditoOverride: true,
    motivoCreditoOverride: 'Autorización excepcional',
  };
}

describe('gate 1.3: autorización efectiva del POST HTTP de préstamos cash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authHolder.user = {
      userId: 'user-http-1', tenantId: 'tenant-http', role: 'user', tenantRole: 'dependiente',
      planFeatures: { 'prestamos-cash': true }, permissions: new Set(),
    };
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH', 'true');
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'c-1' } as never);
    vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue({
      cuentaId: 'cta-1',
      saldo: 10000,
      isActive: true,
    } as never);
    vi.mocked(prisma.tipoPago.findFirst).mockResolvedValue({
      tipoId: 'tp-1',
      nombre: 'Transferencia',
      isActive: true,
    } as never);
    mockTx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 });
    mockTx.cliente.findFirst.mockResolvedValue({ clienteId: 'c-1', limiteCredito: 100 });
    mockTx.cuentaPorCobrar.findMany.mockResolvedValue([]);
    mockTx.cuentaPorCobrar.create.mockResolvedValue({ id: 'cxc-1' });
    mockTx.reconciliacionVenta.create.mockResolvedValue({
      reconciliacionId: 'rec-1',
      monto: 5000,
      moneda: 'CUP',
      montoConvertido: 5000,
      tasaCambio: 1,
      fechaReconciliacion: new Date(),
      fxEvidenceFingerprint: null,
    });
    mockTx.prestamoCash.create.mockResolvedValue({ id: 'p-1' });
  });

  it('requiere autorización explícita y permiso de override para exceder el cupo', async () => {
    const { POST } = await import('../route');
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash', {
      method: 'POST',
      body: JSON.stringify(bodyDesembolso()),
    });

    const response = await POST(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(403);
    expect(requireTenant).toHaveBeenCalled();
    expect(requireFeature).toHaveBeenCalledWith(expect.anything(), 'prestamos-cash', expect.any(String));
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(), 'financiero.prestamos-cash.credito-override', expect.any(String),
    );
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('evidencia: usuario sin tenantId queda rechazado antes de escribir', async () => {
    authHolder.user = { userId: 'user-http-2' };
    const { POST } = await import('../route');
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash', {
      method: 'POST',
      body: JSON.stringify(bodyDesembolso()),
    });

    const response = await POST(request, { params: Promise.resolve({}) });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(prisma.cuentaPorCobrar.create).not.toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('audita el override de préstamo dentro de la transacción que crea la CxC', async () => {
    authHolder.user = {
      userId: 'user-http-1', tenantId: 'tenant-http', role: 'user', tenantRole: 'manager',
      planFeatures: { 'prestamos-cash': true },
      permissions: new Set(['financiero.prestamos-cash.credito-override']),
    };
    const { POST } = await import('../route');
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash', {
      method: 'POST',
      body: JSON.stringify(bodyDesembolso()),
    });

    const response = await POST(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(201);
    expect(mockTx.cuentaPorCobrar.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-http',
          clienteId: 'c-1',
          montoDeuda: 5000,
          montoPagado: 0,
          tipoCuenta: 'PRESTAMO_CASH',
          estado: 'PENDIENTE',
        }),
      }),
    );
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(), 'financiero.prestamos-cash.credito-override', expect.any(String),
    );
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        detalles: expect.objectContaining({ tipo: 'CREDITO_OVERRIDE', motivo: 'Autorización excepcional' }),
      }),
    }));
  });
});
