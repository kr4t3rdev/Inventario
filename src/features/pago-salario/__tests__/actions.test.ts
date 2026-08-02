/**
 * @description Tests unitarios para Server Actions de pago de salarios.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-test'),
  requireFeature: vi.fn(),
  requireManagerRole: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    pagosalario: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    empleado: { findFirst: vi.fn() },
    reconciliacionGasto: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    cuentaBancaria: { findMany: vi.fn(), updateMany: vi.fn() },
    cuentaPorPagar: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  requireFeature,
  requireManagerRole,
} from '@/lib/services/tenant-scope';
import {
  getPagoSalariosAction,
  getPagoSalarioByIdAction,
  createPagoSalarioAction,
  updatePagoSalarioAction,
  deletePagoSalarioAction,
} from '@/features/pago-salario/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'admin',
};

describe('PagoSalario Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getPagoSalariosAction', () => {
    it('retorna lista del tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.pagosalario.findMany).mockResolvedValue([]);
      const result = await getPagoSalariosAction();
      expect(result.success).toBe(true);
      expect(requireFeature).toHaveBeenCalledWith(
        mockUser,
        'empleados',
        'gestionar pagos de empleados',
      );
    });
  });

  describe('getPagoSalarioByIdAction', () => {
    it('retorna pago por ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.pagosalario.findFirst).mockResolvedValue({ pgId: 'pg-1' } as any);
      const result = await getPagoSalarioByIdAction('pg-1');
      expect(result.success).toBe(true);
    });
  });

  describe('createPagoSalarioAction', () => {
    it('crea pago exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.empleado.findFirst).mockResolvedValue({ empleadoId: 'emp-1' });
      vi.mocked(prisma.pagosalario.create).mockResolvedValue({ pgId: 'pg-1' } as any);
      const result = await createPagoSalarioAction({ empleadoId: 'emp-1', salario: 50000 });
      expect(result.success).toBe(true);
      expect(requireFeature).toHaveBeenCalledWith(
        mockUser,
        'empleados',
        'gestionar pagos de empleados',
      );
      expect(requireManagerRole).toHaveBeenCalledWith(
        mockUser,
        'crear pagos de salario',
      );
    });

    it('rechaza si empleado no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.empleado.findFirst).mockResolvedValue(null);
      const result = await createPagoSalarioAction({ empleadoId: 'emp-noexiste', salario: 50000 });
      expect(result.success).toBe(false);
    });
  });

  describe('updatePagoSalarioAction', () => {
    it('actualiza pago exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.pagosalario.findFirst).mockResolvedValue({ pgId: 'pg-1' });
      vi.mocked(prisma.pagosalario.update).mockResolvedValue({} as any);
      const result = await updatePagoSalarioAction({ pgId: 'pg-1', salario: 60000 });
      expect(result.success).toBe(true);
    });
  });

  describe('deletePagoSalarioAction', () => {
    it('elimina pago exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        pagosalario: {
          findFirst: vi.fn().mockResolvedValue({ pgId: 'pg-1' }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        reconciliacionGasto: {
          findMany: vi.fn().mockResolvedValue([]),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        cuentaBancaria: {
          findMany: vi.fn().mockResolvedValue([{ cuentaId: 'account-1', moneda: 'CUP' }]),
          updateMany: vi.fn(),
        },
        cuentaPorPagar: { findUnique: vi.fn(), update: vi.fn() },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx));
      const result = await deletePagoSalarioAction('pg-1');
      expect(result.success).toBe(true);
      expect(tx.pagosalario.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-test', pgId: 'pg-1' },
      });
    });

    it('revierte el saldo bancario enlazado antes de eliminar', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        pagosalario: {
          findFirst: vi.fn().mockResolvedValue({ pgId: 'pg-1' }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        reconciliacionGasto: {
          findMany: vi.fn().mockResolvedValue([
            {
              reconciliacionId: 'rec-1',
              cuentaId: 'account-1',
              monto: 200,
              montoConvertido: 240,
              cuentaPorPagarId: null,
              moneda: 'USD',
              tasaCambio: 1.2,
            },
          ]),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        cuentaBancaria: {
          findMany: vi.fn().mockResolvedValue([{ cuentaId: 'account-1', moneda: 'CUP' }]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        cuentaPorPagar: { findUnique: vi.fn(), update: vi.fn() },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx));

      const result = await deletePagoSalarioAction('pg-1');

      expect(result.success).toBe(true);
      expect(tx.cuentaBancaria.updateMany).toHaveBeenCalledWith({
        where: { cuentaId: 'account-1', tenantId: 'tenant-test' },
        data: { saldo: { increment: 240 } },
      });
    });
  });

  describe('auth requerido', () => {
    it('retorna AUTH_REQUIRED', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await getPagoSalariosAction();
      expect(result.success).toBe(false);
    });
  });

  describe('plan básico integrado en empleados', () => {
    it('permite pagos con empleados:true aunque nomina:false', async () => {
      const basicPlanUser: AuthenticatedUser = {
        ...mockUser,
        role: 'user',
        tenantRole: 'manager',
        planFeatures: {
          empleados: true,
          nomina: false,
          asistencia: false,
          vacaciones: false,
        },
      };

      vi.mocked(getCurrentUser).mockResolvedValue(basicPlanUser);
      vi.mocked(prisma.pagosalario.findMany).mockResolvedValue([]);

      const result = await getPagoSalariosAction();

      expect(result.success).toBe(true);
      expect(requireFeature).toHaveBeenCalledWith(
        basicPlanUser,
        'empleados',
        'gestionar pagos de empleados',
      );
    });
  });
});
