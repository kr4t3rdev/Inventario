/**
 * @description Consultas y mutaciones de administración global reutilizables.
 *
 * Lógica extraída de las Server Actions admin (features/admin/actions.ts y
 * actions-licencias.ts) para que las rutas mobile REST puedan reusarla con
 * autenticación Bearer sin depender del contexto de cookies web.
 *
 * @module features/admin/server/admin-global-queries
 */

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { ActionError } from "@/lib/server-actions";
import { hasPermission } from "@/lib/services/tenant-scope";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import { prismaPlatform as prisma } from "@/lib/db/platform-prisma";
import { addDays } from "@/lib/date-utils";
function resolveLicenseDurationDays(planDurationDays: number | null | undefined, overrideDays: number | null | undefined) {
  const resolved = overrideDays ?? planDurationDays;
  if (resolved == null) return undefined;
  if (!Number.isInteger(resolved) || resolved <= 0) {
    throw new ActionError("La duracion de la licencia debe ser mayor que cero", "VALIDATION_ERROR");
  }
  return resolved;
}
function resolveLicensePricing(price: number, _isDemo: boolean) {
  return { precio: price };
}
import { AuditLogService } from "@/lib/services/audit-log-service";
import { normalizeUserRole } from "@/lib/auth/roles";
import { signOnboardingToken } from "@/lib/auth/onboarding";
import { getConfiguredPublicAppUrl } from "@/features/sales-agent/public-url";
import { sendEmailVerificationLink, sendPasswordResetEmail } from "@/lib/email";
import { generateSalesAgentReferralCode, isUniqueConstraintCollision } from "@/features/sales-agent/referral-code";
import {
	lockUnlockSchema,
	getLicenciasQuerySchema,
	licenciasStatsQuerySchema,
	adminUserIdSchema,
	adminUpdateUserSchema,
	adminAssignTenantSchema,
	adminChangeTenantRoleSchema,
	adminLicenciaIdSchema,
	adminRenewLicenciaSchema,
	adminTenantIdSchema,
	adminUpdateTenantSchema,
	adminRemoveTenantUserSchema,
	adminAssignTenantLicenseSchema,
	adminUpdateTenantLicenseSchema,
	adminActivityLogsQuerySchema,
	adminLoginHistoryQuerySchema,
	adminRevokeSessionSchema,
} from "../schemas";
import type {
	GetLicenciasQueryInput,
	LicenciasStatsQueryInput,
	LockUnlockInput,
	AdminUserIdInput,
	AdminUpdateUserInput,
	AdminAssignTenantInput,
	AdminChangeTenantRoleInput,
	AdminLicenciaIdInput,
	AdminRenewLicenciaInput,
	AdminTenantIdInput,
	AdminUpdateTenantInput,
	AdminRemoveTenantUserInput,
	AdminAssignTenantLicenseInput,
	AdminUpdateTenantLicenseInput,
	AdminActivityLogsQueryInput,
	AdminLoginHistoryQueryInput,
	AdminRevokeSessionInput,
} from "../schemas";

/**
 * @description Agrupa elementos por los últimos N días.
 * @param {T[]} items - Elementos con fecha de creación.
 * @param {(item: T) => number} valueExtractor - Extractora de valor por día.
 * @param {number} days - Ventana de días a agrupar.
 * @param {number} offsetDays - Desplazamiento desde hoy.
 * @returns {Array<{ fecha: string; value: number }>} Serie por fecha.
 */
export function groupByLastNDays<T extends { createdAt: Date }>(
  items: T[],
  valueExtractor: (item: T) => number,
  days: number,
  offsetDays = 0,
): Array<{ fecha: string; value: number }> {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i + offsetDays));
    const fecha = date.toISOString().split("T")[0];

    const value = items
      .filter((item) => item.createdAt.toISOString().split("T")[0] === fecha)
      .reduce((sum, item) => sum + valueExtractor(item), 0);

    return { fecha, value };
  });
}

/**
 * @description Construye la cláusula WHERE de Prisma a partir de los filtros de licencias.
 * @param {{ search?: string; planFilter?: string; statusFilter?: string; typeFilter?: string }} params - Filtros opcionales.
 * @returns {Prisma.TenantLicenseWhereInput} Cláusula WHERE tipada.
 */
function buildLicenciasWhere(params: {
  search?: string;
  planFilter?: string;
  statusFilter?: string;
  typeFilter?: string;
}): Prisma.TenantLicenseWhereInput {
  const { search, planFilter, statusFilter, typeFilter } = params;
  const where: Prisma.TenantLicenseWhereInput = {};

  if (planFilter && planFilter !== "all") where.planId = planFilter;
  if (statusFilter && statusFilter !== "all") {
    where.activa = statusFilter === "true";
  }
  if (typeFilter && typeFilter !== "all") {
    if (typeFilter === "demo") {
      where.isDemo = true;
    } else if (typeFilter === "admin_test") {
      where.isAdminTest = true;
    } else if (typeFilter === "standard") {
      where.isDemo = false;
      where.isAdminTest = false;
    }
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { tenantLicenseId: { contains: q, mode: "insensitive" } },
      { tenant: { nombre: { contains: q, mode: "insensitive" } } },
      {
        tenant: {
          memberships: {
            some: { user: { name: { contains: q, mode: "insensitive" } } },
          },
        },
      },
      {
        tenant: {
          memberships: {
            some: { user: { email: { contains: q, mode: "insensitive" } } },
          },
        },
      },
    ] as Prisma.TenantLicenseWhereInput[];
  }

  return where;
}

/**
 * @description Devuelve métricas globales de salud del sistema (usuarios, tenants, sesiones, licencias).
 * @param {void} _input - Sin entrada.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Métricas globales.
 */
