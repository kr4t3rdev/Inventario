/**
 * @description Tests unitarios para Server Actions de admin.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed'), compare: vi.fn() } }));
vi.mock('@/lib/email', () => ({ sendEmailVerificationLink: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(),
      update: vi.fn(), delete: vi.fn(), count: vi.fn(),
      groupBy: vi.fn(),
    },
    tenant: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    tenantMembership: { create: vi.fn() },
    moneda: { upsert: vi.fn() },
    plan: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    userSession: { count: vi.fn() },
    tenantLicense: { count: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getUsersAction, createUserAction, updateUserAction, deleteUserAction,
  lockUserAction, unlockUserAction,
  getAdminTenantsAction, getAdminSystemHealthAction,
  getAdminPlanesAction, createAdminPlanAction, approveGlobalUserAction,
} from '@/features/admin/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const adminUser: AuthenticatedUser = {
  userId: 'user-admin', name: 'Admin', email: 'admin@test.com',
  role: 'admin', isActive: true, tenantId: 't1', tenantRole: 'admin',
};

const nonAdmin: AuthenticatedUser = {
  userId: 'user-reg', name: 'User', email: 'user@test.com',
  role: 'user', isActive: true, tenantId: 't1', tenantRole: 'user',
};

describe('Admin Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getUsersAction', () => {
    it('admin puede listar usuarios', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      const r = await getUsersAction();
      expect(r.success).toBe(true);
    });

    it('no-admin rechazado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(nonAdmin);
      const r = await getUsersAction();
      expect(r.success).toBe(false);
      expect(r.error!.code).toBe('FORBIDDEN');
    });
  });

  describe('createUserAction', () => {
    it('admin crea usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.create).mockResolvedValue({ userId: 'u1' } as any);
      const r = await createUserAction({ name: 'Test', email: 't@t.com', password: '123456', role: 'user' });
      expect(r.success).toBe(true);
    });
  });

  describe('deleteUserAction', () => {
    it('admin elimina usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ userId: 'u1' });
      vi.mocked(prisma.user.delete).mockResolvedValue({} as any);
      const r = await deleteUserAction('u1');
      expect(r.success).toBe(true);
    });
  });

  describe('lockUserAction', () => {
    it('bloquea usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ userId: 'u1' });
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      const r = await lockUserAction({ userId: 'u1' });
      expect(r.success).toBe(true);
    });
  });

  describe('unlockUserAction', () => {
    it('desbloquea usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ userId: 'u1' });
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      const r = await unlockUserAction({ userId: 'u1' });
      expect(r.success).toBe(true);
    });
  });

  describe('getAdminTenantsAction', () => {
    it('retorna tenants', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.tenant.findMany).mockResolvedValue([]);
      const r = await getAdminTenantsAction();
      expect(r.success).toBe(true);
    });
  });

  describe('getAdminSystemHealthAction', () => {
    it('retorna métricas', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.count).mockResolvedValue(5);
      vi.mocked(prisma.tenant.count).mockResolvedValue(2);
      vi.mocked(prisma.userSession.count).mockResolvedValue(10);
      vi.mocked(prisma.tenantLicense.count).mockResolvedValue(3);
      vi.mocked(prisma.user.groupBy).mockResolvedValue([]);
      const r = await getAdminSystemHealthAction();
      expect(r.success).toBe(true);
    });
  });

  describe('getAdminPlanesAction', () => {
    it('retorna planes', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.plan.findMany).mockResolvedValue([]);
      const r = await getAdminPlanesAction();
      expect(r.success).toBe(true);
    });
  });

  describe('createAdminPlanAction', () => {
    it('crea plan', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.plan.create).mockResolvedValue({ planId: 'plan-1' } as any);
      const r = await createAdminPlanAction({
        nombre: 'Plan Basic',
        duracionDias: 30,
        maxUsuarios: 5,
        maxAlmacenes: 3,
        maxProductos: 100,
        maxPuntosVenta: 1,
        features: {},
      });
      expect(r.success).toBe(true);
    });
  });

  describe('approveGlobalUserAction', () => {
    it('activa al usuario y lo marca como aprobado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-company',
        name: 'Empresa Demo',
        email: 'empresa@test.com',
        onboardingStatus: 'awaiting_global_approval',
        onboardingType: 'company',
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({ userId: 'user-company', isActive: true } as any);

      const r = await approveGlobalUserAction({ userId: 'user-company' });

      expect(r.success).toBe(true);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-company' } });
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });
});
