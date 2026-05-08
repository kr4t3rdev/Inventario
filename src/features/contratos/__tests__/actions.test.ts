/**
 * @description Tests unitarios para Server Actions de contratos.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/contratos/lib/numeroContratoGenerator', () => ({
  generarProximoConsecutivo: vi.fn(),
  formatearNumeroContrato: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    contratoVersion: { create: vi.fn() },
    cliente: { update: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { generarProximoConsecutivo, formatearNumeroContrato } from '@/features/contratos/lib/numeroContratoGenerator';
import {
  getContratosAction,
  getContratoByIdAction,
  createContratoAction,
  updateContratoAction,
  deleteContratoAction,
  bulkUpdateContratoStatusAction,
} from '@/features/contratos/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'admin',
};

const mockContrato = {
  contratoId: 'ct-1',
  tenantId: 'tenant-test',
  numeroContrato: 'COMPRA_VENTA-2025-001',
  tipo: 'COMPRA_VENTA',
  estado: 'BORRADOR',
  fechaInicio: new Date(),
  creadoPor: 'user-1',
};

describe('Contratos Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getContratosAction', () => {
    it('retorna lista paginada', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findMany).mockResolvedValue([mockContrato]);
      vi.mocked(prisma.contrato.count).mockResolvedValue(1);

      const result = await getContratosAction({ page: 1, limit: 10 });

      expect(result.success).toBe(true);
      expect(result.data!.meta.total).toBe(1);
      expect(result.data!.data).toHaveLength(1);
    });
  });

  describe('getContratoByIdAction', () => {
    it('retorna contrato por ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue(mockContrato);
      const result = await getContratoByIdAction('ct-1');
      expect(result.success).toBe(true);
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null);
      const result = await getContratoByIdAction('ct-noexiste');
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  describe('createContratoAction', () => {
    const validInput = {
      tipo: 'COMPRA_VENTA',
      fechaInicio: new Date().toISOString(),
      clienteId: 'cli-1',
    };

    it('crea contrato exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(generarProximoConsecutivo).mockResolvedValue(1);
      vi.mocked(formatearNumeroContrato).mockReturnValue('COMPRA_VENTA-2025-001');
      vi.mocked(prisma.contrato.create).mockResolvedValue(mockContrato);
      vi.mocked(prisma.contratoVersion.create).mockResolvedValue({} as any);
      vi.mocked(prisma.cliente.update).mockResolvedValue({} as any);

      const result = await createContratoAction(validInput as any);

      expect(result.success).toBe(true);
      expect(generarProximoConsecutivo).toHaveBeenCalledWith('COMPRA_VENTA');
    });

    it('rechaza si faltan datos requeridos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const result = await createContratoAction({ fechaInicio: new Date().toISOString() } as any);

      expect(result.success).toBe(false);
    });
  });

  describe('updateContratoAction', () => {
    it('actualiza contrato exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue(mockContrato);
      vi.mocked(prisma.contrato.update).mockResolvedValue(mockContrato);

      const result = await updateContratoAction({ contratoId: 'ct-1', estado: 'ACTIVO' });

      expect(result.success).toBe(true);
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue(null);

      const result = await updateContratoAction({ contratoId: 'ct-noexiste', estado: 'ACTIVO' });

      expect(result.success).toBe(false);
    });
  });

  describe('deleteContratoAction', () => {
    it('elimina contrato exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.findFirst).mockResolvedValue({ ...mockContrato, clienteId: 'cli-1', numeroContrato: 'CT-001' });
      vi.mocked(prisma.cliente.update).mockResolvedValue({} as any);
      vi.mocked(prisma.contrato.delete).mockResolvedValue(mockContrato);

      const result = await deleteContratoAction('ct-1');
      expect(result.success).toBe(true);
    });
  });

  describe('bulkUpdateContratoStatusAction', () => {
    it('actualiza estado masivamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.contrato.updateMany).mockResolvedValue({ count: 3 } as any);

      const result = await bulkUpdateContratoStatusAction({ ids: ['ct-1', 'ct-2', 'ct-3'], estado: 'ACTIVO' });

      expect(result.success).toBe(true);
      expect(result.data!.count).toBe(3);
    });
  });

  describe('auth requerido', () => {
    it('retorna AUTH_REQUIRED', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await getContratosAction();
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