export async function getAdminHealth(
  _input: void,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  if (user.role !== "admin")
    throw new ActionError("Acceso restringido", "FORBIDDEN");
  const now = new Date();
  const realTenantWhere = { licencias: { some: { isDemo: false } } };
  const realUserWhere = {
    tenantMemberships: {
      some: {
        tenant: realTenantWhere,
      },
    },
  };
  const [users, tenants, sessions, licenses, licensesActive, expiringSoon] =
    await Promise.all([
      prisma.user.count({ where: realUserWhere }),
      prisma.tenant.count({ where: realTenantWhere }),
      prisma.userSession.count({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
          user: realUserWhere,
        },
      }),
      prisma.tenantLicense.count({ where: { isDemo: false } }),
      prisma.tenantLicense.count({ where: { activa: true, isDemo: false } }),
      prisma.tenantLicense.count({
        where: {
          activa: true,
          isDemo: false,
          expiracion: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
      }),
    ]);
  const usersByRole = await prisma.user.groupBy({
    by: ["role"],
    where: realUserWhere,
    _count: true,
  });

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

  const usersHistoricos = await prisma.user.findMany({
    where: {
      createdAt: { gte: fourteenDaysAgo },
      ...realUserWhere,
    },
    select: {
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: 10000,
  });

  const usersTrendSeries = groupByLastNDays(usersHistoricos, () => 1, 14);
  const previousUsersTrend = usersTrendSeries.slice(0, 7);
  const usersTrend = usersTrendSeries.slice(-7).map(({ fecha, value }) => ({
    fecha,
    usuarios: value,
  }));
  const previous7DaysUsers = previousUsersTrend.reduce(
    (sum, day) => sum + day.value,
    0,
  );
  const current7DaysUsers = usersTrend.reduce(
    (sum, day) => sum + day.usuarios,
    0,
  );

  return {
    users: {
      total: users,
      byRole: usersByRole.map((r) => ({ role: r.role, count: r._count })),
    },
    tenants: { total: tenants },
    sessions: { active: sessions },
    licenses: {
      total: licenses,
      active: licensesActive,
      expiringSoon,
    },
    usersTrend,
    usersComparison: {
      current7DaysUsers,
      previous7DaysUsers,
    },
  };
}

/**
 * @description Lista usuarios globales (admin) o de un tenant (manager).
 * @param {{ tenantId?: string; limit?: number }} input - Filtros opcionales.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Lista de usuarios y total.
 */
export async function getAdminUsers(
  input: { tenantId?: string; limit?: number } = {},
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  const isPlatformAdmin = user.role === "admin";
  const canManageUsers = hasPermission(user, "config.usuarios.gestionar");

  if (!isPlatformAdmin && !canManageUsers) {
    throw new ActionError("Acceso restringido", "FORBIDDEN");
  }

  let tenantId: string | undefined;
  if (isPlatformAdmin) {
    tenantId = input.tenantId || user.tenantId;
  } else {
    if (input.tenantId && input.tenantId !== user.tenantId) {
      throw new ActionError(
        "No tienes permisos para ver usuarios de otra empresa",
        "FORBIDDEN",
      );
    }
    tenantId = user.tenantId;
  }

  if (tenantId) {
    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId, isActive: true },
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            onboardingType: true,
            onboardingStatus: true,
            createdAt: true,
            expiresAt: true,
            lockedUntil: true,
            avatar: true,
            _count: {
              select: { tenantMemberships: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: input.limit || 100,
    });

    const users = memberships.map((m) => ({
      ...m.user,
      tenantRole: m.tenantRole,
      membershipId: m.membershipId,
      membershipCount: (m.user as { _count?: { tenantMemberships: number } })
        ._count?.tenantMemberships ?? 1,
    }));

    return { users, total: users.length };
  }

  const rawUsers = await prisma.user.findMany({
    take: input.limit || 100,
    orderBy: { createdAt: "desc" },
    select: {
      userId: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      onboardingType: true,
      onboardingStatus: true,
      createdAt: true,
      expiresAt: true,
      lockedUntil: true,
      avatar: true,
      salesAgentProfile: { select: { phone: true, status: true } },
      salesAgentBalance: { select: { availableUsd: true, paidUsd: true } },
      salesAgentReferrals: {
        where: { status: "attributed" },
        select: { salesAgentReferralId: true },
      },
      tenantMemberships: {
        select: {
          tenantId: true,
          tenantRole: true,
          tenant: {
            select: { nombre: true },
          },
        },
        take: 5,
      },
      _count: {
        select: { tenantMemberships: true },
      },
    },
  });
  const total = await prisma.user.count();

  const users = rawUsers.map((u) => {
    const membership = u.tenantMemberships?.[0] ?? null;
    return {
      userId: u.userId,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      onboardingType: u.onboardingType,
      onboardingStatus: u.onboardingStatus,
      createdAt: u.createdAt,
      expiresAt: u.expiresAt,
      lockedUntil: u.lockedUntil,
      avatar: u.avatar,
      tenantRole: membership?.tenantRole ?? null,
      tenantId: membership?.tenantId ?? null,
      tenantName: membership?.tenant?.nombre ?? null,
      membershipCount: u._count?.tenantMemberships ?? 0,
      salesAgentProfile: u.salesAgentProfile,
      salesAgentBalance: u.salesAgentBalance,
      activeReferralCount: u.salesAgentReferrals.length,
    };
  });

  return { users, total };
}

/**
 * @description Bloquea un usuario por 24 horas.
 * @param {LockUnlockInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Usuario actualizado y mensaje.
 */
export async function lockAdminUser(
  input: LockUnlockInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  if (user.role !== "admin")
    throw new ActionError("Acceso restringido", "FORBIDDEN");
  const parsed = lockUnlockSchema.parse(input);
  const existing = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true },
  });
  if (!existing) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
  await prisma.user.updateMany({
    where: { userId: parsed.userId },
    data: { lockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  const updated = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, lockedUntil: true, loginAttempts: true },
  });
  revalidatePath("/admin");
  return { user: updated, message: "Usuario bloqueado por 24 horas" };
}

/**
 * @description Desbloquea un usuario y reinicia sus intentos de login.
 * @param {LockUnlockInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Usuario actualizado y mensaje.
 */
export async function unlockAdminUser(
  input: LockUnlockInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  if (user.role !== "admin")
    throw new ActionError("Acceso restringido", "FORBIDDEN");
  const parsed = lockUnlockSchema.parse(input);
  const existing = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true },
  });
  if (!existing) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
  await prisma.user.updateMany({
    where: { userId: parsed.userId },
    data: { lockedUntil: null, loginAttempts: 0 },
  });
  const updated = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, lockedUntil: true, loginAttempts: true },
  });
  revalidatePath("/admin");
  return { user: updated, message: "Usuario desbloqueado correctamente" };
}

/**
 * @description Lista las empresas (tenants reales) con su plan y conteo de usuarios.
 * @param {void} _input - Sin entrada.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object[]>} Lista de tenants.
 */
export async function getAdminTenants(
  _input: void,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>[]> {
  if (user.role !== "admin")
    throw new ActionError("Acceso restringido", "FORBIDDEN");
  const realTenantWhere = { licencias: { some: { isDemo: false } } };
  const tenants = await prisma.tenant.findMany({
    where: realTenantWhere,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { memberships: true, productos: true, almacenes: true },
      },
      licencias: {
        where: { activa: true, isDemo: false, expiracion: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { plan: true },
      },
    },
  });
  return tenants.map((t) => ({
    ...t,
    totalUsers: t._count.memberships,
    plan: t.licencias[0]?.plan?.nombre ?? null,
    planId: t.licencias[0]?.planId ?? null,
    licenseActive: t.licencias.length > 0,
  }));
}

/**
 * @description Lista licencias paginadas con filtros y ordenamiento.
 * @param {GetLicenciasQueryInput} input - Paginación, filtros y orden.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Licencias, total y página.
 */
