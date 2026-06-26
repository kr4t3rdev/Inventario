/**
 * @description Tests unitarios para Server Actions de admin.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed'), compare: vi.fn() } }));
vi.mock('@/lib/email', () => ({ sendEmailVerificationLink: vi.fn() }));
vi.mock('@/lib/cloudinary', () => ({ destroyCloudinaryAsset: vi.fn() }));
vi.mock('@/lib/services/demo-tenant-factory', () => ({
  createDemoTenantForPlan: vi.fn(),
}));
vi.mock('@/lib/services/demo-seed', () => ({
  seedDemoTenantData: vi.fn(),
}));
vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    $transaction: vi.fn((cb: any) => cb({
      tenant: { create: vi.fn().mockResolvedValue({ tenantId: 'tenant-new' }) },
      tenantMembership: { create: vi.fn().mockResolvedValue({ membershipId: 'mem-new' }) },
      tenantLicense: { create: vi.fn().mockResolvedValue({ tenantLicenseId: 'lic-new', expiracion: new Date(Date.now() + 365 * 86400000) }) },
      user: { update: vi.fn().mockResolvedValue({}) },
    })),
    user: {
      findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(),
      update: vi.fn(), delete: vi.fn(), count: vi.fn(),
      groupBy: vi.fn(),
    },
    tenant: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    tenantMembership: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    moneda: { upsert: vi.fn() },
    plan: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    userSession: { count: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
    cloudinaryAsset: { groupBy: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    tenantLicense: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };

  return {
    prisma: prismaMock,
    default: prismaMock,
  };
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { destroyCloudinaryAsset } from '@/lib/cloudinary';
import { createDemoTenantForPlan } from '@/lib/services/demo-tenant-factory';
import { seedDemoTenantData } from '@/lib/services/demo-seed';
import { prisma } from '@/lib/prisma';
import {
  getUsersAction, createUserAction, updateUserAction, deleteUserAction,
  lockUserAction, unlockUserAction,
  getGlobalUsersAction,
  getAdminTenantsAction, getAdminSystemHealthAction,
  getAdminPlanesAction, createAdminPlanAction, approveGlobalUserAction, createDemoTenantAction,
  cleanupExpiredDemoLicenciasAction,
  getCloudinaryAssetsAction, cleanupCloudinaryAssetsAction,
  getLicenciasAction, updateLicenciaAction, deleteLicenciaAction,
} from '@/features/admin/actions';
import { createTenantForUser } from '@/lib/services/tenant-factory';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const adminUser: AuthenticatedUser = {
  userId: 'user-admin', name: 'Admin', email: 'admin@test.com',
  role: 'admin', isActive: true, tenantId: 't1', tenantRole: 'admin',
};

const nonAdmin: AuthenticatedUser = {
  userId: 'user-reg', name: 'User', email: 'user@test.com',
  role: 'user', isActive: true, tenantId: 't1', tenantRole: 'user',
};

const managerUser: AuthenticatedUser = {
  userId: 'user-manager', name: 'Manager', email: 'manager@test.com',
  role: 'user', isActive: true, tenantId: 'tenant-A', tenantRole: 'manager',
};

describe('Admin Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getGlobalUsersAction', () => {
    it('manager: rechaza cuando input.tenantId !== user.tenantId (cross-tenant leak)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
      const r = await getGlobalUsersAction({ tenantId: 'tenant-B' });
      expect(r.success).toBe(false);
      expect(r.error!.code).toBe('FORBIDDEN');
      expect(prisma.tenantMembership.findMany).not.toHaveBeenCalled();
    });

    it('manager: sin input.tenantId, query usa su propio tenantId', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
      vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([]);
      const r = await getGlobalUsersAction({ limit: 50 });
      expect(r.success).toBe(true);
      expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-A' }) }),
      );
    });

    it('manager: con input.tenantId igual al suyo, query usa su propio tenantId', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
      vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([]);
      const r = await getGlobalUsersAction({ tenantId: 'tenant-A' });
      expect(r.success).toBe(true);
      expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-A' }) }),
      );
    });

    it('admin: input.tenantId arbitrario se respeta (modo plataforma)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([]);
      const r = await getGlobalUsersAction({ tenantId: 'tenant-otro' });
      expect(r.success).toBe(true);
      expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-otro' }) }),
      );
    });

    it('non-admin (no manager): rechazado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(nonAdmin);
      const r = await getGlobalUsersAction();
      expect(r.success).toBe(false);
      expect(r.error!.code).toBe('FORBIDDEN');
    });
  });

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
    it('retorna mÃ©tricas', async () => {
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
    it('retorna planes con billingCycle', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.plan.findMany).mockResolvedValue([
        { planId: 'p1', nombre: 'BÃ¡sico', precio: 30, duracionDias: 30 },
      ] as any);
      const r = await getAdminPlanesAction();
      expect(r.success).toBe(true);
      if (r.success && r.data) {
        expect(Array.isArray(r.data)).toBe(true);
      }
    });
  });

  describe('Cloudinary admin actions', () => {
    it('lista assets y resume estados', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.cloudinaryAsset.groupBy).mockResolvedValue([
        { status: 'active', _count: { status: 2 } },
        { status: 'replaced', _count: { status: 3 } },
      ] as any);
      vi.mocked(prisma.cloudinaryAsset.findMany).mockResolvedValue([
        { assetId: 'a1', publicId: 'tenant-1/productos/a1', status: 'replaced' },
      ] as any);

      const r = await getCloudinaryAssetsAction({ status: 'replaced', limit: 10 });
      expect(r.success).toBe(true);
      if (r.success && r.data) {
        expect((r.data as any).summary.replaced).toBe(3);
        expect(Array.isArray((r.data as any).assets)).toBe(true);
      }
      expect(prisma.cloudinaryAsset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'replaced',
          }),
        })
      );
    });

    it('aplica filtros finos por tenant, owner y slot', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.cloudinaryAsset.groupBy).mockResolvedValue([] as any);
      vi.mocked(prisma.cloudinaryAsset.findMany).mockResolvedValue([] as any);

      const r = await getCloudinaryAssetsAction({
        status: 'active',
        tenantId: 'tenant-1',
        ownerType: 'producto',
        ownerId: 'product-1',
        slot: 'photo',
        limit: 10,
      });

      expect(r.success).toBe(true);
      expect(prisma.cloudinaryAsset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
            tenantId: 'tenant-1',
            ownerType: 'producto',
            ownerId: 'product-1',
            slot: 'photo',
          }),
        })
      );
    });

    it('dry run de cleanup no elimina remoto', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.cloudinaryAsset.findMany).mockResolvedValue([
        { assetId: 'a1', publicId: 'tenant-1/productos/a1', status: 'replaced', updatedAt: new Date(), createdAt: new Date() },
      ] as any);

      const r = await cleanupCloudinaryAssetsAction({ mode: 'stale', dryRun: true, olderThanDays: 0, limit: 10 });
      expect(r.success).toBe(true);
      expect(destroyCloudinaryAsset).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('cleanup remoto marca asset como deleted cuando Cloudinary responde ok', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.cloudinaryAsset.findMany).mockResolvedValue([
        {
          assetId: 'a1',
          publicId: 'tenant-1/productos/a1',
          resourceType: 'image',
          status: 'replaced',
          updatedAt: new Date(),
          createdAt: new Date(),
        },
      ] as any);
      vi.mocked(destroyCloudinaryAsset).mockResolvedValue({ result: 'ok' });
      vi.mocked(prisma.cloudinaryAsset.update).mockResolvedValue({} as any);

      const r = await cleanupCloudinaryAssetsAction({ mode: 'selected', assetIds: ['a1'], dryRun: false, limit: 10 });
      expect(r.success).toBe(true);
      expect(destroyCloudinaryAsset).toHaveBeenCalledWith({
        publicId: 'tenant-1/productos/a1',
        resourceType: 'image',
      });
      expect(prisma.cloudinaryAsset.update).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('cleanup stale respeta tenant, owner y slot', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.cloudinaryAsset.findMany).mockResolvedValue([] as any);

      const r = await cleanupCloudinaryAssetsAction({
        mode: 'stale',
        dryRun: true,
        olderThanDays: 30,
        tenantId: 'tenant-1',
        ownerType: 'producto',
        ownerId: 'product-9',
        slot: 'photo',
        limit: 25,
      });

      expect(r.success).toBe(true);
      expect(prisma.cloudinaryAsset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            ownerType: 'producto',
            ownerId: 'product-9',
            slot: 'photo',
            status: 'replaced',
          }),
        })
      );
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
    it('company user -> crea tenant completo', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-company',
        name: 'Empresa Demo',
        email: 'empresa@test.com',
        onboardingStatus: 'awaiting_global_approval',
        onboardingType: 'company',
      } as any);
      vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.plan.findUnique).mockResolvedValue({
        planId: 'plan-basico',
        nombre: 'B\u00e1sico',
        precio: 30,
        maxUsuarios: 3,
        maxAlmacenes: 2,
        maxProductos: 500,
        features: {},
      } as any);
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null); // slug libre

      const r = await approveGlobalUserAction({
        userId: 'user-company',
        tenantName: 'Mi Empresa SRL',
        planId: 'plan-basico',
      });

      expect(r.success).toBe(true);
      if (r.success && r.data) {
        const data = r.data as any;
        expect(data.tenantCreated).toBe(true);
        expect(data.tenantId).toBe('tenant-new');
        expect(data.membershipId).toBe('mem-new');
      }
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('worker user -> legacy activation (solo activar)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-worker',
        name: 'Worker',
        email: 'worker@test.com',
        onboardingStatus: 'awaiting_manager_approval',
        onboardingType: 'worker',
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      const r = await approveGlobalUserAction({ userId: 'user-worker' });

      expect(r.success).toBe(true);
      if (r.success && r.data) {
        expect((r.data as any).tenantCreated).toBe(false);
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('non-admin rechazado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(nonAdmin);
      const r = await approveGlobalUserAction({ userId: 'user-company' });
      expect(r.success).toBe(false);
      expect(r.error!.code).toBe('FORBIDDEN');
    });
  });

  describe('createDemoTenantAction', () => {
    it('admin crea demo y dispara el seed parametrizado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(createDemoTenantForPlan).mockResolvedValue({
        tenantId: 'tenant-demo-1',
        membershipId: 'membership-demo-1',
        licenseId: 'license-demo-1',
        userId: 'user-demo-1',
        email: 'demo@example.com',
        password: 'Demo-123456',
        expiresAt: new Date('2026-07-02T10:00:00.000Z'),
        planName: 'Profesional',
        isDemo: true,
      } as any);
      vi.mocked(seedDemoTenantData).mockResolvedValue({
        tenantId: 'tenant-demo-1',
        planName: 'Profesional',
        profile: 'professional',
      } as any);

      const r = await createDemoTenantAction({
        planId: 'plan-pro',
        demoName: 'Demo Profesional',
        durationDays: 6,
      });

      expect(r.success).toBe(true);
      expect(createDemoTenantForPlan).toHaveBeenCalledWith({
        planId: 'plan-pro',
        demoName: 'Demo Profesional',
        durationDays: 6,
        createdBy: 'user-admin',
      });
      expect(seedDemoTenantData).toHaveBeenCalledWith({
        tenantId: 'tenant-demo-1',
        planName: 'Profesional',
      });
    });

    it('non-admin rechazado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(nonAdmin);
      const r = await createDemoTenantAction({
        planId: 'plan-pro',
      });
      expect(r.success).toBe(false);
      expect(r.error!.code).toBe('FORBIDDEN');
    });
  });

  describe('tenant license admin actions', () => {
    it('getLicenciasAction incluye demos y manager del tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.tenantLicense.findMany).mockResolvedValue([
        {
          tenantLicenseId: 'lic-demo',
          isDemo: true,
          tenant: {
            tenantId: 'tenant-demo',
            memberships: [
              {
                user: {
                  userId: 'user-demo',
                  name: 'Demo User',
                  email: 'demo@test.com',
                },
              },
            ],
          },
        },
      ] as any);

      const r = await getLicenciasAction();

      expect(r.success).toBe(true);
      expect(prisma.tenantLicense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          include: expect.objectContaining({
            plan: true,
            tenant: expect.objectContaining({
              include: expect.objectContaining({
                memberships: expect.objectContaining({
                  where: { isActive: true, tenantRole: 'manager' },
                  take: 1,
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('updateLicenciaAction usa tenantLicenseId', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.tenantLicense.update).mockResolvedValue({
        tenantLicenseId: 'lic-1',
      } as any);

      const r = await updateLicenciaAction({ id: 'lic-1', activa: false });

      expect(r.success).toBe(true);
      expect(prisma.tenantLicense.update).toHaveBeenCalledWith({
        where: { tenantLicenseId: 'lic-1' },
        data: { activa: false },
      });
    });

    it('deleteLicenciaAction usa tenantLicenseId', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.tenantLicense.delete).mockResolvedValue({
        tenantLicenseId: 'lic-1',
      } as any);

      const r = await deleteLicenciaAction('lic-1');

      expect(r.success).toBe(true);
      expect(prisma.tenantLicense.delete).toHaveBeenCalledWith({
        where: { tenantLicenseId: 'lic-1' },
      });
    });

    it('cleanupExpiredDemoLicenciasAction desactiva solo demos expiradas activas', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.tenantLicense.findMany).mockResolvedValue([
        {
          tenantLicenseId: 'lic-exp-1',
          tenantId: 'tenant-1',
          expiracion: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          tenantLicenseId: 'lic-exp-2',
          tenantId: 'tenant-2',
          expiracion: new Date('2026-01-02T00:00:00.000Z'),
        },
      ] as any);
      vi.mocked(prisma.tenantLicense.updateMany).mockResolvedValue({ count: 2 } as any);

      const r = await cleanupExpiredDemoLicenciasAction({});

      expect(r.success).toBe(true);
      expect(prisma.tenantLicense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isDemo: true,
            activa: true,
            expiracion: expect.any(Object),
          }),
          select: {
            tenantLicenseId: true,
            tenantId: true,
            expiracion: true,
          },
        }),
      );
      expect(prisma.tenantLicense.updateMany).toHaveBeenCalledWith({
        where: {
          tenantLicenseId: {
            in: ['lic-exp-1', 'lic-exp-2'],
          },
        },
        data: { activa: false },
      });
      expect(r.data).toEqual(
        expect.objectContaining({
          dryRun: false,
          count: 2,
        }),
      );
    });
  });

  describe('createTenantForUser', () => {
    it('llama a $transaction con los datos del plan', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-test',
        name: 'Test User',
        onboardingStatus: 'awaiting_global_approval',
      } as any);
      vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.plan.findUnique).mockResolvedValue({
        planId: 'plan-basico',
        nombre: 'B\u00e1sico',
        precio: 30,
        maxUsuarios: 3,
        maxAlmacenes: 2,
        maxProductos: 500,
        features: {},
      } as any);

      await createTenantForUser({
        userId: 'user-test',
        planId: 'plan-basico',
        tenantName: 'Test Corp',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('error si onboardingStatus incorrecto', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-test',
        name: 'Test',
        onboardingStatus: 'selecting_user_type',
      } as any);

      await expect(createTenantForUser({ userId: 'user-test' }))
        .rejects.toThrow('El usuario no est');
    });

    it('error si ya tiene membership activa', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-test',
        name: 'Test',
        onboardingStatus: 'awaiting_global_approval',
      } as any);
      vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
        membershipId: 'existing',
        isActive: true,
      } as any);

      await expect(createTenantForUser({ userId: 'user-test' }))
        .rejects.toThrow('ya tiene una empresa activa');
    });

    it('error si plan no encontrado', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-test',
        name: 'Test',
        onboardingStatus: 'awaiting_global_approval',
      } as any);
      vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.plan.findUnique).mockResolvedValue(null);

      await expect(createTenantForUser({ userId: 'user-test', planId: 'x' }))
        .rejects.toThrow('Plan no encontrado');
    });
  });
});
