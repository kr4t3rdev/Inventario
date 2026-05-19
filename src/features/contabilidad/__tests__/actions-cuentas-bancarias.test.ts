/**
 * @description Tests para las Server Actions de Cuentas Bancarias.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
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
    inyeccionCapital: { findMany: vi.fn() },
    pagoDeuda: { findMany: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getCuentasBancariasAction,
  getCuentaBancariaByIdAction,
  createCuentaBancariaAction,
  updateCuentaBancariaAction,
  deleteCuentaBancariaAction,
  getCuentaHistorialAction,
} from '@/features/contabilidad/actions-cuentas-bancarias';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

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

    it('debe crear una cuenta exitosamente', async () => {
      const created = {
        ...mockCuenta,
        cuentaId: 'c2',
        nombreBanco: validInput.nombreBanco,
        numeroCuenta: validInput.numeroCuenta,
        tipoCuenta: validInput.tipoCuenta,
        moneda: validInput.moneda,
        saldo: 0,
      };
      vi.mocked(prisma.cuentaBancaria.create).mockResolvedValue(created);

      const result = await createCuentaBancariaAction(validInput);

      expect(result.success).toBe(true);
      expect(prisma.cuentaBancaria.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nombreBanco: 'Nuevo Banco',
            isActive: true,
            tenantId: 't1',
          }),
        })
      );
    });

    it('debe crear una cuenta con isActive por defecto', async () => {
      const created = {
        ...mockCuenta,
        cuentaId: 'c3',
        nombreBanco: validInput.nombreBanco,
        numeroCuenta: validInput.numeroCuenta,
        isActive: true,
      };
      vi.mocked(prisma.cuentaBancaria.create).mockResolvedValue(created);

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
      vi.mocked(prisma.cuentaBancaria.findUnique).mockResolvedValue(null);

      const result = await getCuentaHistorialAction({ cuentaId: 'inexistente' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });
});
