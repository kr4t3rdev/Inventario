/**
 * @description Tests unitarios para Server Actions de clientes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getClientesAction,
  getClienteByIdAction,
  createClienteAction,
  updateClienteAction,
  deleteClienteAction,
} from '@/features/clientes/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-test-1',
  name: 'Test',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-test',
  tenantRole: 'admin',
};

const mockClienteRow = {
  clienteId: 'cli-1',
  nombre: 'Cliente Test',
  direccion: 'Calle 123',
  telefono: '555-1234',
  numeroCuentaCUP: null,
  numeroCuentaUSD: null,
  numeroContrato: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('Clientes Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getClientesAction', () => {
    it('retorna lista de clientes del tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findMany).mockResolvedValue([mockClienteRow]);
      const result = await getClientesAction();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('retorna lista vacía si no hay clientes', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findMany).mockResolvedValue([]);
      const result = await getClientesAction();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getClienteByIdAction', () => {
    it('retorna cliente por ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue(mockClienteRow);
      const result = await getClienteByIdAction('cli-1');
      expect(result.success).toBe(true);
      expect(result.data!.nombre).toBe('Cliente Test');
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);
      const result = await getClienteByIdAction('cli-noexiste');
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  describe('createClienteAction', () => {
    it('crea cliente exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.create).mockResolvedValue(mockClienteRow);
      const result = await createClienteAction({ nombre: 'Cliente Test', direccion: 'Calle 123', telefono: '555-1234' });
      expect(result.success).toBe(true);
    });

    it('retorna error si el nombre está vacío', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      const result = await createClienteAction({ nombre: '' });
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('updateClienteAction', () => {
    it('actualiza cliente exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue(mockClienteRow);
      vi.mocked(prisma.cliente.update).mockResolvedValue(mockClienteRow);
      const result = await updateClienteAction({ clienteId: 'cli-1', nombre: 'Actualizado' });
      expect(result.success).toBe(true);
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);
      const result = await updateClienteAction({ clienteId: 'cli-noexiste', nombre: 'Test' });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('no encontrado');
    });
  });

  describe('deleteClienteAction', () => {
    it('elimina cliente exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue(mockClienteRow);
      vi.mocked(prisma.cliente.delete).mockResolvedValue(mockClienteRow);
      const result = await deleteClienteAction('cli-1');
      expect(result.success).toBe(true);
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);
      const result = await deleteClienteAction('cli-noexiste');
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('no encontrado');
    });
  });

  describe('auth requerido', () => {
    it('retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await getClientesAction();
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('plan feature enforcement', () => {
    it('retorna FEATURE_NOT_AVAILABLE cuando el plan no incluye clientes', async () => {
      const restrictedUser: AuthenticatedUser = {
        ...mockUser,
        role: 'user',
        tenantRole: 'manager',
        planFeatures: { clientes: false },
      };
      vi.mocked(getCurrentUser).mockResolvedValue(restrictedUser);
      const result = await getClientesAction();
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('FEATURE_NOT_AVAILABLE');
    });
  });
});
