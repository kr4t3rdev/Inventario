/**
 * @description Gate de cupo común en `AccountingCashOperationsMutationService.createCashLoan`
 * (ruta alternativa de alta de CxC `PRESTAMO_CASH` usada por la Server Action y el
 * endpoint móvil): el desembolso aumenta exposición y exige override explícito con
 * `financiero.prestamos-cash.credito-override`, motivo y auditoría estricta en la misma tx.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  accountFindFirst: vi.fn(),
  clientFindFirst: vi.fn(),
  tipoPagoFindFirst: vi.fn(),
  transaction: vi.fn(),
  postEvento: vi.fn(),
  lock: vi.fn(),
  tx: {
    $queryRaw: vi.fn().mockResolvedValue([]),
    tenantAccountingPolicy: {
      findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
    },
    cuentaBancaria: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    cuentaPorCobrar: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    reconciliacionVenta: { create: vi.fn() },
    prestamoCash: { create: vi.fn() },
    cliente: { findFirst: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: { findFirst: mock.accountFindFirst },
    cliente: { findFirst: mock.clientFindFirst },
    tipoPago: { findFirst: mock.tipoPagoFindFirst },
    $transaction: mock.transaction,
  },
}));

vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
  postEvento: mock.postEvento,
}));

vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock: mock.lock,
}));

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: vi.fn().mockResolvedValue(null),
    logStrict: vi.fn((_params: unknown, client: typeof mock.tx) => client.auditLog.create({ data: _params })),
  },
}));

// Espías pass-through: conservan la lógica real de autorización.
vi.mock('@/lib/services/tenant-scope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/tenant-scope')>();
  return {
    ...actual,
    requireFeature: vi.fn(actual.requireFeature),
    requirePermission: vi.fn(actual.requirePermission),
    requireTenant: vi.fn(actual.requireTenant),
  };
});

import { AuditLogService } from '@/lib/services/audit-log-service';
import { requirePermission } from '@/lib/services/tenant-scope';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const managerConOverride: AuthenticatedUser = {
  userId: 'user-loan-1',
  name: 'Manager Loans',
  email: 'loans@test.local',
  role: 'user',
  isActive: true,
  tenantId: 'tenant-a',
  tenantRole: 'manager',
  planFeatures: { 'prestamos-cash': true, contabilidad: true },
  permissions: new Set(['financiero.contabilidad.acceder', 'financiero.prestamos-cash.credito-override']),
} as unknown as AuthenticatedUser;

const dependienteSinOverride: AuthenticatedUser = {
  ...managerConOverride,
  userId: 'user-loan-2',
  tenantRole: 'dependiente',
  permissions: new Set(['financiero.contabilidad.acceder']),
} as unknown as AuthenticatedUser;

/** @description Input base de desembolso CUP por 500. */
function inputDesembolso(extra: Record<string, unknown> = {}) {
  return {
    clienteId: 'client-a',
    montoCapital: 500,
    moneda: 'CUP',
    cuentaBancariaId: 'bank-a',
    ...extra,
  };
}