export async function getAdminLicenses(
  input: GetLicenciasQueryInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  if (user.role !== "admin")
    throw new ActionError("Acceso restringido", "FORBIDDEN");

  const parsed = getLicenciasQuerySchema.parse(input ?? {});
  const { page, limit, sortBy, sortOrder, search, planFilter, statusFilter, typeFilter } =
    parsed;
  const skip = (page - 1) * limit;

  const where = buildLicenciasWhere({ search, planFilter, statusFilter, typeFilter });

  let orderBy: Prisma.TenantLicenseOrderByWithRelationInput = {
    createdAt: sortOrder,
  };
  if (sortBy === "tenantId") {
    orderBy = { tenant: { nombre: sortOrder } };
  } else if (sortBy === "planId") {
    orderBy = { plan: { nombre: sortOrder } };
  } else {
    orderBy = { [sortBy]: sortOrder } as Record<string, "asc" | "desc">;
  }

  const [licenses, total] = await Promise.all([
    prisma.tenantLicense.findMany({
      where,
      orderBy,
      skip: page === 1 ? undefined : skip,
      take: limit,
      include: {
        plan: true,
        tenant: {
          include: {
            memberships: {
              where: { isActive: true, tenantRole: "manager" },
              take: 1,
              include: {
                user: {
                  select: {
                    userId: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.tenantLicense.count({ where }),
  ]);

  const createdByIds = Array.from(
    new Set(
      licenses
        .map((license) => license.createdBy)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (createdByIds.length === 0) {
    return { licencias: licenses, total, page, limit };
  }

  const creators = await prisma.user.findMany({
    where: { userId: { in: createdByIds } },
    select: { userId: true, name: true, email: true },
  });

  const creatorsById = new Map(creators.map((c) => [c.userId, c]));

  const licencias = licenses.map((license) => ({
    ...license,
    createdByUser: license.createdBy
      ? creatorsById.get(license.createdBy) ?? null
      : null,
  }));

  return { licencias, total, page, limit };
}

/**
 * @description Devuelve métricas agregadas de licencias respetando los filtros.
 * @param {LicenciasStatsQueryInput} input - Filtros comunes.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Métricas de licencias.
 */
export async function getAdminLicenseStats(
  input: LicenciasStatsQueryInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  if (user.role !== "admin")
    throw new ActionError("Acceso restringido", "FORBIDDEN");

  const parsed = licenciasStatsQuerySchema.parse(input ?? {});
  const { search, planFilter, statusFilter, typeFilter } = parsed;

  const baseWhere = buildLicenciasWhere({ search, planFilter, statusFilter, typeFilter });
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [total, activas, expiradas, demos, porVencer, adminTest] =
    await Promise.all([
      prisma.tenantLicense.count({ where: baseWhere }),
      prisma.tenantLicense.count({
        where: {
          AND: [baseWhere, { activa: true, expiracion: { gt: now } }],
        },
      }),
      prisma.tenantLicense.count({
        where: {
          AND: [baseWhere, { expiracion: { lt: now } }],
        },
      }),
      prisma.tenantLicense.count({
        where: {
          AND: [baseWhere, { isDemo: true }],
        },
      }),
      prisma.tenantLicense.count({
        where: {
          AND: [
            baseWhere,
            { activa: true, expiracion: { gte: now, lte: nextWeek } },
          ],
        },
      }),
      prisma.tenantLicense.count({
        where: {
          AND: [baseWhere, { isAdminTest: true }],
        },
      }),
    ]);

  return { total, activas, expiradas, demos, porVencer, adminTest };
}

/**
 * @description Lista membresías pendientes de aprobación.
 * @param {void} _input - Sin entrada.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<PendingMembership[]>} Membresías pendientes.
 */
const pendingMembershipInclude = {
  user: {
    select: {
      userId: true,
      name: true,
      email: true,
      onboardingType: true,
      onboardingStatus: true,
      createdAt: true,
    },
  },
  tenant: { select: { tenantId: true, nombre: true } },
} satisfies Prisma.TenantMembershipInclude;

export type PendingMembership = Prisma.TenantMembershipGetPayload<{
  include: typeof pendingMembershipInclude;
}>;

export async function getAdminPendingMemberships(
  _input: void,
  user: AuthenticatedUser,
): Promise<PendingMembership[]> {
  const isPlatformAdmin = user.role === "admin";
  const canManageUsers = hasPermission(user, "config.usuarios.gestionar");

  if (!isPlatformAdmin && !canManageUsers) {
    throw new ActionError("Acceso restringido", "FORBIDDEN");
  }

  const where = isPlatformAdmin
    ? { isActive: false }
    : { isActive: false, tenantId: user.tenantId };

  return prisma.tenantMembership.findMany({
    where,
    include: pendingMembershipInclude,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * @description Aprueba una membresía pendiente, activa al usuario y crea su empleado si falta.
 * @param {{ membershipId: string; tenantRole: string }} input - Membresía y rol a asignar.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Resultado de la aprobación.
 */
export async function approveAdminMembership(
  input: { membershipId: string; tenantRole: string },
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  const { membershipId, tenantRole } = input;

  if (!tenantRole || typeof tenantRole !== "string") {
    throw new ActionError("El rol del tenant es requerido", "VALIDATION");
  }

  const validRoles = ["manager", "economico", "dependiente"];
  if (!validRoles.includes(tenantRole)) {
    throw new ActionError(
      `Rol inválido: ${tenantRole}. Roles válidos: ${validRoles.join(", ")}`,
      "VALIDATION",
    );
  }

  const membership = await prisma.tenantMembership.findUnique({
    where: { membershipId },
    select: {
      membershipId: true,
      tenantId: true,
      userId: true,
      isActive: true,
      user: { select: { userId: true, name: true, email: true } },
    },
  });

  if (!membership) {
    throw new ActionError(
      "Solicitud de membresía no encontrada",
      "NOT_FOUND",
    );
  }

  if (membership.isActive) {
    throw new ActionError("Esta membresía ya está activa", "CONFLICT");
  }

  const isPlatformAdmin = user.role === "admin";
  const canManageUsers =
    user.tenantId === membership.tenantId &&
    hasPermission(user, "config.usuarios.gestionar");

  if (!isPlatformAdmin && !canManageUsers) {
    throw new ActionError(
      "No tienes permisos para aprobar esta solicitud",
      "FORBIDDEN",
    );
  }

  await prisma.tenantMembership.update({
    where: { membershipId },
    data: { isActive: true, tenantRole },
  });

  await prisma.user.update({
    where: { userId: membership.userId },
    data: { isActive: true, onboardingStatus: null },
  });

  const nameParts = membership.user.name.trim().split(" ");
  const nombre = nameParts[0];
  const apellido = nameParts.slice(1).join(" ") || nombre;

  const cargoMap: Record<string, string> = {
    manager: "Director / Manager",
    economico: "Económico",
    dependiente: "Dependiente",
  };

  let empleadoCreado = false;

  const existingEmpleado = await prisma.empleado.findFirst({
    where: { tenantId: membership.tenantId, nombre, apellido },
  });

  if (!existingEmpleado) {
    const cargo = cargoMap[tenantRole] || tenantRole;
    await prisma.empleado.create({
      data: {
        tenantId: membership.tenantId,
        nombre,
        apellido,
        cargo,
        salarioBases: 0,
        fechaContratacion: new Date(),
      },
    });
    empleadoCreado = true;
  }

  revalidatePath("/busy/configuracion/usuarios");
  return { success: true, empleadoCreado };
}

/**
 * @description Rechaza una membresía pendiente y restablece el onboarding del usuario.
 * @param {{ membershipId: string }} input - Identificador de la membresía.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Resultado del rechazo.
 */
export async function rejectAdminMembership(
  input: { membershipId: string },
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  const membership = await prisma.tenantMembership.findUnique({
    where: { membershipId: input.membershipId },
    select: { membershipId: true, tenantId: true, userId: true },
  });

  if (!membership)
    throw new ActionError("Solicitud no encontrada", "NOT_FOUND");

  const isPlatformAdmin = user.role === "admin";
  const canManageUsers =
    user.tenantId === membership.tenantId &&
    hasPermission(user, "config.usuarios.gestionar");

  if (!isPlatformAdmin && !canManageUsers) {
    throw new ActionError("Acceso restringido", "FORBIDDEN");
  }

  await prisma.tenantMembership.delete({
    where: { membershipId: input.membershipId },
  });

  await prisma.user.updateMany({
    where: {
      userId: membership.userId,
      onboardingStatus: "awaiting_manager_approval",
    },
    data: { onboardingStatus: "selecting_tenant" },
  });
  revalidatePath("/busy/configuracion/usuarios");
  return { success: true };
}
// ─── Gestión individual de usuarios ──────────────────────────────────

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * @description Verifica que el usuario autenticado sea administrador de plataforma.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 */
function assertPlatformAdmin(user: AuthenticatedUser): void {
  if (user.role !== "admin")
    throw new ActionError("Acceso restringido", "FORBIDDEN");
}

/**
 * @description Registra una acción administrativa en el log de actividad.
 * @param {{ userId: string; action: string; performedBy: string; details?: Record<string, unknown> }} params - Datos del registro.
 * @returns {Promise<void>}
 */
async function logAdminUserAction(params: {
  userId: string;
  action: string;
  performedBy: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await prisma.userActivityLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      details: params.details ? JSON.stringify(params.details) : undefined,
      performedBy: params.performedBy,
    },
  });
}

/**
 * @description Evita dejar la plataforma sin administradores activos.
 * @param {string} userId - Usuario que perdería el rol/estado de admin.
 * @returns {Promise<void>}
 */
async function assertNotLastPlatformAdmin(userId: string): Promise<void> {
  const remaining = await prisma.user.count({
    where: { role: "admin", isActive: true, userId: { not: userId } },
  });
  if (remaining === 0) {
    throw new ActionError(
      "No se puede completar la acción: debe existir al menos un administrador activo en la plataforma",
      "CONFLICT",
    );
  }
}

const adminUserDetailSelect = {
  userId: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  onboardingType: true,
  onboardingStatus: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
  activatedAt: true,
  expiresAt: true,
  avatar: true,
  lockedUntil: true,
  loginAttempts: true,
  lastFailedLogin: true,
} satisfies Record<string, boolean>;

/**
 * @description Obtiene la ficha individual de un usuario sin descargar la lista completa.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Detalle del usuario con membresías y sesiones activas.
 */
export async function getAdminUserDetail(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  const detail = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: {
      ...adminUserDetailSelect,
      tenantMemberships: {
        select: {
          membershipId: true,
          tenantId: true,
          tenantRole: true,
          isActive: true,
          createdAt: true,
          tenant: {
            select: { tenantId: true, nombre: true, slug: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!detail) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

  const activeSessions = await prisma.userSession.count({
    where: { userId: parsed.userId, isActive: true },
  });

  return { user: { ...detail, activeSessions } };
}

/**
 * @description Edita el nombre, email o rol de plataforma de un usuario.
 * @param {AdminUpdateUserInput} input - Campos a actualizar.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Usuario actualizado y mensaje.
 */
export async function updateAdminUser(
  input: AdminUpdateUserInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUpdateUserSchema.parse(input ?? {});

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, role: true, email: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (parsed.name !== undefined) data.name = parsed.name.trim();
  if (parsed.email !== undefined) {
    const email = parsed.email.trim().toLowerCase();
    const conflict = await prisma.user.findUnique({
      where: { email },
      select: { userId: true },
    });
    if (conflict && conflict.userId !== parsed.userId) {
      throw new ActionError(
        "El email ya está en uso por otro usuario",
        "CONFLICT",
      );
    }
    data.email = email;
    // El nuevo correo aún no está verificado.
    if (email !== target.email) data.emailVerifiedAt = null;
  }
  if (parsed.role !== undefined) {
    const normalized = normalizeUserRole(parsed.role);
    if (!normalized)
      throw new ActionError(`Rol inválido: ${parsed.role}`, "VALIDATION");
    if (parsed.userId === user.userId) {
      throw new ActionError("No puedes modificar tu propio rol", "FORBIDDEN");
    }
    if (target.role === "admin" && normalized !== "admin") {
      await assertNotLastPlatformAdmin(parsed.userId);
    }
    data.role = normalized;
  }

  if (Object.keys(data).length === 0) {
    throw new ActionError("Sin cambios para aplicar", "VALIDATION");
  }

  await prisma.user.update({ where: { userId: parsed.userId }, data });

  // El gestor de ventas es tenantless: se limpian membresías y se asegura su perfil.
  if (parsed.role === "salesAgent" && target.role !== "salesAgent") {
    await prisma.tenantMembership.deleteMany({
      where: { userId: parsed.userId },
    });
    const existingProfile = await prisma.salesAgentProfile.findUnique({
      where: { userId: parsed.userId },
      select: { salesAgentProfileId: true },
    });
    if (!existingProfile) {
      try {
        await prisma.salesAgentProfile.create({
          data: {
            userId: parsed.userId,
            status: "active",
            referralCode: generateSalesAgentReferralCode(),
            approvedAt: new Date(),
            approvedByAdminId: user.userId,
          },
        });
        await prisma.salesAgentBalance.upsert({
          where: { userId: parsed.userId },
          create: { userId: parsed.userId },
          update: {},
        });
      } catch (error) {
        if (isUniqueConstraintCollision(error)) {
          throw new ActionError(
            "El código de referido generado colisionó. Intentá guardar nuevamente",
            "REFERRAL_CODE_COLLISION",
          );
        }
        throw error;
      }
    }
  }

  const updated = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: adminUserDetailSelect,
  });

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.update",
    performedBy: user.userId,
    details: { changes: Object.keys(data) },
  });
  revalidatePath("/admin");
  return { user: updated, message: "Usuario actualizado correctamente" };
}

/**
 * @description Activa un usuario desactivado.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Estado actualizado y mensaje.
 */
export async function activateAdminUser(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, isActive: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
  if (target.isActive) {
    throw new ActionError("El usuario ya está activo", "CONFLICT");
  }

  await prisma.user.update({
    where: { userId: parsed.userId },
    data: { isActive: true, lockedUntil: null, loginAttempts: 0 },
  });

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.activate",
    performedBy: user.userId,
  });
  revalidatePath("/admin");
  return {
    user: { userId: parsed.userId, isActive: true, lockedUntil: null },
    message: "Usuario activado correctamente",
  };
}

/**
 * @description Desactiva un usuario y revoca sus sesiones activas.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Estado actualizado y mensaje.
 */
export async function deactivateAdminUser(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  if (parsed.userId === user.userId) {
    throw new ActionError("No puedes desactivar tu propio usuario", "FORBIDDEN");
  }

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, isActive: true, role: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
  if (!target.isActive) {
    throw new ActionError("El usuario ya está desactivado", "CONFLICT");
  }
  if (target.role === "admin") {
    await assertNotLastPlatformAdmin(parsed.userId);
  }

  const [revoked, deactivated] = await prisma.$transaction([
    prisma.userSession.updateMany({
      where: { userId: parsed.userId, isActive: true },
      data: { isActive: false },
    }),
    prisma.user.update({
      where: { userId: parsed.userId },
      data: { isActive: false },
      select: { userId: true, isActive: true, lockedUntil: true },
    }),
  ]);

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.deactivate",
    performedBy: user.userId,
    details: { revokedSessions: revoked.count },
  });
  revalidatePath("/admin");
  return {
    user: deactivated,
    message: "Usuario desactivado y sesiones revocadas",
  };
}

/**
 * @description Elimina permanentemente un usuario de la plataforma.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Confirmación de eliminación.
 */
export async function deleteAdminUser(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  if (parsed.userId === user.userId) {
    throw new ActionError("No puedes eliminar tu propio usuario", "FORBIDDEN");
  }

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: {
      userId: true,
      name: true,
      email: true,
      role: true,
      salesAgentBalance: { select: { salesAgentBalanceId: true } },
      _count: {
        select: {
          salesAgentReferrals: true,
          salesAgentCommissions: true,
          salesAgentPayouts: true,
        },
      },
    },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

  if (target.role === "admin") {
    await assertNotLastPlatformAdmin(parsed.userId);
  }

  const hasSalesAgentRecords =
    target.salesAgentBalance !== null ||
    target._count.salesAgentReferrals > 0 ||
    target._count.salesAgentCommissions > 0 ||
    target._count.salesAgentPayouts > 0;

  if (hasSalesAgentRecords) {
    throw new ActionError(
      "No se puede eliminar un Gestor de Ventas con registros asociados (balance, referidos, comisiones o pagos). Desactiva el usuario en su lugar",
      "SALES_AGENT_WITH_RECORDS",
    );
  }

  // El log se asocia al admin ejecutor: el borrado en cascada eliminaría
  // un registro asociado al usuario objetivo.
  await logAdminUserAction({
    userId: user.userId,
    action: "admin.user.delete",
    performedBy: user.userId,
    details: {
      deletedUserId: target.userId,
      deletedEmail: target.email,
      deletedName: target.name,
    },
  });

  await prisma.user.deleteMany({ where: { userId: parsed.userId } });
  revalidatePath("/admin");
  return { success: true, userId: parsed.userId };
}

/**
 * @description Envía al usuario un enlace temporal para restablecer su contraseña.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Confirmación del envío.
 */
export async function resetAdminUserPassword(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, name: true, email: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

  const token = signOnboardingToken(
    { userId: target.userId, email: target.email, purpose: "password-reset" },
    "1h",
  );

  await prisma.user.update({
    where: { userId: target.userId },
    data: {
      resetPasswordToken: token,
      resetPasswordExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const origin = getConfiguredPublicAppUrl();
  if (!origin) {
    throw new Error("El servicio de recuperación no está disponible");
  }
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  await sendPasswordResetEmail(target.email, resetUrl, target.name);

  await logAdminUserAction({
    userId: target.userId,
    action: "admin.user.reset-password",
    performedBy: user.userId,
  });
  revalidatePath("/admin");
  return {
    success: true,
    message: `Enlace de restablecimiento enviado a ${target.email}`,
  };
}

/**
 * @description Marca manualmente el email de un usuario como verificado.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Estado de verificación y mensaje.
 */
export async function verifyAdminUserEmail(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, email: true, emailVerifiedAt: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

  if (target.emailVerifiedAt) {
    return {
      user: {
        userId: target.userId,
        email: target.email,
        emailVerifiedAt: target.emailVerifiedAt,
      },
      alreadyVerified: true,
      message: "El email ya estaba verificado",
    };
  }

  const updated = await prisma.user.update({
    where: { userId: parsed.userId },
    data: { emailVerifiedAt: new Date() },
    select: { userId: true, email: true, emailVerifiedAt: true },
  });

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.verify-email",
    performedBy: user.userId,
  });
  revalidatePath("/admin");
  return {
    user: updated,
    alreadyVerified: false,
    message: "Email marcado como verificado",
  };
}

/**
 * @description Reenvía el email de verificación al correo del usuario.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Confirmación del envío.
 */
export async function resendAdminUserVerification(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true, name: true, email: true, emailVerifiedAt: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
  if (target.emailVerifiedAt) {
    throw new ActionError(
      "El email de este usuario ya está verificado",
      "CONFLICT",
    );
  }

  const verificationToken = signOnboardingToken({
    userId: target.userId,
    email: target.email,
    purpose: "email-verification",
  });

  const origin = getConfiguredPublicAppUrl();
  if (!origin) {
    throw new Error("El servicio de verificación no está disponible");
  }
  const verificationUrl = `${origin}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  await sendEmailVerificationLink(target.email, verificationUrl, target.name);

  await logAdminUserAction({
    userId: target.userId,
    action: "admin.user.resend-verification",
    performedBy: user.userId,
  });
  revalidatePath("/admin");
  return {
    success: true,
    message: `Email de verificación reenviado a ${target.email}`,
  };
}

/**
 * @description Asigna un usuario a una empresa o lo mueve de empresa.
 * @param {AdminAssignTenantInput} input - Usuario, empresa, rol y cambio de empresa.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Membresía resultante y mensaje.
 */
export async function assignAdminUserTenant(
  input: AdminAssignTenantInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminAssignTenantSchema.parse(input ?? {});

  const [target, tenant] = await Promise.all([
    prisma.user.findUnique({
      where: { userId: parsed.userId },
      select: { userId: true },
    }),
    prisma.tenant.findUnique({
      where: { tenantId: parsed.tenantId },
      select: { tenantId: true, nombre: true },
    }),
  ]);
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");
  if (!tenant) throw new ActionError("Empresa no encontrada", "NOT_FOUND");

  if (parsed.deactivateOthers) {
    await prisma.tenantMembership.updateMany({
      where: {
        userId: parsed.userId,
        tenantId: { not: parsed.tenantId },
        isActive: true,
      },
      data: { isActive: false },
    });
  }

  const membership = await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: { tenantId: parsed.tenantId, userId: parsed.userId },
    },
    create: {
      tenantId: parsed.tenantId,
      userId: parsed.userId,
      tenantRole: parsed.tenantRole,
      isActive: true,
    },
    update: { tenantRole: parsed.tenantRole, isActive: true },
    include: {
      tenant: { select: { tenantId: true, nombre: true } },
    },
  });

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.assign-tenant",
    performedBy: user.userId,
    details: {
      tenantId: parsed.tenantId,
      tenantRole: parsed.tenantRole,
      deactivateOthers: parsed.deactivateOthers,
    },
  });
  revalidatePath("/admin");
  return {
    membership,
    message: `Usuario asignado a ${tenant.nombre} como ${parsed.tenantRole}`,
  };
}

/**
 * @description Modifica el rol de un usuario dentro de una empresa.
 * @param {AdminChangeTenantRoleInput} input - Usuario, empresa y nuevo rol.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Membresía actualizada y mensaje.
 */
export async function changeAdminUserTenantRole(
  input: AdminChangeTenantRoleInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminChangeTenantRoleSchema.parse(input ?? {});

  const membership = await prisma.tenantMembership.findUnique({
    where: {
      tenantId_userId: { tenantId: parsed.tenantId, userId: parsed.userId },
    },
    select: { membershipId: true, tenantRole: true },
  });
  if (!membership) {
    throw new ActionError(
      "El usuario no tiene membresía en esta empresa. Usa asignar empresa primero",
      "NOT_FOUND",
    );
  }

  const updated = await prisma.tenantMembership.update({
    where: { membershipId: membership.membershipId },
    data: { tenantRole: parsed.tenantRole },
    include: {
      tenant: { select: { tenantId: true, nombre: true } },
    },
  });

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.change-tenant-role",
    performedBy: user.userId,
    details: {
      tenantId: parsed.tenantId,
      previousRole: membership.tenantRole,
      newRole: parsed.tenantRole,
    },
  });
  revalidatePath("/admin");
  return {
    membership: updated,
    message: `Rol actualizado a ${parsed.tenantRole} en ${updated.tenant.nombre}`,
  };
}

/**
 * @description Revoca todas las sesiones activas de un usuario.
 * @param {AdminUserIdInput} input - Identificador del usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Cantidad revocada y mensaje.
 */
export async function revokeAdminUserSessions(
  input: AdminUserIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUserIdSchema.parse(input ?? {});

  const target = await prisma.user.findUnique({
    where: { userId: parsed.userId },
    select: { userId: true },
  });
  if (!target) throw new ActionError("Usuario no encontrado", "NOT_FOUND");

  const result = await prisma.userSession.updateMany({
    where: { userId: parsed.userId, isActive: true },
    data: { isActive: false },
  });

  await logAdminUserAction({
    userId: parsed.userId,
    action: "admin.user.revoke-sessions",
    performedBy: user.userId,
    details: { revoked: result.count },
  });
  revalidatePath("/admin");
  return {
    revoked: result.count,
    message:
      result.count === 0
        ? "El usuario no tenía sesiones activas"
        : `Se revocaron ${result.count} sesiones activas`,
  };
}

// ─── Gestión de licencias ────────────────────────────────────────────

const adminLicenseSummarySelect = {
  tenantLicenseId: true,
  tenantId: true,
  planId: true,
  activa: true,
  inicio: true,
  expiracion: true,
  isDemo: true,
  isAdminTest: true,
} satisfies Record<string, boolean>;

/**
 * @description Renueva una licencia extendiendo su expiración según el plan.
 *
 * Vía canónica de renovación (igual que `renewLicenciaAction` web pero sin
 * registro de pago): extiende desde la expiración vigente (o desde hoy si ya
 * venció), aplica el plan indicado (o mantiene el actual), sincroniza límites
 * y reactiva a los usuarios del tenant.
 * @param {AdminRenewLicenciaInput} input - Licencia, plan y duración opcional.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Resultado de la renovación y mensaje.
 */
export async function renewAdminLicense(
  input: AdminRenewLicenciaInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminRenewLicenciaSchema.parse(input ?? {});

  const outcome = await prisma.$transaction(async (tx) => {
    const [license, newPlan] = await Promise.all([
      tx.tenantLicense.findUnique({
        where: { tenantLicenseId: parsed.tenantLicenseId },
        include: { plan: true },
      }),
      parsed.planId
        ? tx.plan.findUnique({ where: { planId: parsed.planId } })
        : Promise.resolve(null),
    ]);

    if (!license) throw new ActionError("Licencia no encontrada", "NOT_FOUND");
    if (parsed.planId && !newPlan)
      throw new ActionError("Plan no encontrado", "NOT_FOUND");

    const targetPlan = newPlan ?? license.plan;
    if (!targetPlan) {
      throw new ActionError(
        "La licencia no tiene un plan asociado",
        "VALIDATION",
      );
    }

    const durationDays = resolveLicenseDurationDays(
      targetPlan.duracionDias,
      parsed.durationDays,
    );
    if (!durationDays) {
      throw new ActionError(
        "No se pudo resolver la duración de la licencia",
        "VALIDATION",
      );
    }

    const now = new Date();
    const baseExpiracion =
      license.expiracion.getTime() > now.getTime() ? license.expiracion : now;
    const newExpiracion = addDays(baseExpiracion, durationDays);
    const samePlan = targetPlan.planId === license.planId;

    const updated = await tx.tenantLicense.update({
      where: { tenantLicenseId: license.tenantLicenseId },
      data: {
        planId: targetPlan.planId,
        expiracion: newExpiracion,
        activa: true,
        maxUsuarios: targetPlan.maxUsuarios,
        maxAlmacenes: targetPlan.maxAlmacenes,
        maxProductos: targetPlan.maxProductos,
        maxClientes: targetPlan.maxClientes,
        features: samePlan
          ? (license.features as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        featureOverrides: samePlan ? (license.featureOverrides ?? {}) : {},
        ...resolveLicensePricing(Number(targetPlan.precio), false),
      },
    });

    await tx.user.updateMany({
      where: {
        tenantMemberships: {
          some: { tenantId: license.tenantId, isActive: true },
        },
        isActive: true,
      } as never,
      data: { expiresAt: newExpiracion, isActive: true },
    });

    await AuditLogService.logStrict(
      {
        accion: "UPDATE",
        entidad: "TENANT_LICENSE",
        entidadId: updated.tenantLicenseId,
        usuarioId: user.userId,
        detalles: {
          previousExpiracion: license.expiracion.toISOString(),
          newExpiracion: newExpiracion.toISOString(),
          previousPlanId: license.planId,
          newPlanId: targetPlan.planId,
          via: "mobile-admin",
        },
      },
      tx,
    );

    return {
      tenantLicenseId: updated.tenantLicenseId,
      newExpiracion,
      newPlanId: targetPlan.planId,
      previousExpiracion: license.expiracion,
      previousPlanId: license.planId ?? null,
    };
  });

  revalidatePath("/admin");
  return { ...outcome, message: "Licencia renovada correctamente" };
}

/**
 * @description Activa una licencia desactivada.
 * @param {AdminLicenciaIdInput} input - Identificador de la licencia.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Licencia actualizada y mensaje.
 */
export async function activateAdminLicense(
  input: AdminLicenciaIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminLicenciaIdSchema.parse(input ?? {});

  const license = await prisma.tenantLicense.findUnique({
    where: { tenantLicenseId: parsed.tenantLicenseId },
    select: { tenantLicenseId: true, activa: true },
  });
  if (!license) throw new ActionError("Licencia no encontrada", "NOT_FOUND");
  if (license.activa) {
    throw new ActionError("La licencia ya está activa", "CONFLICT");
  }

  const updated = await prisma.tenantLicense.update({
    where: { tenantLicenseId: parsed.tenantLicenseId },
    data: { activa: true },
    select: adminLicenseSummarySelect,
  });

  await AuditLogService.logStrict({
    accion: "UPDATE",
    entidad: "TENANT_LICENSE",
    entidadId: updated.tenantLicenseId,
    usuarioId: user.userId,
    detalles: { activa: true, via: "mobile-admin" },
  });
  revalidatePath("/admin");
  return { license: updated, message: "Licencia activada correctamente" };
}

/**
 * @description Desactiva una licencia activa.
 * @param {AdminLicenciaIdInput} input - Identificador de la licencia.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Licencia actualizada y mensaje.
 */
export async function deactivateAdminLicense(
  input: AdminLicenciaIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminLicenciaIdSchema.parse(input ?? {});

  const license = await prisma.tenantLicense.findUnique({
    where: { tenantLicenseId: parsed.tenantLicenseId },
    select: { tenantLicenseId: true, activa: true },
  });
  if (!license) throw new ActionError("Licencia no encontrada", "NOT_FOUND");
  if (!license.activa) {
    throw new ActionError("La licencia ya está desactivada", "CONFLICT");
  }

  const updated = await prisma.tenantLicense.update({
    where: { tenantLicenseId: parsed.tenantLicenseId },
    data: { activa: false },
    select: adminLicenseSummarySelect,
  });

  await AuditLogService.logStrict({
    accion: "UPDATE",
    entidad: "TENANT_LICENSE",
    entidadId: updated.tenantLicenseId,
    usuarioId: user.userId,
    detalles: { activa: false, via: "mobile-admin" },
  });
  revalidatePath("/admin");
  return { license: updated, message: "Licencia desactivada correctamente" };
}

/**
 * @description Elimina permanentemente una licencia.
 * @param {AdminLicenciaIdInput} input - Identificador de la licencia.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Confirmación de eliminación.
 */
export async function deleteAdminLicense(
  input: AdminLicenciaIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminLicenciaIdSchema.parse(input ?? {});

  const license = await prisma.tenantLicense.findUnique({
    where: { tenantLicenseId: parsed.tenantLicenseId },
    select: { tenantLicenseId: true, tenantId: true },
  });
  if (!license) throw new ActionError("Licencia no encontrada", "NOT_FOUND");

  await AuditLogService.logStrict({
    accion: "DELETE",
    entidad: "TENANT_LICENSE",
    entidadId: license.tenantLicenseId,
    usuarioId: user.userId,
    detalles: { tenantId: license.tenantId, via: "mobile-admin" },
  });

  await prisma.tenantLicense.delete({
    where: { tenantLicenseId: parsed.tenantLicenseId },
  });

  revalidatePath("/admin");
  return { success: true, tenantLicenseId: parsed.tenantLicenseId };
}

// ─── Gestión de empresas ─────────────────────────────────────────────

const adminTenantDetailSelect = {
  tenantId: true,
  nombre: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
  contabilidadTimezone: true,
  regimenFiscal: true,
  taxId: true,
  razonSocial: true,
  codigoPostalFiscal: true,
  fiscalActivado: true,
} satisfies Record<string, boolean>;

/**
 * @description Obtiene el detalle completo de una empresa.
 * @param {AdminTenantIdInput} input - Identificador de la empresa.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Empresa con licencia vigente, miembros y conteos.
 */
export async function getAdminTenantDetail(
  input: AdminTenantIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminTenantIdSchema.parse(input ?? {});

  const tenant = await prisma.tenant.findUnique({
    where: { tenantId: parsed.tenantId },
    select: {
      ...adminTenantDetailSelect,
      licencias: {
        orderBy: { createdAt: "desc" },
        include: { plan: true },
      },
      memberships: {
        where: { isActive: true },
        select: {
          membershipId: true,
          tenantRole: true,
          isActive: true,
          createdAt: true,
          user: {
            select: {
              userId: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          memberships: true,
          productos: true,
          almacenes: true,
          clientes: true,
        },
      },
    },
  });
  if (!tenant) throw new ActionError("Empresa no encontrada", "NOT_FOUND");

  // Igual que getAdminTenants (fix 3feec6b6): la vigencia exige expiracion futura.
  const now = new Date();
  const currentLicense =
    tenant.licencias.find((l) => l.activa && !l.isDemo && l.expiracion > now) ??
    tenant.licencias.find((l) => l.activa && l.expiracion > now) ??
    null;

  return {
    tenant: {
      ...tenant,
      totalUsers: tenant._count.memberships,
      totalProducts: tenant._count.productos,
      totalWarehouses: tenant._count.almacenes,
      totalClients: tenant._count.clientes,
    },
    currentLicense,
  };
}

/**
 * @description Edita el nombre, los datos fiscales y la configuración de una empresa.
 * @param {AdminUpdateTenantInput} input - Campos a actualizar.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Empresa actualizada y mensaje.
 */
export async function updateAdminTenant(
  input: AdminUpdateTenantInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUpdateTenantSchema.parse(input ?? {});

  const tenant = await prisma.tenant.findUnique({
    where: { tenantId: parsed.tenantId },
    select: { tenantId: true, slug: true },
  });
  if (!tenant) throw new ActionError("Empresa no encontrada", "NOT_FOUND");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (parsed.nombre !== undefined) data.nombre = parsed.nombre.trim();
  if (parsed.slug !== undefined) {
    const slug = parsed.slug.trim();
    if (slug !== tenant.slug) {
      const conflict = await prisma.tenant.findUnique({
        where: { slug },
        select: { tenantId: true },
      });
      if (conflict && conflict.tenantId !== parsed.tenantId) {
        throw new ActionError(
          "El identificador ya está en uso por otra empresa",
          "CONFLICT",
        );
      }
    }
    data.slug = slug;
  }
  if (parsed.regimenFiscal !== undefined)
    data.regimenFiscal = parsed.regimenFiscal;
  if (parsed.taxId !== undefined) data.taxId = parsed.taxId;
  if (parsed.razonSocial !== undefined) data.razonSocial = parsed.razonSocial;
  if (parsed.codigoPostalFiscal !== undefined)
    data.codigoPostalFiscal = parsed.codigoPostalFiscal;
  if (parsed.fiscalActivado !== undefined)
    data.fiscalActivado = parsed.fiscalActivado;
  if (parsed.contabilidadTimezone !== undefined)
    data.contabilidadTimezone = parsed.contabilidadTimezone;

  if (Object.keys(data).length === 0) {
    throw new ActionError("Sin cambios para aplicar", "VALIDATION");
  }

  const updated = await prisma.tenant.update({
    where: { tenantId: parsed.tenantId },
    data,
    select: adminTenantDetailSelect,
  });

  revalidatePath("/admin");
  return { tenant: updated, message: "Empresa actualizada correctamente" };
}

/**
 * @description Activa una empresa reactivando todas sus membresías.
 * @param {AdminTenantIdInput} input - Identificador de la empresa.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Cantidad reactivada y mensaje.
 */
export async function activateAdminTenant(
  input: AdminTenantIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminTenantIdSchema.parse(input ?? {});

  const tenant = await prisma.tenant.findUnique({
    where: { tenantId: parsed.tenantId },
    select: { tenantId: true, nombre: true },
  });
  if (!tenant) throw new ActionError("Empresa no encontrada", "NOT_FOUND");

  const result = await prisma.tenantMembership.updateMany({
    where: { tenantId: parsed.tenantId, isActive: false },
    data: { isActive: true },
  });

  revalidatePath("/admin");
  return {
    tenantId: parsed.tenantId,
    membershipsActivated: result.count,
    message:
      result.count === 0
        ? `${tenant.nombre} ya tenía todas sus membresías activas`
        : `${tenant.nombre} activada: ${result.count} membresías reactivadas`,
  };
}

/**
 * @description Desactiva una empresa bloqueando el acceso de todos sus miembros.
 * @param {AdminTenantIdInput} input - Identificador de la empresa.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Cantidad desactivada y mensaje.
 */
export async function deactivateAdminTenant(
  input: AdminTenantIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminTenantIdSchema.parse(input ?? {});

  const tenant = await prisma.tenant.findUnique({
    where: { tenantId: parsed.tenantId },
    select: { tenantId: true, nombre: true },
  });
  if (!tenant) throw new ActionError("Empresa no encontrada", "NOT_FOUND");

  const result = await prisma.tenantMembership.updateMany({
    where: { tenantId: parsed.tenantId, isActive: true },
    data: { isActive: false },
  });

  revalidatePath("/admin");
  return {
    tenantId: parsed.tenantId,
    membershipsDeactivated: result.count,
    message: `${tenant.nombre} desactivada: ${result.count} membresías bloqueadas`,
  };
}

/**
 * @description Elimina permanentemente una empresa y todos sus datos.
 * @param {AdminTenantIdInput} input - Identificador de la empresa.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Confirmación de eliminación.
 */
export async function deleteAdminTenant(
  input: AdminTenantIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminTenantIdSchema.parse(input ?? {});

  const tenant = await prisma.tenant.findUnique({
    where: { tenantId: parsed.tenantId },
    select: { tenantId: true, nombre: true },
  });
  if (!tenant) throw new ActionError("Empresa no encontrada", "NOT_FOUND");

  await prisma.tenant.delete({ where: { tenantId: parsed.tenantId } });

  revalidatePath("/admin");
  return {
    success: true,
    tenantId: parsed.tenantId,
    message: `Empresa ${tenant.nombre} eliminada permanentemente`,
  };
}

/**
 * @description Lista los usuarios pertenecientes a una empresa.
 * @param {AdminTenantIdInput} input - Identificador de la empresa.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Miembros con sus datos y total.
 */
export async function getAdminTenantUsers(
  input: AdminTenantIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminTenantIdSchema.parse(input ?? {});

  const tenant = await prisma.tenant.findUnique({
    where: { tenantId: parsed.tenantId },
    select: { tenantId: true },
  });
  if (!tenant) throw new ActionError("Empresa no encontrada", "NOT_FOUND");

  const memberships = await prisma.tenantMembership.findMany({
    where: { tenantId: parsed.tenantId },
    select: {
      membershipId: true,
      tenantRole: true,
      isActive: true,
      createdAt: true,
      user: {
        select: {
          userId: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          avatar: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const users = memberships.map((m) => ({
    ...m.user,
    tenantRole: m.tenantRole,
    membershipId: m.membershipId,
    membershipActive: m.isActive,
    memberSince: m.createdAt,
  }));

  return { users, total: users.length, tenantId: parsed.tenantId };
}

/**
 * @description Quita un usuario de una empresa desactivando su membresía.
 * @param {AdminRemoveTenantUserInput} input - Empresa y usuario.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Resultado y mensaje.
 */
export async function removeAdminTenantUser(
  input: AdminRemoveTenantUserInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminRemoveTenantUserSchema.parse(input ?? {});

  const membership = await prisma.tenantMembership.findUnique({
    where: {
      tenantId_userId: { tenantId: parsed.tenantId, userId: parsed.userId },
    },
    select: {
      membershipId: true,
      isActive: true,
      user: { select: { name: true } },
      tenant: { select: { nombre: true } },
    },
  });
  if (!membership) {
    throw new ActionError(
      "El usuario no pertenece a esta empresa",
      "NOT_FOUND",
    );
  }
  if (!membership.isActive) {
    throw new ActionError(
      "El usuario ya no es miembro activo de esta empresa",
      "CONFLICT",
    );
  }

  await prisma.tenantMembership.update({
    where: { membershipId: membership.membershipId },
    data: { isActive: false },
  });

  revalidatePath("/admin");
  return {
    success: true,
    membershipId: membership.membershipId,
    message: `${membership.user.name} fue quitado de ${membership.tenant.nombre}`,
  };
}

/**
 * @description Obtiene las licencias de una empresa y la vigente.
 * @param {AdminTenantIdInput} input - Identificador de la empresa.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Licencias ordenadas y la vigente.
 */
export async function getAdminTenantLicense(
  input: AdminTenantIdInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminTenantIdSchema.parse(input ?? {});

  const tenant = await prisma.tenant.findUnique({
    where: { tenantId: parsed.tenantId },
    select: {
      tenantId: true,
      licencias: {
        orderBy: { createdAt: "desc" },
        include: { plan: true },
      },
    },
  });
  if (!tenant) throw new ActionError("Empresa no encontrada", "NOT_FOUND");

  const now = new Date();
  const current =
    tenant.licencias.find((l) => l.activa && !l.isDemo && l.expiracion > now) ??
    tenant.licencias.find((l) => l.activa && l.expiracion > now) ??
    null;

  return {
    licenses: tenant.licencias,
    current,
    tenantId: parsed.tenantId,
  };
}

/**
 * @description Asigna una licencia nueva a una empresa desactivando las vigentes.
 * @param {AdminAssignTenantLicenseInput} input - Empresa, plan y vigencia.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Licencia creada y mensaje.
 */
export async function assignAdminTenantLicense(
  input: AdminAssignTenantLicenseInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminAssignTenantLicenseSchema.parse(input ?? {});

  const [tenant, plan] = await Promise.all([
    prisma.tenant.findUnique({
      where: { tenantId: parsed.tenantId },
      select: { tenantId: true, nombre: true },
    }),
    prisma.plan.findUnique({ where: { planId: parsed.planId } }),
  ]);
  if (!tenant) throw new ActionError("Empresa no encontrada", "NOT_FOUND");
  if (!plan) throw new ActionError("Plan no encontrado", "NOT_FOUND");

  const durationDays = resolveLicenseDurationDays(
    plan.duracionDias,
    parsed.durationDays,
  );
  if (!durationDays) {
    throw new ActionError(
      "No se pudo resolver la duración de la licencia",
      "VALIDATION",
    );
  }

  const inicio = parsed.inicio ? new Date(parsed.inicio) : new Date();
  const expiracion = parsed.expiracion
    ? new Date(parsed.expiracion)
    : addDays(inicio, durationDays);

  const license = await prisma.$transaction(async (tx) => {
    await tx.tenantLicense.updateMany({
      where: { tenantId: parsed.tenantId, activa: true },
      data: { activa: false },
    });

    const created = await tx.tenantLicense.create({
      data: {
        tenantId: parsed.tenantId,
        planId: plan.planId,
        inicio,
        expiracion,
        activa: parsed.activa,
        maxUsuarios: plan.maxUsuarios,
        maxAlmacenes: plan.maxAlmacenes,
        maxProductos: plan.maxProductos,
        maxClientes: plan.maxClientes,
        ...resolveLicensePricing(Number(plan.precio), false),
      },
      include: { plan: true },
    });

    await AuditLogService.logStrict(
      {
        accion: "CREATE",
        entidad: "TENANT_LICENSE",
        entidadId: created.tenantLicenseId,
        usuarioId: user.userId,
        detalles: {
          tenantId: parsed.tenantId,
          planId: plan.planId,
          expiracion: expiracion.toISOString(),
          via: "mobile-admin",
        },
      },
      tx,
    );

    return created;
  });

  revalidatePath("/admin");
  return {
    license,
    message: `Licencia ${plan.nombre} asignada a ${tenant.nombre}`,
  };
}

/**
 * @description Modifica el plan, los límites o el vencimiento de una licencia.
 * @param {AdminUpdateTenantLicenseInput} input - Cambios a aplicar.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Licencia actualizada y mensaje.
 */
export async function updateAdminTenantLicense(
  input: AdminUpdateTenantLicenseInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminUpdateTenantLicenseSchema.parse(input ?? {});

  const license = await prisma.tenantLicense.findUnique({
    where: { tenantLicenseId: parsed.tenantLicenseId },
    select: { tenantLicenseId: true, planId: true },
  });
  if (!license) throw new ActionError("Licencia no encontrada", "NOT_FOUND");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (parsed.expiracion !== undefined)
    data.expiracion = new Date(parsed.expiracion);
  if (parsed.activa !== undefined) data.activa = parsed.activa;
  if (parsed.isAdminTest !== undefined) data.isAdminTest = parsed.isAdminTest;
  if (parsed.maxUsuarios !== undefined) data.maxUsuarios = parsed.maxUsuarios;
  if (parsed.maxAlmacenes !== undefined) data.maxAlmacenes = parsed.maxAlmacenes;
  if (parsed.maxProductos !== undefined)
    data.maxProductos = parsed.maxProductos;
  if (parsed.maxClientes !== undefined) data.maxClientes = parsed.maxClientes;

  let planChanged = false;
  if (parsed.planId !== undefined && parsed.planId !== license.planId) {
    const plan = await prisma.plan.findUnique({
      where: { planId: parsed.planId },
    });
    if (!plan) throw new ActionError("Plan no encontrado", "NOT_FOUND");
    data.planId = plan.planId;
    // Al modificar el plan se sincronizan límites y precios del plan,
    // salvo que se hayan indicado límites explícitos.
    if (parsed.maxUsuarios === undefined) data.maxUsuarios = plan.maxUsuarios;
    if (parsed.maxAlmacenes === undefined)
      data.maxAlmacenes = plan.maxAlmacenes;
    if (parsed.maxProductos === undefined)
      data.maxProductos = plan.maxProductos;
    if (parsed.maxClientes === undefined) data.maxClientes = plan.maxClientes;
    Object.assign(data, resolveLicensePricing(Number(plan.precio), false));
    planChanged = true;
  }

  if (Object.keys(data).length === 0) {
    throw new ActionError("Sin cambios para aplicar", "VALIDATION");
  }

  const updated = await prisma.tenantLicense.update({
    where: { tenantLicenseId: parsed.tenantLicenseId },
    data,
    include: { plan: true },
  });

  await AuditLogService.logStrict({
    accion: "UPDATE",
    entidad: "TENANT_LICENSE",
    entidadId: updated.tenantLicenseId,
    usuarioId: user.userId,
    detalles: {
      changes: Object.keys(data),
      planChanged,
      via: "mobile-admin",
    },
  });

  revalidatePath("/admin");
  return { license: updated, message: "Licencia actualizada correctamente" };
}

// ─── Logs de acceso y sesiones ─────────────────────────────────────

/**
 * @description Obtiene el registro de actividad de los usuarios.
 * @param {AdminActivityLogsQueryInput} input - Filtros opcionales (usuario, límite).
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Entradas del log ordenadas por fecha descendente.
 */
export async function getAdminActivityLogs(
  input: AdminActivityLogsQueryInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminActivityLogsQuerySchema.parse(input ?? {});

  const logs = await prisma.userActivityLog.findMany({
    where: parsed.userId ? { userId: parsed.userId } : undefined,
    orderBy: { createdAt: "desc" },
    take: parsed.limit ?? 100,
  });

  return { logs, total: logs.length };
}

/**
 * @description Obtiene el historial de sesiones (inicios de sesión) de un usuario.
 * @param {AdminLoginHistoryQueryInput} input - Usuario y límite opcional.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Sesiones del usuario ordenadas por fecha descendente.
 */
export async function getAdminUserLoginHistory(
  input: AdminLoginHistoryQueryInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminLoginHistoryQuerySchema.parse(input ?? {});

  const sessions = await prisma.userSession.findMany({
    where: { userId: parsed.userId },
    orderBy: { createdAt: "desc" },
    take: parsed.limit ?? 50,
    include: { user: { select: { name: true, email: true } } },
  });

  return { sessions, total: sessions.length, userId: parsed.userId };
}

/**
 * @description Lista las sesiones registradas en la plataforma.
 * @param {Record<string, unknown>} _input - Sin parámetros (reservado).
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Sesiones ordenadas por fecha descendente.
 */
export async function getAdminSessions(
  _input: Record<string, unknown>,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);

  const sessions = await prisma.userSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true, email: true, role: true } } },
  });

  return { sessions, total: sessions.length };
}

/**
 * @description Revoca una sesión específica de un usuario.
 * @param {AdminRevokeSessionInput} input - Identificador de la sesión.
 * @param {AuthenticatedUser} user - Usuario autenticado (debe ser admin).
 * @returns {Promise<object>} Confirmación de revocación.
 */
export async function revokeAdminSession(
  input: AdminRevokeSessionInput,
  user: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  assertPlatformAdmin(user);
  const parsed = adminRevokeSessionSchema.parse(input ?? {});

  const session = await prisma.userSession.findUnique({
    where: { id: parsed.sessionId },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!session) throw new ActionError("Sesión no encontrada", "NOT_FOUND");

  await prisma.userSession.delete({ where: { id: parsed.sessionId } });

  revalidatePath("/admin");
  return {
    success: true,
    sessionId: parsed.sessionId,
    message: `Sesión de ${session.user.name} revocada correctamente`,
  };
}
