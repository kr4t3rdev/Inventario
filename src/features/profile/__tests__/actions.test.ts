/**
 * @description Tests unitarios para Server Actions de perfil.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getProfileAction, updateProfileAction } from '@/features/profile/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Test User',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-test',
  tenantRole: 'admin',
};

const mockProfileRow = {
  userId: 'user-1',
  name: 'Test User',
  email: 'test@test.com',
  role: 'admin',
  avatar: null,
  isActive: true,
  activatedAt: new Date('2025-01-01'),
  expiresAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('Profile Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getProfileAction', () => {
    it('retorna perfil del usuario autenticado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockProfileRow);

      const result = await getProfileAction();

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Test User');
    });

    it('retorna NOT_FOUND si no hay perfil', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await getProfileAction();

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  describe('updateProfileAction', () => {
    it('actualiza perfil exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockProfileRow, name: 'Nuevo Nombre' });

      const result = await updateProfileAction({ name: 'Nuevo Nombre' });

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Nuevo Nombre');
    });

    it('retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await updateProfileAction({ name: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
