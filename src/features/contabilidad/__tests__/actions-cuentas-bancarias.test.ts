/**
 * @description Tests para las Server Actions de Cuentas Bancarias.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from '@/test/action-response';
const periodGuardState = vi.hoisted(() => ({ blocked: false }));
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/with-period-validation', async () => {
  const { ActionError } = await import('@/lib/server-actions/types');
  return {
    withPeriodValidation: (extractDate: (input: { saldo?: number }) => Date | null, handler: Function) =>
      async (input: { saldo?: number }, user: AuthenticatedUser) => {
        if (extractDate(input) && periodGuardState.blocked) {
          throw new ActionError('El período está cerrado', 'PERIODO_CERRADO');
        }
        return handler(input, user);
      },
  };
});
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: vi.fn() },
}));
vi.mock('@/features/contabilidad-formal/services/capital-adjustment-posting-service', () => ({
  emitirInyeccionCapital: vi.fn().mockResolvedValue({ estado: 'CONTABILIZADO', asientoId: 'as-cap-1' }),
}));
vi.mock('@/features/contabilidad/services/initialization-period', () => ({
  ensureCutoffPeriod: vi.fn().mockResolvedValue({ periodoId: 'p1', tipo: 'MENSUAL', estado: 'ABIERTO' }),
  resolveCutoffPeriod: vi.fn(),
}));
vi.mock('@/features/contabilidad/services/initialization-coordinator', () => ({
  createInitializationApertura: vi.fn().mockResolvedValue({}),
  parseCutoffDate: vi.fn((value: string) => new Date(`${value}T00:00:00.000Z`)),
  postOpeningEntry: vi.fn().mockResolvedValue(null),
  resolveRoleAccountId: vi.fn().mockResolvedValue('cc-bancos'),
  verifyInitializationReplay: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/features/contabilidad/services/initialization-idempotency', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/contabilidad/services/initialization-idempotency')>();
  return { ...actual, runIdempotentInitialization: vi.fn() };
});
vi.mock('@/features/contabilidad/services/initial-inventory-persistence', () => ({
  persistInitialInventory: vi.fn().mockResolvedValue({ count: 0, totalFuncional: '0', fuentes: [], filas: [] }),
}));
vi.mock('@/features/contabilidad/services/initial-inventory-reconciliation', () => ({
  reconcileInitialInventory: vi.fn().mockReturnValue({ conciliado: true }),
}));
vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/services/anticipos-workflow', () => ({
  registrarMovimientoEfectivoAnticipo: vi.fn().mockResolvedValue({ movimientoId: 'm1' }),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    cuentaBancaria: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    reconciliacionVenta: { findMany: vi.fn() },
    reconciliacionServicio: { findMany: vi.fn() },
    reconciliacionGasto: { findMany: vi.fn() },
    ajusteBancario: { findMany: vi.fn() },
    transferenciaBancaria: { findMany: vi.fn() },
    inyeccionCapital: { findMany: vi.fn(), create: vi.fn() },
    pagoDeuda: { findMany: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { emitirInyeccionCapital } from '@/features/contabilidad-formal/services/capital-adjustment-posting-service';
import { runIdempotentInitialization } from '@/features/contabilidad/services/initialization-idempotency';
import { registrarMovimientoEfectivoAnticipo } from '@/lib/services/anticipos-workflow';
import { ActionError } from '@/lib/server-actions';
import { ensureCutoffPeriod } from '@/features/contabilidad/services/initialization-period';
import { persistInitialInventory } from '@/features/contabilidad/services/initial-inventory-persistence';
import { reconcileInitialInventory } from '@/features/contabilidad/services/initial-inventory-reconciliation';
import {
  createInitializationApertura,
  postOpeningEntry,
  resolveRoleAccountId,
  verifyInitializationReplay,
} from '@/features/contabilidad/services/initialization-coordinator';
import {
  getCuentasBancariasAction,
  getCuentaBancariaByIdAction,
  createCuentaBancariaAction,
  updateCuentaBancariaAction,
  deleteCuentaBancariaAction,
  getCuentaHistorialAction,
  initializeBankAccountsAction,
} from '@/features/contabilidad/actions-cuentas-bancarias';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const txClient = {
  cuentaBancaria: { create: vi.fn(), count: vi.fn() },
  inyeccionCapital: { create: vi.fn(), count: vi.fn() },
  anticipo: { create: vi.fn(), count: vi.fn() },
  anticipoMovimiento: { create: vi.fn() },
  cuentaPorCobrar: { count: vi.fn() },
  cuentaPorPagar: { count: vi.fn() },
  stockUbicacion: { count: vi.fn() },
  deudaCash: { count: vi.fn() },
  prestamoCash: { count: vi.fn() },
  tenantAccountingPolicy: { findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }) },
  asiento: { count: vi.fn() },
  aperturaPeriodo: { count: vi.fn() },
  auditLog: { create: vi.fn() },
};

const mockUser: AuthenticatedUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 't1',
  tenantRole: 'manager',
};

const mockCuenta = {
  cuentaId: 'c1',
  tenantId: 't1',
  nombreCuenta: null,
  nombreBanco: 'Banco Test',
  numeroCuenta: '123-456',
  tipoCuenta: 'AHORROS',
  saldo: 1000,
  moneda: 'CUP',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('Cuentas Bancarias Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(AuditLogService.log).mockResolvedValue(null);
    vi.mocked(AuditLogService.logStrict).mockResolvedValue({} as never);
    periodGuardState.blocked = false;
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(txClient as never));
    txClient.cuentaBancaria.create.mockResolvedValue({ ...mockCuenta, cuentaId: 'init-default', saldo: 0 });
    txClient.cuentaBancaria.count.mockResolvedValue(0);
    txClient.asiento.count.mockResolvedValue(0);
    txClient.aperturaPeriodo.count.mockResolvedValue(0);
    txClient.cuentaPorCobrar.count.mockResolvedValue(0);
    txClient.cuentaPorPagar.count.mockResolvedValue(0);
    txClient.stockUbicacion.count.mockResolvedValue(0);
    txClient.anticipo.count.mockResolvedValue(0);
    txClient.inyeccionCapital.count.mockResolvedValue(0);
    txClient.deudaCash.count.mockResolvedValue(0);
    txClient.prestamoCash.count.mockResolvedValue(0);
    vi.mocked(ensureCutoffPeriod).mockResolvedValue({ periodoId: 'p1', tipo: 'MENSUAL', estado: 'ABIERTO' } as never);
    vi.mocked(postOpeningEntry).mockResolvedValue(null);
    vi.mocked(createInitializationApertura).mockResolvedValue({} as never);
    vi.mocked(resolveRoleAccountId).mockResolvedValue('cc-bancos');
    vi.mocked(verifyInitializationReplay).mockResolvedValue(undefined);
    txClient.inyeccionCapital.create.mockResolvedValue({ id: 'inj-1', fechaRegistro: new Date('2026-11-01T00:00:00.000Z') });
    txClient.anticipo.create.mockReset();
    txClient.anticipoMovimiento.create.mockReset();
    vi.mocked(registrarMovimientoEfectivoAnticipo).mockResolvedValue({
      movimientoId: 'm1', saldoDisponible: 50, idempotentReplay: false,
    });
    vi.mocked(runIdempotentInitialization).mockImplementation(async (_input, execute) => ({
      replayed: false,
      resultado: await execute(txClient as never),
    }));
    vi.mocked(emitirInyeccionCapital).mockResolvedValue({ estado: 'CONTABILIZADO', asientoId: 'as-cap-1' });
    vi.mocked(persistInitialInventory).mockResolvedValue({ count: 0, totalFuncional: '0', fuentes: [], filas: [] });
    vi.mocked(reconcileInitialInventory).mockReturnValue({ conciliado: true });
    txClient.auditLog.create.mockReset();
  });

  describe('getCuentasBancariasAction', () => {
    it('debe retornar todas las cuentas del tenant', async () => {
      vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([mockCuenta]);

      const result = await getCuentasBancariasAction();

      expect(result.success).toBe(true);
      expect(expectActionSuccess(result).data?.cuentas).toHaveLength(1);
      expect(expectActionSuccess(result).data!.cuentas[0].nombreBanco).toBe('Banco Test');
      expect(prisma.cuentaBancaria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 't1' } })
      );
    });

    it('debe retornar lista vacía si no hay cuentas', async () => {
      vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([]);

      const result = await getCuentasBancariasAction();

      expect(result.success).toBe(true);
      expect(expectActionSuccess(result).data?.cuentas).toEqual([]);
    });

    it('debe fallar si el usuario no está autenticado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await getCuentasBancariasAction();

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('getCuentaBancariaByIdAction', () => {
    it('debe retornar una cuenta por ID', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(mockCuenta);

      const result = await getCuentaBancariaByIdAction('c1');

      expect(result.success).toBe(true);
      expect(expectActionSuccess(result).data?.cuentaId).toBe('c1');
    });

    it('debe fallar si la cuenta no existe', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(null);

      const result = await getCuentaBancariaByIdAction('inexistente');

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('NOT_FOUND');
    });
  });

  describe('createCuentaBancariaAction', () => {
    const validInput = {
      nombreBanco: 'Nuevo Banco',
      numeroCuenta: '789-012',
      tipoCuenta: 'CORRIENTE',
      moneda: 'USD',
    };

    it('crea una cuenta con saldo cero sin contrapartida', async () => {
      const created = {
        ...mockCuenta,
        cuentaId: 'c2',
        nombreBanco: validInput.nombreBanco,
        numeroCuenta: validInput.numeroCuenta,
        tipoCuenta: validInput.tipoCuenta,
        moneda: validInput.moneda,
        saldo: 0,
      };
      txClient.cuentaBancaria.create.mockResolvedValue(created);

      const result = await createCuentaBancariaAction(validInput);

      expect(result.success).toBe(true);
      expect(txClient.cuentaBancaria.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nombreBanco: 'Nuevo Banco',
            isActive: true,
            tenantId: 't1',
          }),
        })
      );
      expect(txClient.inyeccionCapital.create).not.toHaveBeenCalled();
      expect(emitirInyeccionCapital).not.toHaveBeenCalled();
      expect(prisma.cuentaBancaria.create).not.toHaveBeenCalled();
    });

    it('rechaza un saldo inicial positivo sin fuente contable', async () => {
      const result = await createCuentaBancariaAction({ ...validInput, saldo: 1000 });

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('VALIDATION_ERROR');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza un saldo inicial negativo', async () => {
      const result = await createCuentaBancariaAction({ ...validInput, saldo: -1 });

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('VALIDATION_ERROR');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('bloquea el saldo positivo cuando el período contable está cerrado', async () => {
      periodGuardState.blocked = true;

      const result = await createCuentaBancariaAction({
        ...validInput,
        saldo: 1000,
        fuenteSaldoInicial: 'CAPITAL_SOCIAL',
        socio: 'Socio fundador',
      });

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('PERIODO_CERRADO');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('crea la contrapartida de capital social dentro de la transacción', async () => {
      const created = { ...mockCuenta, cuentaId: 'capital-account', saldo: 1000 };
      txClient.cuentaBancaria.create.mockResolvedValue(created);
      txClient.inyeccionCapital.create.mockResolvedValue({ id: 'capital-1' });

      const result = await createCuentaBancariaAction({
        ...validInput,
        saldo: 1000,
        fuenteSaldoInicial: 'CAPITAL_SOCIAL',
        socio: 'Socio fundador',
      });

      expect(result.success).toBe(true);
      expect(txClient.inyeccionCapital.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'CAPITAL_SOCIAL',
          montoRecibido: 1000,
          cuentaId: 'capital-account',
          socio: 'Socio fundador',
        }),
      });
      expect(emitirInyeccionCapital).toHaveBeenCalledWith(
        txClient, { tenantId: 't1', userId: 'u1' },
        expect.objectContaining({ inyeccionId: 'capital-1', monto: 1000, tipo: 'CAPITAL_SOCIAL' }),
      );
      expect(AuditLogService.logStrict).toHaveBeenCalledWith(
        expect.objectContaining({ entidadId: 'capital-account' }),
        txClient,
      );
      expect(AuditLogService.logStrict).toHaveBeenCalledWith(
        expect.objectContaining({ entidadId: 'capital-1' }),
        txClient,
      );
      expect(AuditLogService.logStrict).toHaveBeenCalledTimes(2);
      expect(prisma.cuentaBancaria.create).not.toHaveBeenCalled();
      expect(prisma.inyeccionCapital.create).not.toHaveBeenCalled();
    });

    it('crea la contrapartida de deuda externa dentro de la transacción', async () => {
      const created = { ...mockCuenta, cuentaId: 'debt-account', saldo: 2500 };
      txClient.cuentaBancaria.create.mockResolvedValue(created);
      txClient.inyeccionCapital.create.mockResolvedValue({ id: 'debt-1' });

      const result = await createCuentaBancariaAction({
        ...validInput,
        saldo: 2500,
        fuenteSaldoInicial: 'DEUDA_EXTERNA',
        entidadPrestamista: 'Financiera externa',
      });

      expect(result.success).toBe(true);
      expect(txClient.inyeccionCapital.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'DEUDA_EXTERNA',
          montoRecibido: 2500,
          saldoPendiente: 2500,
          montoTotalDeuda: 2500,
          cuentaId: 'debt-account',
          entidadPrestamista: 'Financiera externa',
          estado: 'ACTIVA',
        }),
      });
    });

    it('no deja una cuenta huérfana si falla la contrapartida', async () => {
      txClient.cuentaBancaria.create.mockResolvedValue({
        ...mockCuenta,
        cuentaId: 'rolled-back-account',
        saldo: 1000,
      });
      txClient.inyeccionCapital.create.mockRejectedValue(
        new Error('counterpart failed'),
      );

      const result = await createCuentaBancariaAction({
        ...validInput,
        saldo: 1000,
        fuenteSaldoInicial: 'CAPITAL_SOCIAL',
        socio: 'Socio fundador',
      });

      expect(result.success).toBe(false);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txClient.cuentaBancaria.create).toHaveBeenCalledTimes(1);
      expect(AuditLogService.log).not.toHaveBeenCalled();
      expect(AuditLogService.logStrict).not.toHaveBeenCalled();
    });

    it('debe crear una cuenta con isActive por defecto', async () => {
      const created = {
        ...mockCuenta,
        cuentaId: 'c3',
        nombreBanco: validInput.nombreBanco,
        numeroCuenta: validInput.numeroCuenta,
        isActive: true,
      };
      txClient.cuentaBancaria.create.mockResolvedValue(created);

      const result = await createCuentaBancariaAction(validInput);

      expect(result.success).toBe(true);
    });

    it('debe fallar con datos inválidos (nombre vacío)', async () => {
      const result = await createCuentaBancariaAction({
        nombreBanco: '',
        numeroCuenta: '789-012',
        tipoCuenta: 'CORRIENTE',
        moneda: 'USD',
      });

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('VALIDATION_ERROR');
    });

  });

  describe('updateCuentaBancariaAction', () => {
    it('rechaza un intento manipulado de actualizar el saldo directamente', async () => {
      const result = await updateCuentaBancariaAction({
        cuentaId: 'c1',
        saldo: 9999,
      } as never);

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('VALIDATION_ERROR');
      expect(prisma.cuentaBancaria.update).not.toHaveBeenCalled();
    });

    it('debe actualizar solo los campos enviados', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(mockCuenta);
      vi.mocked(prisma.cuentaBancaria.update).mockResolvedValue({
        ...mockCuenta,
        nombreBanco: 'Banco Actualizado',
      });

      const result = await updateCuentaBancariaAction({
        cuentaId: 'c1',
        nombreBanco: 'Banco Actualizado',
      });

      expect(result.success).toBe(true);
      expect(prisma.cuentaBancaria.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cuentaId: 'c1' },
          data: { nombreBanco: 'Banco Actualizado' },
        })
      );
    });

    it('debe permitir toggle de isActive sin otros campos', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(mockCuenta);
      vi.mocked(prisma.cuentaBancaria.update).mockResolvedValue({
        ...mockCuenta,
        isActive: false,
      });

      const result = await updateCuentaBancariaAction({
        cuentaId: 'c1',
        isActive: false,
      });

      expect(result.success).toBe(true);
      expect(prisma.cuentaBancaria.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        })
      );
    });

    it('rechaza cambiar moneda cuando la cuenta tiene saldo', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue({
        ...mockCuenta,
      } as never);

      const result = await updateCuentaBancariaAction({ cuentaId: 'c1', moneda: 'USD' });

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('VALIDATION_ERROR');
      expect(prisma.cuentaBancaria.update).not.toHaveBeenCalled();
    });

    it('rechaza cambiar moneda cuando existe una contrapartida con monto', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst)
        .mockResolvedValueOnce({ ...mockCuenta, saldo: 0 } as never)
        .mockResolvedValueOnce({ cuentaId: 'c1' } as never);

      const result = await updateCuentaBancariaAction({ cuentaId: 'c1', moneda: 'USD' });

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('VALIDATION_ERROR');
      expect(prisma.cuentaBancaria.update).not.toHaveBeenCalled();
    });

    it('rechaza cambiar moneda con saldo cero cuando existe movimiento histórico', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst)
        .mockResolvedValueOnce({ ...mockCuenta, saldo: 0 } as never)
        .mockResolvedValueOnce({ cuentaId: 'c1' } as never);

      const result = await updateCuentaBancariaAction({ cuentaId: 'c1', moneda: 'USD' });

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('VALIDATION_ERROR');
      expect(prisma.cuentaBancaria.update).not.toHaveBeenCalled();
      expect(prisma.cuentaBancaria.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cuentaId: 'c1',
            tenantId: 't1',
            OR: expect.arrayContaining([
              { ajustes: { some: {} } },
              { transferenciasOrigen: { some: {} } },
              { transferenciasDestino: { some: {} } },
              { reconciliacionesVenta: { some: {} } },
              { reconciliacionesServicio: { some: {} } },
              { reconciliacionesGasto: { some: {} } },
              { pagosDeuda: { some: {} } },
              { facturas: { some: {} } },
            ]),
          }),
          select: { cuentaId: true },
        }),
      );
    });

    it('permite cambiar moneda cuando cuenta y contrapartidas están en cero', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst)
        .mockResolvedValueOnce({ ...mockCuenta, saldo: 0 } as never)
        .mockResolvedValueOnce(null);
      vi.mocked(prisma.cuentaBancaria.update).mockResolvedValue({
        ...mockCuenta,
        saldo: 0,
        moneda: 'USD',
      });

      const result = await updateCuentaBancariaAction({ cuentaId: 'c1', moneda: 'USD' });

      expect(result.success).toBe(true);
      expect(prisma.cuentaBancaria.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { moneda: 'USD' } }),
      );
    });

    it('debe fallar si la cuenta no existe', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(null);

      const result = await updateCuentaBancariaAction({
        cuentaId: 'inexistente',
        nombreBanco: 'Nada',
      });

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('NOT_FOUND');
    });
  });

  describe('deleteCuentaBancariaAction', () => {
    it('debe eliminar una cuenta existente', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(mockCuenta);
      vi.mocked(prisma.cuentaBancaria.delete).mockResolvedValue(mockCuenta);

      const result = await deleteCuentaBancariaAction('c1');

      expect(result.success).toBe(true);
      expect(expectActionSuccess(result).data?.eliminado).toBe(true);
      expect(prisma.cuentaBancaria.delete).toHaveBeenCalledWith({
        where: { cuentaId: 'c1' },
      });
    });

    it('debe fallar si la cuenta no existe', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(null);

      const result = await deleteCuentaBancariaAction('inexistente');

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('NOT_FOUND');
    });
  });

  describe('getCuentaHistorialAction', () => {
    beforeEach(() => {
      vi.mocked(prisma.cuentaBancaria.findUnique).mockResolvedValue(mockCuenta);
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(mockCuenta);
      vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([]);
      vi.mocked(prisma.reconciliacionServicio.findMany).mockResolvedValue([]);
      vi.mocked(prisma.reconciliacionGasto.findMany).mockResolvedValue([]);
      vi.mocked(prisma.ajusteBancario.findMany).mockResolvedValue([]);
      vi.mocked(prisma.transferenciaBancaria.findMany).mockResolvedValue([]);
      vi.mocked(prisma.inyeccionCapital.findMany).mockResolvedValue([]);
      vi.mocked(prisma.pagoDeuda.findMany).mockResolvedValue([]);
    });

    it('debe retornar historial vacío para cuenta sin movimientos', async () => {
      const result = await getCuentaHistorialAction({ cuentaId: 'c1' });

      expect(result.success).toBe(true);
      expect(expectActionSuccess(result).data?.transacciones).toEqual([]);
      expect(expectActionSuccess(result).data?.resumen.saldoActual).toBe(1000);
      expect(expectActionSuccess(result).data?.resumen.totalMovimientos).toBe(0);
    });

    it('debe fallar si la cuenta no existe', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(null);

      const result = await getCuentaHistorialAction({ cuentaId: 'inexistente' });

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('NOT_FOUND');
    });

    it('el resumen de período completo usa todas las transacciones, no solo la página', async () => {
      const ventas = Array.from({ length: 15 }, (_, i) => ({
        reconciliacionId: `v-${i}`,
        monto: 100,
        moneda: 'CUP',
        montoConvertido: 100,
        tasaCambio: null,
        fechaReconciliacion: new Date(`2026-05-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`),
        observaciones: null,
        tipoReconciliacion: 'VENTA',
      }));
      vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue(ventas as never);

      const result = await getCuentaHistorialAction({
        cuentaId: 'c1',
        page: 1,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(expectActionSuccess(result).data?.transacciones).toHaveLength(10);
      expect(expectActionSuccess(result).data?.resumen.totalIngresos).toBe(1500);
      expect(expectActionSuccess(result).data?.resumen.totalMovimientos).toBe(15);
      expect(expectActionSuccess(result).data?.pagination.total).toBe(15);
      expect(expectActionSuccess(result).data?.pagination.totalPages).toBe(2);
    });

    it('no suma monedas heterogéneas sin evidencia hacia la moneda de la cuenta', async () => {
      vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
        { reconciliacionId: 'v1', monto: 500, moneda: 'CUP', montoConvertido: 500, tasaCambio: null, fechaReconciliacion: new Date('2026-05-01T12:00:00.000Z'), observaciones: null, tipoReconciliacion: 'VENTA' },
        { reconciliacionId: 'v2', monto: 100, moneda: 'USD', montoConvertido: null, tasaCambio: null, fechaReconciliacion: new Date('2026-05-02T12:00:00.000Z'), observaciones: null, tipoReconciliacion: 'VENTA' },
      ] as never);
      vi.mocked(prisma.reconciliacionGasto.findMany).mockResolvedValue([
        { reconciliacionId: 'g1', monto: 200, moneda: 'CUP', montoConvertido: 200, tasaCambio: null, fechaReconciliacion: new Date('2026-05-03T12:00:00.000Z'), descripcion: null, observaciones: null },
      ] as never);

      const result = await getCuentaHistorialAction({ cuentaId: 'c1' });

      expect(result.success).toBe(true);
      expect(expectActionSuccess(result).data?.resumen.totalIngresos).toBe(500);
      expect(expectActionSuccess(result).data?.resumen.totalEgresos).toBe(200);
      expect(expectActionSuccess(result).data?.resumen.monedasNoConvertidas).toEqual(['USD']);
      expect(expectActionSuccess(result).data?.transacciones.find((t) => t.monedaOriginal === 'USD')?.montoConvertido).toBeNull();
    });

    it('usa montoConvertido cuando existe evidencia FX hacia CUP', async () => {
      vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
        { reconciliacionId: 'v-usd', monto: 100, moneda: 'USD', montoConvertido: 2450, tasaCambio: 24.5, fechaReconciliacion: new Date('2026-05-01T12:00:00.000Z'), observaciones: null, tipoReconciliacion: 'VENTA' },
      ] as never);

      const result = await getCuentaHistorialAction({ cuentaId: 'c1' });

      expect(result.success).toBe(true);
      expect(expectActionSuccess(result).data?.resumen.totalIngresos).toBe(2450);
      expect(expectActionSuccess(result).data?.resumen.monedasNoConvertidas).toEqual([]);
    });

    it('filtra por tipo de movimiento y mantiene resumen y paginación consistentes', async () => {
      vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
        { reconciliacionId: 'v1', monto: 100, moneda: 'CUP', montoConvertido: 100, tasaCambio: null, fechaReconciliacion: new Date('2026-05-01T12:00:00.000Z'), observaciones: null, tipoReconciliacion: 'VENTA' },
        { reconciliacionId: 'v2', monto: 200, moneda: 'CUP', montoConvertido: 200, tasaCambio: null, fechaReconciliacion: new Date('2026-05-02T12:00:00.000Z'), observaciones: null, tipoReconciliacion: 'VENTA' },
      ] as never);
      vi.mocked(prisma.reconciliacionGasto.findMany).mockResolvedValue([
        { reconciliacionId: 'g1', monto: 50, moneda: 'CUP', montoConvertido: 50, tasaCambio: null, fechaReconciliacion: new Date('2026-05-03T12:00:00.000Z'), descripcion: null, observaciones: null },
      ] as never);

      const result = await getCuentaHistorialAction({
        cuentaId: 'c1',
        tipoMovimiento: 'venta',
      });

      expect(result.success).toBe(true);
      expect(expectActionSuccess(result).data?.transacciones.every((t) => t.tipoMovimiento === 'venta')).toBe(true);
      expect(expectActionSuccess(result).data?.resumen.totalMovimientos).toBe(2);
      expect(expectActionSuccess(result).data?.resumen.totalIngresos).toBe(300);
      expect(expectActionSuccess(result).data?.resumen.totalEgresos).toBe(0);
      expect(expectActionSuccess(result).data?.pagination.total).toBe(2);
    });

    it('trata fechaFin como inclusiva hasta el final del día', async () => {
      await getCuentaHistorialAction({
        cuentaId: 'c1',
        fechaInicio: '2026-05-01',
        fechaFin: '2026-05-31',
      });

      expect(prisma.reconciliacionVenta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fechaReconciliacion: {
              // Mayo en America/Havana está en DST (UTC-4): las medianoches civiles caen a las 04:00Z.
              gte: new Date('2026-05-01T04:00:00.000Z'),
              lt: new Date('2026-06-01T04:00:00.000Z'),
            },
          }),
        }),
      );
      expect(prisma.ajusteBancario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fechaOperacion: {
              gte: new Date('2026-05-01T04:00:00.000Z'),
              lt: new Date('2026-06-01T04:00:00.000Z'),
            },
          }),
        }),
      );
    });

    it('clasifica préstamos y deudas cash según su efecto de caja', async () => {
      vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
        { reconciliacionId: 'loan-payment', monto: 100, moneda: 'CUP', montoConvertido: 100, tasaCambio: null, fechaReconciliacion: new Date('2026-05-01T12:00:00.000Z'), observaciones: null, tipoReconciliacion: 'PRESTAMO_CASH' },
        { reconciliacionId: 'loan-disbursement', monto: 200, moneda: 'CUP', montoConvertido: 200, tasaCambio: null, fechaReconciliacion: new Date('2026-05-02T12:00:00.000Z'), observaciones: null, tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO' },
        { reconciliacionId: 'debt-payment', monto: 300, moneda: 'CUP', montoConvertido: 300, tasaCambio: null, fechaReconciliacion: new Date('2026-05-03T12:00:00.000Z'), observaciones: null, tipoReconciliacion: 'DEUDA_CASH' },
        { reconciliacionId: 'debt-disbursement', monto: 400, moneda: 'CUP', montoConvertido: 400, tasaCambio: null, fechaReconciliacion: new Date('2026-05-04T12:00:00.000Z'), observaciones: null, tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO' },
      ] as never);

      const result = await getCuentaHistorialAction({ cuentaId: 'c1' });

      expect(result.success).toBe(true);
      expect(expectActionSuccess(result).data?.resumen.totalIngresos).toBe(500);
      expect(expectActionSuccess(result).data?.resumen.totalEgresos).toBe(500);
      expect(expectActionSuccess(result).data?.resumen.totalMovimientos).toBe(4);
    });
  });

  describe('initializeBankAccountsAction', () => {
    it('bloquea una inicialización nueva si ya existen saldos en submayores', async () => {
      txClient.cuentaPorCobrar.count.mockResolvedValue(1);
      const result = await initializeBankAccountsAction({
        idempotencyKey: 'blocked-init',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{ nombreCuenta: 'Caja', nombreBanco: 'Banco', numeroCuenta: 'BLOCK',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '0' }],
      });
      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('INITIALIZATION_NOT_EMPTY');
      expect(txClient.cuentaBancaria.create).not.toHaveBeenCalled();
      expect(txClient.inyeccionCapital.create).not.toHaveBeenCalled();
    });
    it('abre un saldo no documentado con asiento de apertura a resultados acumulados', async () => {
      txClient.cuentaBancaria.create.mockResolvedValue({ ...mockCuenta, cuentaId: 'init-unknown', saldo: 0 });
      vi.mocked(postOpeningEntry).mockResolvedValue({ asientoId: 'as-apertura-1', postedLines: [] });
      const result = await initializeBankAccountsAction({
        idempotencyKey: 'unknown-source',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{
          nombreCuenta: 'Caja', nombreBanco: 'Banco', numeroCuenta: 'UNKNOWN-SOURCE',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '100000',
          origenNoDocumentado: true,
        }],
      });
      expect(result.success).toBe(true);
      expect(txClient.cuentaBancaria.create).toHaveBeenCalled();
      expect(vi.mocked(postOpeningEntry)).toHaveBeenCalled();
      expect(vi.mocked(createInitializationApertura)).toHaveBeenCalledWith(
        txClient,
        expect.objectContaining({ asientoId: 'as-apertura-1' }),
      );
      expect(expectActionSuccess(result).data?.resultado.asientoId).toBe('as-apertura-1');
    });

    it('rechaza la apertura cuando el posteo de capital queda omitido por el modo formal', async () => {
      vi.mocked(emitirInyeccionCapital).mockResolvedValue({ estado: 'OMITIDO', asientoId: null } as never);
      const result = await initializeBankAccountsAction({
        idempotencyKey: 'omitted-posting',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{
          nombreCuenta: 'Operaciones', nombreBanco: 'Banco', numeroCuenta: 'OMIT-001',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '100000',
          origen: { tipo: 'CAPITAL_SOCIAL' as const, tercero: 'Socio' },
        }],
      });
      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('INITIALIZATION_POSTING_NO_CONFIRMADO');
      expect(vi.mocked(createInitializationApertura)).not.toHaveBeenCalled();
    });

    it('rechaza la apertura cuando el posteo de capital queda simulado en sombra', async () => {
      vi.mocked(emitirInyeccionCapital).mockResolvedValue({ estado: 'SIMULADO', asientoId: null } as never);
      const result = await initializeBankAccountsAction({
        idempotencyKey: 'simulated-posting',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{
          nombreCuenta: 'Operaciones', nombreBanco: 'Banco', numeroCuenta: 'SIM-001',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '100000',
          origen: { tipo: 'CAPITAL_SOCIAL' as const, tercero: 'Socio' },
        }],
      });
      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('INITIALIZATION_POSTING_NO_CONFIRMADO');
      expect(vi.mocked(createInitializationApertura)).not.toHaveBeenCalled();
    });

    it('concilia el inventario inicial con las líneas DEBE de apertura', async () => {
      vi.mocked(persistInitialInventory).mockResolvedValue({
        count: 1, totalFuncional: '100.0000',
        fuentes: [{ referenciaFila: 'fila-1', fuenteId: 'fuente-1', loteId: 'lote-1' }],
        filas: [{ referenciaFila: 'fila-1', moneda: 'CUP', montoFuncional: '100.0000' }],
      });
      vi.mocked(postOpeningEntry).mockResolvedValue({
        asientoId: 'as-apertura-1',
        postedLines: [{
          index: 1, numeroCuenta: 'INVENTARIO_INICIAL', lado: 'DEBE', rolCuenta: 'INVENTARIOS',
          moneda: 'CUP', montoOriginal: '100', tasaCambio: null, montoFuncional: '100',
          fxEvidenceFingerprint: null, cuentaContableId: 'cc-inventarios',
        }],
      });
      const result = await initializeBankAccountsAction({
        idempotencyKey: 'inventory-ok',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{ nombreCuenta: 'Caja', nombreBanco: 'Banco', numeroCuenta: 'INV-OK',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '0' }],
        inventario: [{ referenciaFila: 'fila-1', productoId: 'prod-1', almacenId: 'alm-1',
          loteCodigo: 'LOTE-1', cantidad: '4', costoUnitario: '25', moneda: 'CUP' }],
      });
      expect(result.success).toBe(true);
      expect(vi.mocked(reconcileInitialInventory)).toHaveBeenCalledWith(
        [{ cuentaContableId: 'cc-inventarios', moneda: 'CUP', cantidad: '4', costoUnitario: '25' }],
        [{ cuentaContableId: 'cc-inventarios', moneda: 'CUP', debito: '100', credito: '0' }],
      );
      expect(vi.mocked(createInitializationApertura)).toHaveBeenCalled();
    });

    it('rechaza la apertura cuando la conciliación de inventario no coincide', async () => {
      vi.mocked(persistInitialInventory).mockResolvedValue({
        count: 1, totalFuncional: '100.0000',
        fuentes: [{ referenciaFila: 'fila-1', fuenteId: 'fuente-1', loteId: 'lote-1' }],
        filas: [{ referenciaFila: 'fila-1', moneda: 'CUP', montoFuncional: '100.0000' }],
      });
      vi.mocked(postOpeningEntry).mockResolvedValue({
        asientoId: 'as-apertura-1',
        postedLines: [{
          index: 1, numeroCuenta: 'INVENTARIO_INICIAL', lado: 'DEBE', rolCuenta: 'INVENTARIOS',
          moneda: 'CUP', montoOriginal: '100', tasaCambio: null, montoFuncional: '100',
          fxEvidenceFingerprint: null, cuentaContableId: 'cc-inventarios',
        }],
      });
      vi.mocked(reconcileInitialInventory).mockImplementation(() => {
        throw new Error('El inventario no coincide con las líneas de apertura');
      });
      const result = await initializeBankAccountsAction({
        idempotencyKey: 'inventory-mismatch',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{ nombreCuenta: 'Caja', nombreBanco: 'Banco', numeroCuenta: 'INV-MISMATCH',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '0' }],
        inventario: [{ referenciaFila: 'fila-1', productoId: 'prod-1', almacenId: 'alm-1',
          loteCodigo: 'LOTE-1', cantidad: '4', costoUnitario: '25', moneda: 'CUP' }],
      });
      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('INITIALIZATION_INCOMPLETE');
      expect(vi.mocked(createInitializationApertura)).not.toHaveBeenCalled();
    });

    it('rechaza la apertura cuando la valoración funcional no coincide con el débito posteado', async () => {
      vi.mocked(persistInitialInventory).mockResolvedValue({
        count: 1, totalFuncional: '90.0000',
        fuentes: [{ referenciaFila: 'fila-1', fuenteId: 'fuente-1', loteId: 'lote-1' }],
        filas: [{ referenciaFila: 'fila-1', moneda: 'CUP', montoFuncional: '90.0000' }],
      });
      vi.mocked(postOpeningEntry).mockResolvedValue({
        asientoId: 'as-apertura-1',
        postedLines: [{
          index: 1, numeroCuenta: 'INVENTARIO_INICIAL', lado: 'DEBE', rolCuenta: 'INVENTARIOS',
          moneda: 'CUP', montoOriginal: '100', tasaCambio: null, montoFuncional: '100',
          fxEvidenceFingerprint: null, cuentaContableId: 'cc-inventarios',
        }],
      });
      const result = await initializeBankAccountsAction({
        idempotencyKey: 'inventory-fx-mismatch',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{ nombreCuenta: 'Caja', nombreBanco: 'Banco', numeroCuenta: 'INV-FX',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '0' }],
        inventario: [{ referenciaFila: 'fila-1', productoId: 'prod-1', almacenId: 'alm-1',
          loteCodigo: 'LOTE-1', cantidad: '4', costoUnitario: '25', moneda: 'CUP' }],
      });
      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('INITIALIZATION_INCOMPLETE');
      expect(vi.mocked(reconcileInitialInventory)).not.toHaveBeenCalled();
      expect(vi.mocked(createInitializationApertura)).not.toHaveBeenCalled();
    });

    it('no exige la conciliación por moneda original cuando el inventario es en moneda extranjera', async () => {
      vi.mocked(persistInitialInventory).mockResolvedValue({
        count: 1, totalFuncional: '400.0000',
        fuentes: [{ referenciaFila: 'fila-usd', fuenteId: 'fuente-usd', loteId: 'lote-usd' }],
        filas: [{ referenciaFila: 'fila-usd', moneda: 'USD', montoFuncional: '400.0000' }],
      });
      vi.mocked(postOpeningEntry).mockResolvedValue({
        asientoId: 'as-apertura-1',
        postedLines: [{
          index: 1, numeroCuenta: 'INVENTARIO_INICIAL', lado: 'DEBE', rolCuenta: 'INVENTARIOS',
          moneda: 'CUP', montoOriginal: '400', tasaCambio: null, montoFuncional: '400',
          fxEvidenceFingerprint: null, cuentaContableId: 'cc-inventarios',
        }],
      });
      const result = await initializeBankAccountsAction({
        idempotencyKey: 'inventory-usd',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{ nombreCuenta: 'Caja', nombreBanco: 'Banco', numeroCuenta: 'INV-USD',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '0' }],
        inventario: [{ referenciaFila: 'fila-usd', productoId: 'prod-1', almacenId: 'alm-1',
          loteCodigo: 'LOTE-USD', cantidad: '4', costoUnitario: '10', moneda: 'USD', tasaCambio: '10' }],
      });
      expect(result.success).toBe(true);
      expect(vi.mocked(reconcileInitialInventory)).not.toHaveBeenCalled();
      expect(vi.mocked(createInitializationApertura)).toHaveBeenCalled();
    });

    it('acepta YA_EXISTENTE del posteo de capital como contrapartida ya registrada', async () => {
      txClient.cuentaBancaria.create.mockResolvedValue({ ...mockCuenta, cuentaId: 'init-ya', saldo: 0 });
      vi.mocked(emitirInyeccionCapital).mockResolvedValue({ estado: 'YA_EXISTENTE', asientoId: 'as-cap-previo' } as never);
      const result = await initializeBankAccountsAction({
        idempotencyKey: 'already-posted',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{
          nombreCuenta: 'Operaciones', nombreBanco: 'Banco', numeroCuenta: 'YA-001',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '100000',
          origen: { tipo: 'CAPITAL_SOCIAL' as const, tercero: 'Socio' },
        }],
      });
      expect(result.success).toBe(true);
      expect(expectActionSuccess(result).data?.resultado.asientos).toContainEqual(
        expect.objectContaining({ tipo: 'INYECCION_CAPITAL', estado: 'YA_EXISTENTE', asientoId: 'as-cap-previo' }),
      );
    });
    it('rechaza usuarios no autenticados antes de abrir la transacción idempotente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await initializeBankAccountsAction({
        idempotencyKey: 'unauthorized-init',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{
          nombreCuenta: 'Caja', nombreBanco: 'Banco', numeroCuenta: 'NO-AUTH',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '0',
        }],
      });
      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('AUTH_REQUIRED');
      expect(runIdempotentInitialization).not.toHaveBeenCalled();
    });

    it('rechaza un resultado previo sin evidencia verificable y no ejecuta otra carga', async () => {
      vi.mocked(runIdempotentInitialization).mockResolvedValue({ replayed: true, resultado: { cuentas: [] } });
      vi.mocked(verifyInitializationReplay).mockRejectedValue(
        new ActionError('La inicialización anterior no tiene evidencia verificable', 'INITIALIZATION_INCOMPLETE'),
      );
      const result = await initializeBankAccountsAction({
        idempotencyKey: 'completed-init',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{ nombreCuenta: 'Caja', nombreBanco: 'Banco', numeroCuenta: 'DONE',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '0' }],
      });
      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('INITIALIZATION_INCOMPLETE');
      expect(txClient.cuentaBancaria.create).not.toHaveBeenCalled();
    });

    it('rechaza un replay positivo no verificable aunque el período actual esté cerrado', async () => {
      vi.mocked(runIdempotentInitialization).mockResolvedValue({ replayed: true, resultado: { cuentas: [] } });
      vi.mocked(verifyInitializationReplay).mockRejectedValue(
        new ActionError('La inicialización anterior no tiene evidencia verificable', 'INITIALIZATION_INCOMPLETE'),
      );
      const result = await initializeBankAccountsAction({ idempotencyKey: 'completed-positive',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{ nombreCuenta: 'Caja', nombreBanco: 'Banco', numeroCuenta: 'DONE-POSITIVE',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '10',
          origen: { tipo: 'CAPITAL_SOCIAL', tercero: 'Socio' } }] });
      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('INITIALIZATION_INCOMPLETE');
      expect(txClient.cuentaBancaria.create).not.toHaveBeenCalled();
    });

    it('autentica, calcula el hash en servidor y crea una cuenta cero una sola vez', async () => {
      const created = { ...mockCuenta, cuentaId: 'init-account', saldo: 0 };
      txClient.cuentaBancaria.create.mockResolvedValue(created);
      const input = {
        idempotencyKey: 'onboarding-1',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{
          nombreCuenta: 'Operaciones',
          nombreBanco: 'Banco Test',
          numeroCuenta: 'INIT-001',
          tipoCuenta: 'CORRIENTE',
          moneda: 'CUP',
          saldoInicial: '0',
        }],
      };

      const result = await initializeBankAccountsAction(input);

      expect(result.success).toBe(true);
      expect(expectActionSuccess(result).data?.replayed).toBe(false);
      expect(vi.mocked(runIdempotentInitialization)).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', idempotencyKey: 'onboarding-1' }),
        expect.any(Function),
      );
      expect(vi.mocked(runIdempotentInitialization).mock.calls[0][0].payloadHash).toMatch(/^[a-f0-9]{64}$/);
      expect(txClient.cuentaBancaria.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ tenantId: 't1', saldo: 0 }),
      }));
    });

    it('bloquea el flujo de empresa nueva si ya existe una apertura formal', async () => {
      txClient.aperturaPeriodo.count.mockResolvedValue(1);
      const result = await initializeBankAccountsAction({
        idempotencyKey: 'existing-opening',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{
          nombreCuenta: 'Banco', nombreBanco: 'Banco', numeroCuenta: 'ALREADY-OPEN',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '0',
        }],
      });
      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('INITIALIZATION_NOT_EMPTY');
      expect(txClient.cuentaBancaria.create).not.toHaveBeenCalled();
    });

    it('bloquea un saldo inicial por anticipo hasta la coordinación de la tarea 5', async () => {
      const input = {
        idempotencyKey: 'onboarding-advance',
        fechaCorte: '2026-11-01',
        monedaFuncional: 'CUP',
        cuentas: [{
          nombreCuenta: 'Cobros', nombreBanco: 'Banco Test', numeroCuenta: 'INIT-002',
          tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '50',
          origen: { tipo: 'ANTICIPO' as const, tercero: 'Cliente inicial', tipoPagoId: 'cash-type' },
        }],
      };

      const result = await initializeBankAccountsAction(input);

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('INITIALIZATION_ANTICIPO_NO_DISPONIBLE');
      expect(vi.mocked(runIdempotentInitialization)).not.toHaveBeenCalled();
      expect(txClient.cuentaBancaria.create).not.toHaveBeenCalled();
      expect(registrarMovimientoEfectivoAnticipo).not.toHaveBeenCalled();
    });
  });
});