describe('gate 4.2.c: createCashLoan bajo cupo común', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.accountFindFirst.mockResolvedValue({
      cuentaId: 'bank-a', tenantId: 'tenant-a', saldo: 100_000,
      isActive: true, tipoCuenta: 'CORRIENTE', moneda: 'CUP',
    });
    mock.clientFindFirst.mockResolvedValue({ clienteId: 'client-a' });
    mock.tipoPagoFindFirst.mockResolvedValue({ tipoId: 'payment-a' });
    mock.tx.cliente.findFirst.mockResolvedValue({ clienteId: 'client-a', limiteCredito: 100 } as never);
    mock.tx.cuentaPorCobrar.findMany.mockResolvedValue([] as never);
    mock.tx.cuentaPorCobrar.create.mockResolvedValue({ id: 'ar-new' } as never);
    mock.tx.reconciliacionVenta.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      reconciliacionId: 'rec-loan',
      ...data,
    }));
    mock.tx.prestamoCash.create.mockResolvedValue({
      id: 'loan-new', cliente: {}, cuentaPorCobrar: {},
    } as never);
    mock.transaction.mockImplementation(async (callback: (tx: typeof mock.tx) => Promise<unknown>) =>
      callback(mock.tx));
  });

  it('rechaza CREDITO_EXCEDIDO cuando el desembolso excede el cupo sin override', async () => {
    await expect(AccountingCashOperationsMutationService.createCashLoan({
      input: inputDesembolso(),
      user: managerConOverride,
    })).rejects.toMatchObject({ code: 'CREDITO_EXCEDIDO' });
    expect(mock.tx.cuentaPorCobrar.create).not.toHaveBeenCalled();
    expect(mock.tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
    expect(AuditLogService.logStrict).not.toHaveBeenCalled();
  });

  it('rechaza FORBIDDEN con intención y motivo pero sin permiso de override', async () => {
    await expect(AccountingCashOperationsMutationService.createCashLoan({
      input: inputDesembolso({
        solicitarCreditoOverride: true,
        motivoCreditoOverride: 'Cliente estratégico',
      }),
      user: dependienteSinOverride,
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(), 'financiero.prestamos-cash.credito-override', expect.any(String),
    );
    expect(mock.tx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('autoriza el exceso con permiso + motivo, sella moneda de la CxC y audita en tx', async () => {
    const result = await AccountingCashOperationsMutationService.createCashLoan({
      input: inputDesembolso({
        solicitarCreditoOverride: true,
        motivoCreditoOverride: 'Cliente estratégico',
      }),
      user: managerConOverride,
    });

    expect(result).toMatchObject({ id: 'loan-new' });
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(), 'financiero.prestamos-cash.credito-override', expect.any(String),
    );
    expect(mock.tx.cuentaPorCobrar.create).toHaveBeenCalledOnce();
    const cxcData = mock.tx.cuentaPorCobrar.create.mock.calls[0]?.[0].data;
    expect(cxcData.tipoCuenta).toBe('PRESTAMO_CASH');
    expect(cxcData.montoDeuda.toString()).toBe('500');
    expect(cxcData.monedaOriginal).toBe('CUP');
    expect(cxcData.montoOriginal.toString()).toBe('500');
    expect(AuditLogService.logStrict).toHaveBeenCalledWith(expect.objectContaining({
      detalles: expect.objectContaining({
        tipo: 'CREDITO_OVERRIDE',
        clienteId: 'client-a',
        motivo: 'Cliente estratégico',
      }),
    }), mock.tx);
  });

  it('cliente sin límite mantiene desembolso libre aunque tenga CxC legacy sin moneda', async () => {
    mock.tx.cliente.findFirst.mockResolvedValue({ clienteId: 'client-a', limiteCredito: null } as never);
    mock.tx.cuentaPorCobrar.findMany.mockResolvedValue([
      { montoDeuda: 1000, montoPagado: 0, monedaOriginal: null },
    ] as never);

    const result = await AccountingCashOperationsMutationService.createCashLoan({
      input: inputDesembolso(),
      user: managerConOverride,
    });

    expect(result).toMatchObject({ id: 'loan-new' });
    expect(AuditLogService.logStrict).toHaveBeenCalledWith(expect.objectContaining({
      entidad: 'PRESTAMO_CASH', entidadId: 'loan-new',
    }), mock.tx);
    expect(AuditLogService.logStrict).not.toHaveBeenCalledWith(expect.objectContaining({
      detalles: expect.objectContaining({ tipo: 'CREDITO_OVERRIDE' }),
    }), mock.tx);
  });

  it('cliente ajeno dentro de la transacción → NOT_FOUND antes de escribir', async () => {
    mock.tx.cliente.findFirst.mockResolvedValue(null as never);

    await expect(AccountingCashOperationsMutationService.createCashLoan({
      input: inputDesembolso(),
      user: managerConOverride,
    })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mock.tx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });
});
