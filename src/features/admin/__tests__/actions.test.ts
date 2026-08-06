/**
 * @description Tests unitarios para Server Actions de admin.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed'), compare: vi.fn() } }));
vi.mock('@/lib/email', () => ({ sendEmailVerificationLink: vi.fn() }));
vi.mock('@/features/sales-agent/services/notification-service', () => ({
  createSalesAgentEvent: vi.fn().mockResolvedValue('delivery-approval'),
  deliverSalesAgentEmails: vi.fn().mockResolvedValue(undefined),
}));
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
      affiliateReferral: prismaMock.affiliateReferral,
      salesAgentReferral: prismaMock.salesAgentReferral,
    })),
    user: {
      findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(),
      update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(),
      count: vi.fn(), groupBy: vi.fn(),
    },
    tenant: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    tenantMembership: {
      create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(),
      findMany: vi.fn(), count: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(),
    },
    moneda: { upsert: vi.fn() },
    plan: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    affiliateProfile: { findUnique: vi.fn() },
    affiliateReferral: { findUnique: vi.fn(), create: vi.fn() },
    salesAgentReferral: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
    salesAgentProfile: { findUnique: vi.fn(), updateMany: vi.fn() },
    salesAgentBalance: { upsert: vi.fn() },
    userSession: { count: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
    venta: { aggregate: vi.fn(), findMany: vi.fn() },
    ventaServicios: { aggregate: vi.fn(), findMany: vi.fn() },
    gastosDE: { aggregate: vi.fn() },
    cuentaPorCobrar: { aggregate: vi.fn() },
    cuentaPorPagar: { aggregate: vi.fn() },
    cloudinaryAsset: { groupBy: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    empleado: { findFirst: vi.fn(), create: vi.fn() },
    tenantLicense: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
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
import {
  createSalesAgentEvent,
  deliverSalesAgentEmails,
} from '@/features/sales-agent/services/notification-service';
import { destroyCloudinaryAsset } from '@/lib/cloudinary';
import { createDemoTenantForPlan } from '@/lib/services/demo-tenant-factory';
import { seedDemoTenantData } from '@/lib/services/demo-seed';
import { prisma } from '@/lib/prisma';
import { AuditLogService } from '@/lib/services/audit-log-service';
import {
  getUsersAction, createUserAction, updateUserAction, deleteUserAction,
  lockUserAction, unlockUserAction,
  getGlobalUsersAction,
  getAdminTenantsAction, getAdminSystemHealthAction, getAdminFinanceAction,
  getAdminPlanesAction, createAdminPlanAction, approveGlobalUserAction, createDemoTenantAction,
  cleanupExpiredDemoLicenciasAction,
  getCloudinaryAssetsAction, cleanupCloudinaryAssetsAction,
  getLicenciasAction, changePlanAction, updateLicenciaAction, updateLicenseAccountingOverridesAction, deleteLicenciaAction, convertDemoToPaidPlanAction,
  getAdminSubscriptionRevenueAction,
  getPendingMembershipsAction, approveMembershipAction, rejectMembershipAction,
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

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

describe('Admin Server Actions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    it('admin global refresh selects and maps the complete sales-agent DTO', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...adminUser, tenantId: null });
      vi.mocked(prisma.user.findMany).mockResolvedValue([{
        userId: 'agent-1',
        name: 'Ana',
        email: 'ana@test.com',
        role: 'salesAgent',
        isActive: true,
        onboardingType: null,
        onboardingStatus: null,
        createdAt: new Date('2026-07-27'),
        expiresAt: null,
        lockedUntil: null,
        avatar: null,
        tenantMemberships: [],
        _count: { tenantMemberships: 0 },
        salesAgentProfile: { phone: '+53 5555', status: 'active' },
        salesAgentBalance: { availableUsd: 25, paidUsd: 10 },
        salesAgentReferrals: [{ salesAgentReferralId: 'ref-1' }],
      }] as never);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      const result = await getGlobalUsersAction();

      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        select: expect.objectContaining({
          salesAgentProfile: { select: { phone: true, status: true } },
          salesAgentBalance: { select: { availableUsd: true, paidUsd: true } },
          salesAgentReferrals: expect.objectContaining({
            where: { status: 'attributed' },
          }),
        }),
      }));
      expect(result).toMatchObject({
        success: true,
        data: {
          users: [{
            salesAgentProfile: { phone: '+53 5555', status: 'active' },
            salesAgentBalance: { availableUsd: 25, paidUsd: 10 },
            activeReferralCount: 1,
          }],
        },
      });
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

  describe('changePlanAction', () => {
    it('sincroniza todos los limites, hereda features y registra auditoria', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.tenantLicense.findUnique).mockResolvedValue({
        tenantLicenseId: 'lic-1',
        tenantId: 'tenant-1',
        planId: 'plan-basic',
      } as any);
      vi.mocked(prisma.plan.findUnique).mockResolvedValue({
        planId: 'plan-pro',
        nombre: 'Professional',
        precio: 80,
        maxUsuarios: 12,
        maxAlmacenes: 5,
        maxProductos: 2500,
        maxClientes: 800,
        features: { reportes: true },
      } as any);
      vi.mocked(prisma.tenantLicense.update).mockResolvedValue({
        tenantLicenseId: 'lic-1',
        planId: 'plan-pro',
      } as any);
      const auditSpy = vi.spyOn(AuditLogService, 'log').mockResolvedValue({} as any);

      const result = await changePlanAction({
        tenantLicenseId: 'lic-1',
        planId: 'plan-pro',
      });

      expect(result.success).toBe(true);
      expect(prisma.tenantLicense.update).toHaveBeenCalledWith({
        where: { tenantLicenseId: 'lic-1' },
        data: {
          planId: 'plan-pro',
          maxUsuarios: 12,
          maxAlmacenes: 5,
          maxProductos: 2500,
          maxClientes: 800,
          features: Prisma.JsonNull,
          featureOverrides: {},
          listPriceUsd: 80,
          finalPriceUsd: 80,
        },
      });
      expect(auditSpy).toHaveBeenCalledWith({
        accion: 'UPDATE',
        entidad: 'TENANT_LICENSE',
        entidadId: 'lic-1',
        usuarioId: 'user-admin',
        detalles: {
          tenantId: 'tenant-1',
          previousPlanId: 'plan-basic',
          newPlanId: 'plan-pro',
        },
      });
      expect(prisma.tenantLicense.update.mock.invocationCallOrder[0]).toBeLessThan(
        auditSpy.mock.invocationCallOrder[0],
      );
    });

    it('rechaza usuarios no administradores', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(nonAdmin);

      const result = await changePlanAction({
        tenantLicenseId: 'lic-1',
        planId: 'plan-pro',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FORBIDDEN');
      expect(prisma.tenantLicense.findUnique).not.toHaveBeenCalled();
    });

    it('retorna NOT_FOUND cuando la licencia no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.tenantLicense.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.plan.findUnique).mockResolvedValue({ planId: 'plan-pro' } as any);

      const result = await changePlanAction({
        tenantLicenseId: 'missing-license',
        planId: 'plan-pro',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(prisma.tenantLicense.update).not.toHaveBeenCalled();
    });

    it('retorna PLAN_NOT_FOUND cuando el plan no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.tenantLicense.findUnique).mockResolvedValue({
        tenantLicenseId: 'lic-1',
      } as any);
      vi.mocked(prisma.plan.findUnique).mockResolvedValue(null);

      const result = await changePlanAction({
        tenantLicenseId: 'lic-1',
        planId: 'missing-plan',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PLAN_NOT_FOUND');
      expect(prisma.tenantLicense.update).not.toHaveBeenCalled();
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
    it('admin elimina usuario regular sin registros', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'u1',
        role: 'regularUser',
        salesAgentBalance: null,
        _count: { salesAgentReferrals: 0, salesAgentCommissions: 0, salesAgentPayouts: 0 },
      });
      const r = await deleteUserAction('u1');
      expect(r.success).toBe(true);
      expect(prisma.user.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('bloquea eliminación de gestor de ventas con registros', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'u1',
        role: 'salesAgent',
        salesAgentBalance: { salesAgentBalanceId: 'bal-1' },
        _count: { salesAgentReferrals: 1, salesAgentCommissions: 1, salesAgentPayouts: 0 },
      });
      const r = await deleteUserAction('u1');
      expect(r.success).toBe(false);
      if (r.success === false) {
        expect(r.error.code).toBe('SALES_AGENT_WITH_RECORDS');
      }
      expect(prisma.user.deleteMany).not.toHaveBeenCalled();
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
      vi.mocked(prisma.tenant.findMany).mockResolvedValue([
        {
          tenantId: 'tenant-1',
          nombre: 'Tenant Uno',
          _count: { memberships: 2, productos: 3, almacenes: 1 },
          licencias: [
            {
              planId: 'plan-1',
              plan: { nombre: 'Pro' },
            },
          ],
        },
      ] as any);
      const r = await getAdminTenantsAction();
      expect(r.success).toBe(true);
      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { licencias: { some: { isDemo: false } } },
          include: expect.objectContaining({
            licencias: expect.any(Object),
          }),
        }),
      );
      if (r.success && r.data) {
        expect(r.data[0]).toMatchObject({
          tenantId: 'tenant-1',
          totalUsers: 2,
          plan: 'Pro',
          planId: 'plan-1',
          licenseActive: true,
        });
      }
    });
  });

  describe('getAdminSystemHealthAction', () => {
    it('cuenta solo sesiones activas no expiradas', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.count).mockResolvedValue(5);
      vi.mocked(prisma.tenant.count).mockResolvedValue(2);
      vi.mocked(prisma.userSession.count).mockResolvedValue(4);
      vi.mocked(prisma.tenantLicense.count)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);
      vi.mocked(prisma.user.groupBy).mockResolvedValue([] as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { createdAt: daysAgo(2) },
        { createdAt: daysAgo(10) },
      ] as any);

      const r = await getAdminSystemHealthAction();

      expect(r.success).toBe(true);
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          tenantMemberships: {
            some: {
              tenant: { licencias: { some: { isDemo: false } } },
            },
          },
        },
      });
      expect(prisma.tenant.count).toHaveBeenCalledWith({
        where: { licencias: { some: { isDemo: false } } },
      });
      expect(prisma.userSession.count).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: expect.any(Date) } },
          ],
          user: {
            tenantMemberships: {
              some: {
                tenant: { licencias: { some: { isDemo: false } } },
              },
            },
          },
        },
      });
      expect(prisma.user.groupBy).toHaveBeenCalledWith({
        by: ['role'],
        where: {
          tenantMemberships: {
            some: {
              tenant: { licencias: { some: { isDemo: false } } },
            },
          },
        },
        _count: true,
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: expect.any(Date) },
          tenantMemberships: {
            some: {
              tenant: { licencias: { some: { isDemo: false } } },
            },
          },
        },
        select: {
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 10000,
      });
      if (r.success && r.data) {
        expect(r.data.usersComparison).toEqual({
          current7DaysUsers: 1,
          previous7DaysUsers: 1,
        });
      }
    });
  });

  describe('getAdminFinanceAction', () => {
    it('excluye ventas soft-deleted del total de ingresos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.venta.aggregate).mockResolvedValue({ _count: 2, _sum: { total: 1500 } } as any);
      vi.mocked(prisma.ventaServicios.aggregate).mockResolvedValue({ _count: 1, _sum: { total: 500 } } as any);
      vi.mocked(prisma.gastosDE.aggregate).mockResolvedValue({ _count: 0, _sum: { monto: 0 } } as any);
      vi.mocked(prisma.cuentaPorCobrar.aggregate).mockResolvedValue({ _count: 0, _sum: { montoDeuda: 0, montoPagado: 0 } } as any);
      vi.mocked(prisma.cuentaPorPagar.aggregate).mockResolvedValue({ _count: 0, _sum: { saldoPendiente: 0 } } as any);
      vi.mocked(prisma.tenant.count).mockResolvedValue(7);
      vi.mocked(prisma.venta.findMany).mockResolvedValue([
        { createdAt: daysAgo(2), total: 1000 },
        { createdAt: daysAgo(10), total: 600 },
      ] as any);
      vi.mocked(prisma.ventaServicios.findMany).mockResolvedValue([
        { createdAt: daysAgo(3), total: 500 },
        { createdAt: daysAgo(9), total: 200 },
      ] as any);

      const r = await getAdminFinanceAction();

      expect(r.success).toBe(true);
      expect(prisma.tenant.count).toHaveBeenCalledWith({
        where: { licencias: { some: { isDemo: false } } },
      });
      expect(prisma.venta.aggregate).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          tenant: { licencias: { some: { isDemo: false } } },
        },
        _count: true,
        _sum: { total: true },
      });
      expect(prisma.ventaServicios.aggregate).toHaveBeenCalledWith({
        where: {
          tenant: { licencias: { some: { isDemo: false } } },
        },
        _count: true,
        _sum: { total: true },
      });
      expect(prisma.venta.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: expect.any(Date) },
          deletedAt: null,
          tenant: { licencias: { some: { isDemo: false } } },
        },
        select: {
          createdAt: true,
          total: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 10000,
      });
      expect(prisma.ventaServicios.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: expect.any(Date) },
          tenant: { licencias: { some: { isDemo: false } } },
        },
        select: {
          createdAt: true,
          total: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 10000,
      });
      if (r.success && r.data) {
        expect(r.data.revenueComparison).toEqual({
          current7DaysRevenue: 1500,
          previous7DaysRevenue: 800,
        });
      }
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
        duracionDias: 30,
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

    it('salesAgent -> aprueba de forma idempotente sin crear tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(createSalesAgentEvent).mockResolvedValue('delivery-approval');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-agent',
        onboardingStatus: 'awaiting_sales_agent_approval',
        onboardingType: 'salesAgent',
        role: 'salesAgent',
        isActive: true,
      } as any);
      vi.mocked(prisma.salesAgentProfile.findUnique)
        .mockResolvedValueOnce({
        userId: 'user-agent',
        referralCode: null,
        status: 'pending_approval',
        } as any)
        .mockResolvedValueOnce({
          userId: 'user-agent',
          referralCode: 'SA-ABC123',
          status: 'active',
        } as any);
      vi.mocked(prisma.salesAgentProfile.updateMany).mockResolvedValue({
        count: 1,
      } as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) =>
        callback(prisma),
      );
      const auditSpy = vi.spyOn(AuditLogService, 'logStrict').mockResolvedValue({} as any);

      const first = await approveGlobalUserAction({ userId: 'user-agent' });
      const second = await approveGlobalUserAction({ userId: 'user-agent' });

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(prisma.salesAgentProfile.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-agent', status: 'pending_approval' },
        data: expect.objectContaining({
          status: 'active',
          approvedByAdminId: 'user-admin',
          approvedAt: expect.any(Date),
          referralCode: expect.stringMatching(/^SA-/),
        }),
      });
      expect(prisma.salesAgentBalance.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-agent' },
        create: { userId: 'user-agent' },
        update: {},
      });
      expect(prisma.salesAgentProfile.updateMany).toHaveBeenCalledOnce();
      expect(prisma.salesAgentBalance.upsert).toHaveBeenCalledOnce();
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(prisma.user.update).toHaveBeenLastCalledWith({
        where: { userId: 'user-agent' },
        data: {
          role: 'salesAgent',
          isActive: true,
          onboardingStatus: null,
        },
      });
      expect(prisma.tenantMembership.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-agent' },
      });
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          entidad: 'SALES_AGENT_PROFILE',
          entidadId: 'user-agent',
          usuarioId: 'user-admin',
        }),
        prisma,
      );
      expect(createSalesAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
        tx: prisma,
        userId: 'user-agent',
        eventType: 'sales_agent_approved',
      }));
      expect(deliverSalesAgentEmails).toHaveBeenCalledWith(['delivery-approval']);
    });

    it('salesAgent -> rechaza aprobación fuera de awaiting_sales_agent_approval', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-agent',
        onboardingStatus: 'selecting_user_type',
        onboardingType: 'salesAgent',
      } as any);
      vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValue({
        referralCode: null,
        status: 'pending_approval',
      } as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) =>
        callback(prisma),
      );

      const result = await approveGlobalUserAction({ userId: 'user-agent' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_ONBOARDING_STATUS');
      expect(prisma.salesAgentProfile.updateMany).not.toHaveBeenCalled();
    });

    it('salesAgent -> replay persistido activo retorna éxito aunque onboardingStatus sea null', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-agent',
        onboardingStatus: null,
        onboardingType: 'salesAgent',
        role: 'salesAgent',
        isActive: true,
      } as any);
      vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValue({
        referralCode: 'SA-ACTIVE12345678',
        status: 'active',
      } as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) =>
        callback(prisma),
      );

      const result = await approveGlobalUserAction({ userId: 'user-agent' });

      expect(result).toMatchObject({
        success: true,
        data: {
          referralCode: 'SA-ACTIVE12345678',
          alreadyApproved: true,
        },
      });
      expect(prisma.salesAgentProfile.updateMany).not.toHaveBeenCalled();
    });

    it('salesAgent -> rechaza un perfil activo asociado a un usuario no activo del rol', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-agent',
        onboardingStatus: null,
        onboardingType: 'salesAgent',
        role: 'user',
        isActive: true,
      } as any);
      vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValue({
        referralCode: 'SA-UNRELATED12345',
        status: 'active',
      } as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) =>
        callback(prisma),
      );

      const result = await approveGlobalUserAction({ userId: 'user-agent' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_ONBOARDING_STATUS');
    });

    it('salesAgent -> reintenta P2002 con un código nuevo', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-agent',
        onboardingStatus: 'awaiting_sales_agent_approval',
        onboardingType: 'salesAgent',
      } as any);
      vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValue({
        userId: 'user-agent',
        referralCode: null,
        status: 'pending_approval',
      } as any);
      vi.mocked(prisma.salesAgentProfile.updateMany)
        .mockRejectedValueOnce({ code: 'P2002' })
        .mockResolvedValueOnce({ count: 1 } as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) =>
        callback(prisma),
      );

      const result = await approveGlobalUserAction({ userId: 'user-agent' });

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      const attemptedCodes = vi.mocked(prisma.salesAgentProfile.updateMany).mock.calls.map(
        ([input]) => input.data.referralCode,
      );
      expect(attemptedCodes).toHaveLength(2);
      expect(attemptedCodes[0]).toMatch(/^SA-[A-F0-9]{16}$/);
      expect(attemptedCodes[1]).toMatch(/^SA-[A-F0-9]{16}$/);
      expect(attemptedCodes[1]).not.toBe(attemptedCodes[0]);
    });

    it('salesAgent -> devuelve el código ganador si otra aprobación gana la carrera', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-agent',
        onboardingStatus: 'awaiting_sales_agent_approval',
        onboardingType: 'salesAgent',
      } as any);
      vi.mocked(prisma.salesAgentProfile.findUnique)
        .mockResolvedValueOnce({
          referralCode: null,
          status: 'pending_approval',
        } as any)
        .mockResolvedValueOnce({
          referralCode: 'SA-WINNER12345678',
          status: 'active',
        } as any);
      vi.mocked(prisma.salesAgentProfile.updateMany).mockResolvedValueOnce({
        count: 0,
      } as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) =>
        callback(prisma),
      );

      const result = await approveGlobalUserAction({ userId: 'user-agent' });

      expect(result).toMatchObject({
        success: true,
        data: {
          referralCode: 'SA-WINNER12345678',
          alreadyApproved: true,
        },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.salesAgentBalance.upsert).not.toHaveBeenCalled();
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
          createdBy: 'user-admin',
          createdAt: new Date('2026-06-26T12:00:00.000Z'),
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
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          userId: 'user-admin',
          name: 'Admin',
          email: 'admin@test.com',
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
      expect(r.data?.[0]).toEqual(
        expect.objectContaining({
          createdBy: 'user-admin',
          createdByUser: {
            userId: 'user-admin',
            name: 'Admin',
            email: 'admin@test.com',
          },
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

    it('updateLicenciaAction permite marcar licencias como prueba admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.tenantLicense.update).mockResolvedValue({
        tenantLicenseId: 'lic-1',
        isAdminTest: true,
      } as any);

      const r = await updateLicenciaAction({ id: 'lic-1', isAdminTest: true });

      expect(r.success).toBe(true);
      expect(prisma.tenantLicense.update).toHaveBeenCalledWith({
        where: { tenantLicenseId: 'lic-1' },
        data: { isAdminTest: true },
      });
    });

    it('updateLicenseAccountingOverridesAction mergea overrides contables preservando otros existentes', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.tenantLicense.findUnique).mockResolvedValue({
        tenantLicenseId: 'lic-1',
        featureOverrides: {
          productos: true,
          'reportes-financieros': false,
        },
      } as any);
      vi.mocked(prisma.tenantLicense.update).mockResolvedValue({
        tenantLicenseId: 'lic-1',
      } as any);

      const r = await updateLicenseAccountingOverridesAction({
        id: 'lic-1',
        featureOverrides: {
          'transferencias-bancarias': true,
          'ajustes-bancarios': true,
        },
      });

      expect(r.success).toBe(true);
      expect(prisma.tenantLicense.findUnique).toHaveBeenCalledWith({
        where: { tenantLicenseId: 'lic-1' },
        select: {
          tenantLicenseId: true,
          featureOverrides: true,
        },
      });
      expect(prisma.tenantLicense.update).toHaveBeenCalledWith({
        where: { tenantLicenseId: 'lic-1' },
        data: {
          featureOverrides: {
            productos: true,
            'reportes-financieros': false,
            'transferencias-bancarias': true,
            'ajustes-bancarios': true,
          },
        },
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

    it('convertDemoToPaidPlanAction convierte la demo sin perder el tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.tenantLicense.findUnique).mockResolvedValue({
        tenantLicenseId: 'lic-demo',
        tenantId: 'tenant-demo',
        isDemo: true,
        tenant: {
          memberships: [
            {
              userId: 'user-demo',
              isActive: true,
            },
          ],
        },
      } as any);
      vi.mocked(prisma.plan.findUnique).mockResolvedValue({
        planId: 'plan-pro',
        duracionDias: 30,
        maxUsuarios: 10,
        maxAlmacenes: 4,
        maxProductos: 1000,
        features: { empleados: true },
      } as any);
      vi.mocked(prisma.tenantLicense.update).mockResolvedValue({
        tenantLicenseId: 'lic-demo',
        tenantId: 'tenant-demo',
        isDemo: false,
        planId: 'plan-pro',
      } as any);
      vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as any);

      const r = await convertDemoToPaidPlanAction({
        tenantLicenseId: 'lic-demo',
        planId: 'plan-pro',
      });

      expect(r.success).toBe(true);
      expect(prisma.tenantLicense.findUnique).toHaveBeenCalledWith({
        where: { tenantLicenseId: 'lic-demo' },
        include: {
          tenant: {
            include: {
              memberships: {
                where: { isActive: true },
                select: { userId: true },
              },
            },
          },
        },
      });
      expect(prisma.tenantLicense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantLicenseId: 'lic-demo' },
          data: expect.objectContaining({
            isDemo: false,
            activa: true,
            planId: 'plan-pro',
            maxUsuarios: 10,
            maxAlmacenes: 4,
            maxProductos: 1000,
            features: Prisma.JsonNull,
            featureOverrides: {},
            inicio: expect.any(Date),
            expiracion: expect.any(Date),
          }),
        }),
      );
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { userId: { in: ['user-demo'] } },
        data: { expiresAt: expect.any(Date), isActive: true },
      });
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
        duracionDias: 30,
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

    it('crea AffiliateReferral cuando el usuario tenía pendingReferralCode válido', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        userId: 'user-test',
        name: 'Test User',
        onboardingStatus: 'awaiting_global_approval',
        pendingReferralCode: 'REF-VALID',
      } as any);
      vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.plan.findUnique).mockResolvedValue({
        planId: 'plan-basico',
        nombre: 'Básico',
        precio: 35,
        duracionDias: 30,
        maxUsuarios: 3,
        maxAlmacenes: 2,
        maxProductos: 500,
        maxClientes: 100,
        features: {},
      } as any);
      vi.mocked(prisma.affiliateProfile.findUnique).mockResolvedValue({
        tenantId: 'tenant-referrer',
        isEligible: true,
        status: 'active',
      } as any);
      vi.mocked(prisma.affiliateReferral.findUnique).mockResolvedValue(null as any);

      await createTenantForUser({
        userId: 'user-test',
        planId: 'plan-basico',
        tenantName: 'Test Corp',
      });

      expect(prisma.affiliateReferral.create).toHaveBeenCalledWith({
        data: {
          referrerTenantId: 'tenant-referrer',
          referredTenantId: 'tenant-new',
          referredPlanId: 'plan-basico',
          status: 'registered',
        },
      });
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

  describe('getAdminSubscriptionRevenueAction', () => {
    it('excluye licencias marcadas como prueba admin de los KPIs de revenue', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);

      const licenses = [
        {
          tenantLicenseId: 'lic-real',
          activa: true,
          isDemo: false,
          isAdminTest: false,
          inicio: new Date('2026-06-01T00:00:00.000Z'),
          expiracion: new Date('2026-07-31T00:00:00.000Z'),
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
          updatedAt: new Date('2026-06-15T00:00:00.000Z'),
          planId: 'plan-pro',
          plan: {
            planId: 'plan-pro',
            nombre: 'Profesional',
            precio: 60,
            duracionDias: 30,
          },
          tenant: {
            tenantId: 'tenant-real',
            nombre: 'Tenant Real',
          },
        },
        {
          tenantLicenseId: 'lic-admin-test',
          activa: true,
          isDemo: false,
          isAdminTest: true,
          inicio: new Date('2026-06-01T00:00:00.000Z'),
          expiracion: new Date('2026-07-31T00:00:00.000Z'),
          createdAt: new Date('2026-06-02T00:00:00.000Z'),
          updatedAt: new Date('2026-06-16T00:00:00.000Z'),
          planId: 'plan-pro',
          plan: {
            planId: 'plan-pro',
            nombre: 'Profesional',
            precio: 60,
            duracionDias: 30,
          },
          tenant: {
            tenantId: 'tenant-test',
            nombre: 'Tenant Test',
          },
        },
      ] as any[];

      vi.mocked(prisma.tenantLicense.findMany).mockImplementation(async (args: any) => {
        expect(args.where).toEqual(
          expect.objectContaining({
            isDemo: false,
            isAdminTest: false,
          }),
        );

        return licenses.filter((license) => license.isAdminTest === false) as any;
      });

      const r = await getAdminSubscriptionRevenueAction({
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-06-30T23:59:59.000Z',
      });

      expect(r.success).toBe(true);
      expect(r.data).toEqual(
        expect.objectContaining({
          mrr: 60,
          arr: 720,
        }),
      );
      expect(r.data?.revenueByPlan).toEqual([
        expect.objectContaining({
          planId: 'plan-pro',
          tenants: 1,
          mrr: 60,
        }),
      ]);
      expect(r.data).toEqual(
        expect.objectContaining({
          activeLicenses: 1,
        }),
      );
    });
  });

  describe('getPendingMembershipsAction', () => {
    it('manager: consulta solo membresías inactivas de su tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
      vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([]);
      const r = await getPendingMembershipsAction();
      expect(r.success).toBe(true);
      expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false, tenantId: 'tenant-A' }),
        }),
      );
    });

    it('admin global: consulta todas las membresías inactivas', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
      vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([]);
      const r = await getPendingMembershipsAction();
      expect(r.success).toBe(true);
      expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('usuario sin rol manager ni admin: rechazado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(nonAdmin);
      const r = await getPendingMembershipsAction();
      expect(r.success).toBe(false);
      expect(r.error!.code).toBe('FORBIDDEN');
    });
  });

  describe('approveMembershipAction', () => {
    const membership = {
      membershipId: 'mem-1',
      tenantId: 'tenant-A',
      userId: 'user-worker',
      isActive: false,
      user: { userId: 'user-worker', name: 'Ana Pérez', email: 'ana@test.com' },
    };

    beforeEach(() => {
      vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as any);
      vi.mocked(prisma.tenantMembership.update).mockResolvedValue(membership as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(prisma.empleado.findFirst).mockResolvedValue(null as any);
      vi.mocked(prisma.empleado.create).mockResolvedValue({ empleadoId: 'emp-1' } as any);
    });

    it('manager: aprueba, activa usuario y limpia onboardingStatus (cierra onboarding del worker)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
      const r = await approveMembershipAction({ membershipId: 'mem-1', tenantRole: 'dependiente' });

      expect(r.success).toBe(true);
      expect(prisma.tenantMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { membershipId: 'mem-1' },
          data: expect.objectContaining({ isActive: true, tenantRole: 'dependiente' }),
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-worker' },
          data: expect.objectContaining({ isActive: true, onboardingStatus: null }),
        }),
      );
    });

    it('manager de otro tenant: rechazado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
      vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
        ...membership,
        tenantId: 'tenant-B',
      } as any);
      const r = await approveMembershipAction({ membershipId: 'mem-1', tenantRole: 'dependiente' });
      expect(r.success).toBe(false);
      expect(r.error!.code).toBe('FORBIDDEN');
      expect(prisma.tenantMembership.update).not.toHaveBeenCalled();
    });

    it('membresía ya activa: conflicto', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
      vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
        ...membership,
        isActive: true,
      } as any);
      const r = await approveMembershipAction({ membershipId: 'mem-1', tenantRole: 'dependiente' });
      expect(r.success).toBe(false);
      expect(r.error!.code).toBe('CONFLICT');
    });

    it('rol inválido: validación falla', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
      const r = await approveMembershipAction({ membershipId: 'mem-1', tenantRole: 'jefe' });
      expect(r.success).toBe(false);
      expect(prisma.tenantMembership.update).not.toHaveBeenCalled();
    });
  });

  describe('rejectMembershipAction', () => {
    it('manager: elimina la membresía pendiente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
      vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
        membershipId: 'mem-1',
        tenantId: 'tenant-A',
      } as any);
      vi.mocked(prisma.tenantMembership.delete).mockResolvedValue({} as any);
      const r = await rejectMembershipAction({ membershipId: 'mem-1' });
      expect(r.success).toBe(true);
      expect(prisma.tenantMembership.delete).toHaveBeenCalledWith({
        where: { membershipId: 'mem-1' },
      });
    });

    it('manager de otro tenant: rechazado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
      vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
        membershipId: 'mem-1',
        tenantId: 'tenant-B',
      } as any);
      const r = await rejectMembershipAction({ membershipId: 'mem-1' });
      expect(r.success).toBe(false);
      expect(r.error!.code).toBe('FORBIDDEN');
      expect(prisma.tenantMembership.delete).not.toHaveBeenCalled();
    });
  });
});
