/**
 * @description Tests unitarios para Server Actions de notificaciones.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock('@/lib/notificaciones-utils', () => ({ verificarStockBajo: vi.fn() }));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { verificarStockBajo } from '@/lib/notificaciones-utils';
import {
  getNotificacionesAction,
  createNotificacionAction,
  marcarNotificacionLeidaAction,
  updateNotificacionAction,
  deleteNotificacionAction,
  verificarStockAction,
} from '@/features/notificaciones/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'admin',
};

describe('Notificaciones Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getNotificacionesAction', () => {
    it('retorna lista con resumen', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.notification.findMany).mockResolvedValue([
        { id: 'n-1', prioridad: 'alta', isRead: false } as any,
        { id: 'n-2', prioridad: 'media', isRead: true } as any,
      ]);
      const result = await getNotificacionesAction();
      expect(result.success).toBe(true);
      expect(result.data!.resumen.total).toBe(2);
      expect(result.data!.resumen.noLeidas).toBe(1);
    });
  });

  describe('createNotificacionAction', () => {
    it('crea notificación como admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'n-1' } as any);
      const result = await createNotificacionAction({ title: 'Test', message: 'Test msg' });
      expect(result.success).toBe(true);
    });

    it('rechaza si no es admin', async () => {
      const user = { ...mockUser, role: 'user' as const };
      vi.mocked(getCurrentUser).mockResolvedValue(user);
      const result = await createNotificacionAction({ title: 'Test', message: 'Test msg' });
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('FORBIDDEN');
    });
  });

  describe('marcarNotificacionLeidaAction', () => {
    it('marca como leída', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.notification.update).mockResolvedValue({} as any);
      const result = await marcarNotificacionLeidaAction('n-1');
      expect(result.success).toBe(true);
    });
  });

  describe('updateNotificacionAction', () => {
    it('actualiza notificación', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.notification.update).mockResolvedValue({} as any);
      const result = await updateNotificacionAction({ id: 'n-1', isRead: true });
      expect(result.success).toBe(true);
    });
  });

  describe('deleteNotificacionAction', () => {
    it('elimina notificación', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.notification.delete).mockResolvedValue({} as any);
      const result = await deleteNotificacionAction('n-1');
      expect(result.success).toBe(true);
    });
  });

  describe('verificarStockAction', () => {
    it('verifica stock bajo como admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(verificarStockBajo).mockResolvedValue({ stockBajo: 3, sinStock: 1 } as any);
      const result = await verificarStockAction();
      expect(result.success).toBe(true);
    });

    it('rechaza si no es admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...mockUser, role: 'user' });
      const result = await verificarStockAction();
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('FORBIDDEN');
    });
  });

  describe('auth requerido', () => {
    it('retorna AUTH_REQUIRED', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await getNotificacionesAction();
      expect(result.success).toBe(false);
    });
  });
});
