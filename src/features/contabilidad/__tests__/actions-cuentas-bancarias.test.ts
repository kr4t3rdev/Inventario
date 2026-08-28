/**
 * @description Tests para las Server Actions de Cuentas Bancarias.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
import {
  getCuentasBancariasAction,
  getCuentaBancariaByIdAction,
  createCuentaBancariaAction,
  updateCuentaBancariaAction,
  deleteCuentaBancariaAction,
  getCuentaHistorialAction,
} from '@/features/contabilidad/actions-cuentas-bancarias';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const txClient = {
  cuentaBancaria: { create: vi.fn() },
  inyeccionCapital: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};

const mockUser: AuthenticatedUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 't1',
  tenantRole: 'admin',
};

const mockCuenta = {
  cuentaId: 'c1',
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
    txClient.cuentaBancaria.create.mockReset();
    txClient.inyeccionCapital.create.mockReset();
    txClient.auditLog.create.mockReset();
  });

  describe('getCuentasBancariasAction', () => {
    it('debe retornar todas las cuentas del tenant', async () => {
      vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([mockCuenta]);

      const result = await getCuentasBancariasAction();

      expect(result.success).toBe(true);
      expect(result.data?.cuentas).toHaveLength(1);
      expect(result.data!.cuentas[0].nombreBanco).toBe('Banco Test');
      expect(prisma.cuentaBancaria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 't1' } })
      );
    });

    it('debe retornar lista vacía si no hay cuentas', async () => {
      vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([]);

      const result = await getCuentasBancariasAction();

      expect(result.success).toBe(true);
      expect(result.data?.cuentas).toEqual([]);
    });

    it('debe fallar si el usuario no está autenticado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await getCuentasBancariasAction();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('getCuentaBancariaByIdAction', () => {
    it('debe retornar una cuenta por ID', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(mockCuenta);

      const result = await getCuentaBancariaByIdAction('c1');

      expect(result.success).toBe(true);
      expect(result.data?.cuentaId).toBe('c1');
    });

    it('debe fallar si la cuenta no existe', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(null);

      const result = await getCuentaBancariaByIdAction('inexistente');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
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
      expect(prisma.cuentaBancaria.create).not.toHaveBeenCalled();
    });

    it('rechaza un saldo inicial positivo sin fuente contable', async () => {
      const result = await createCuentaBancariaAction({ ...validInput, saldo: 1000 });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza un saldo inicial negativo', async () => {
      const result = await createCuentaBancariaAction({ ...validInput, saldo: -1 });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
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
      expect(result.error?.code).toBe('PERIODO_CERRADO');
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
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

  });

  describe('updateCuentaBancariaAction', () => {
    it('rechaza un intento manipulado de actualizar el saldo directamente', async () => {
      const result = await updateCuentaBancariaAction({
        cuentaId: 'c1',
        saldo: 9999,
      } as never);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
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
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(prisma.cuentaBancaria.update).not.toHaveBeenCalled();
    });

    it('rechaza cambiar moneda cuando existe una contrapartida con monto', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst)
        .mockResolvedValueOnce({ ...mockCuenta, saldo: 0 } as never)
        .mockResolvedValueOnce({ cuentaId: 'c1' } as never);

      const result = await updateCuentaBancariaAction({ cuentaId: 'c1', moneda: 'USD' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(prisma.cuentaBancaria.update).not.toHaveBeenCalled();
    });

    it('rechaza cambiar moneda con saldo cero cuando existe movimiento histórico', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst)
        .mockResolvedValueOnce({ ...mockCuenta, saldo: 0 } as never)
        .mockResolvedValueOnce({ cuentaId: 'c1' } as never);

      const result = await updateCuentaBancariaAction({ cuentaId: 'c1', moneda: 'USD' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
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
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('deleteCuentaBancariaAction', () => {
    it('debe eliminar una cuenta existente', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(mockCuenta);
      vi.mocked(prisma.cuentaBancaria.delete).mockResolvedValue(mockCuenta);

      const result = await deleteCuentaBancariaAction('c1');

      expect(result.success).toBe(true);
      expect(result.data?.eliminado).toBe(true);
      expect(prisma.cuentaBancaria.delete).toHaveBeenCalledWith({
        where: { cuentaId: 'c1' },
      });
    });

    it('debe fallar si la cuenta no existe', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(null);

      const result = await deleteCuentaBancariaAction('inexistente');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
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
      expect(result.data?.transacciones).toEqual([]);
      expect(result.data?.resumen.saldoActual).toBe(1000);
      expect(result.data?.resumen.totalMovimientos).toBe(0);
    });

    it('debe fallar si la cuenta no existe', async () => {
      vi.mocked(prisma.cuentaBancaria.findFirst).mockResolvedValue(null);

      const result = await getCuentaHistorialAction({ cuentaId: 'inexistente' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });
});
