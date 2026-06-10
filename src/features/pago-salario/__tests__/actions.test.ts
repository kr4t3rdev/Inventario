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
    pagosalario: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    empleado: { findFirst: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
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
      vi.mocked(prisma.pagosalario.findFirst).mockResolvedValue({ pgId: 'pg-1' });
      vi.mocked(prisma.pagosalario.delete).mockResolvedValue({} as any);
      const result = await deletePagoSalarioAction('pg-1');
      expect(result.success).toBe(true);
    });
  });

  describe('auth requerido', () => {
    it('retorna AUTH_REQUIRED', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await getPagoSalariosAction();
      expect(result.success).toBe(false);
    });
  });
});
